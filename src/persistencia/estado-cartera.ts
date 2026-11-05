import { Decimal } from "decimal.js";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { Dinero } from "../dominio/dinero.js";
import { PrelacionPago } from "../dominio/prelacion-pago.js";

export type CuotaFuente = {
    numero_cuota: number;
    fecha_vencimiento: string;
    capital_centavos: string;
    interes_centavos: string;
};

export type PagoFuente = {
    id: string;
    fecha: string;
    monto_centavos: string;
};

export type PoliticaFuente = {
    tipo: "plana" | "escalonada";
    gastoCentavos?: bigint;
    gastoDia?: number;
    parametros: {
        tna_bps?: number;
        tramos?: Array<{ ini: number; fin: number; bps: number }>;
    };
};

export type CuotaCalculada = {
    numero: number;
    vencimiento: string;
    capitalPendiente: bigint;
    interesPendiente: bigint;
    moraPendiente: bigint;
    gastosPendientes: bigint;
    ultimoDiaMora: number;
    gastoGenerado: boolean;
};

export type AplicacionCalculada = {
    pagoId: string;
    monto: bigint;
    gastos: bigint;
    moratorio: bigint;
    corriente: bigint;
    capital: bigint;
    excedente: bigint;
};

export type EstadoCartera = {
    cuotas: CuotaCalculada[];
    aplicaciones: AplicacionCalculada[];
    saldoCapital: bigint;
    diasAtraso: number;
    incobrable: boolean;
    proximaCuota: CuotaCalculada | null;
    montoExigible: bigint;
};

function diasAtraso(vencimiento: string, corte: string): number {
    return Math.max(0, differenceInCalendarDays(parseISO(corte), parseISO(vencimiento)));
}

function moraAcumulada(capital: bigint, dias: number, politica: PoliticaFuente): bigint {
    if (capital <= 0n || dias <= 0) return 0n;
    const diasLimitados = Math.min(120, dias);
    let suma = new Decimal(0);

    if (politica.tipo === "plana") {
        suma = new Decimal(politica.parametros.tna_bps ?? 0).mul(diasLimitados);
    } else {
        for (const tramo of politica.parametros.tramos ?? []) {
            const cantidad = Math.max(0, Math.min(diasLimitados, tramo.fin) - tramo.ini + 1);
            suma = suma.plus(new Decimal(tramo.bps).mul(cantidad));
        }
    }

    const centavos = BigInt(new Decimal(capital.toString()).mul(suma)
        .div(10_000 * 360).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0));
    return centavos > capital ? capital : centavos;
}

export function desglosarMora(capital: bigint, dias: number, politica: PoliticaFuente) {
    const diasLimitados = Math.min(120, Math.max(0, dias));
    const tramos = politica.tipo === "plana"
        ? [{ ini: 1, fin: 120, bps: politica.parametros.tna_bps ?? 0 }]
        : politica.parametros.tramos ?? [];
    return tramos.map(tramo => {
        const cantidad = Math.max(0, Math.min(diasLimitados, tramo.fin) - tramo.ini + 1);
        const importe = new Decimal(capital.toString()).mul(tramo.bps)
            .mul(cantidad).div(10_000 * 360 * 100).toFixed(4);
        return {
            desde: tramo.ini,
            hasta: tramo.fin,
            dias: cantidad,
            tasa_bps: tramo.bps,
            importe_quetzales_sin_redondear: importe
        };
    }).filter(tramo => tramo.dias > 0);
}

export function explicarMoraCuota(
    estado: EstadoCartera,
    fechaCorte: string,
    politica: PoliticaFuente,
    numeroCuota?: number
) {
    const cuota = numeroCuota === undefined
        ? estado.proximaCuota
        : estado.cuotas.find(actual => actual.numero === numeroCuota);
    if (!cuota) return null;
    const dias = diasAtraso(cuota.vencimiento, fechaCorte);
    return {
        cuota: cuota.numero,
        vencimiento: cuota.vencimiento,
        dias_atraso: dias,
        capital_en_mora_centavos: dias > 0 ? cuota.capitalPendiente.toString() : "0",
        mora_pendiente_centavos: cuota.moraPendiente.toString(),
        tramos: desglosarMora(cuota.capitalPendiente, dias, politica)
    };
}

function saldo(cuota: CuotaCalculada): bigint {
    return cuota.gastosPendientes + cuota.moraPendiente +
        cuota.interesPendiente + cuota.capitalPendiente;
}

function aplicarConcepto(
    cuotas: CuotaCalculada[],
    campo: "gastosPendientes" | "moraPendiente" | "interesPendiente" | "capitalPendiente",
    monto: bigint
): void {
    let restante = monto;
    for (const cuota of cuotas) {
        if (restante === 0n) break;
        const aplicado = cuota[campo] < restante ? cuota[campo] : restante;
        cuota[campo] -= aplicado;
        restante -= aplicado;
    }
}

function aplicarPago(cuotas: CuotaCalculada[], pago: PagoFuente): AplicacionCalculada {
    const vencidas = cuotas.filter(cuota => cuota.vencimiento <= pago.fecha && saldo(cuota) > 0n);
    const futuras = cuotas.filter(cuota => cuota.vencimiento > pago.fecha && saldo(cuota) > 0n);
    const orden = [...vencidas, ...futuras];
    let disponible = BigInt(pago.monto_centavos);
    const total = { gastos: 0n, moratorio: 0n, corriente: 0n, capital: 0n };
    const prelacion = new PrelacionPago();

    for (const cuota of orden) {
        if (disponible === 0n) break;
        const deuda = {
            gastos: Dinero.desdeCentavos(cuota.gastosPendientes),
            interesMoratorio: Dinero.desdeCentavos(cuota.moraPendiente),
            interesCorriente: Dinero.desdeCentavos(cuota.interesPendiente),
            capital: Dinero.desdeCentavos(cuota.capitalPendiente)
        };
        const aplicacion = prelacion.aplicar(Dinero.desdeCentavos(disponible), deuda);
        const gastos = aplicacion.gastos.obtenerCentavos();
        const moratorio = aplicacion.interesMoratorio.obtenerCentavos();
        const corriente = aplicacion.interesCorriente.obtenerCentavos();
        const capital = aplicacion.capital.obtenerCentavos();
        aplicarConcepto([cuota], "gastosPendientes", gastos);
        aplicarConcepto([cuota], "moraPendiente", moratorio);
        aplicarConcepto([cuota], "interesPendiente", corriente);
        aplicarConcepto([cuota], "capitalPendiente", capital);
        total.gastos += gastos;
        total.moratorio += moratorio;
        total.corriente += corriente;
        total.capital += capital;
        disponible = aplicacion.excedente.obtenerCentavos();
    }

    return {
        pagoId: pago.id,
        monto: BigInt(pago.monto_centavos),
        ...total,
        excedente: disponible
    };
}

export function reconstruirEstado(
    cuotasFuente: CuotaFuente[],
    pagosFuente: PagoFuente[],
    politica: PoliticaFuente,
    fechaCorte: string
): EstadoCartera {
    const cuotas: CuotaCalculada[] = cuotasFuente.map(cuota => ({
        numero: cuota.numero_cuota,
        vencimiento: cuota.fecha_vencimiento,
        capitalPendiente: BigInt(cuota.capital_centavos),
        interesPendiente: BigInt(cuota.interes_centavos),
        moraPendiente: 0n,
        gastosPendientes: 0n,
        ultimoDiaMora: 0,
        gastoGenerado: false
    }));
    cuotas.sort((a, b) => a.numero - b.numero);

    function avanzarHasta(fecha: string): void {
        for (const cuota of cuotas) {
            if (saldo(cuota) === 0n) continue;
            const dias = diasAtraso(cuota.vencimiento, fecha);
            if (dias > cuota.ultimoDiaMora && cuota.capitalPendiente > 0n) {
                cuota.moraPendiente += moraAcumulada(cuota.capitalPendiente, dias, politica) -
                    moraAcumulada(cuota.capitalPendiente, cuota.ultimoDiaMora, politica);
            }
            cuota.ultimoDiaMora = dias;
            if (politica.gastoCentavos && dias >= (politica.gastoDia ?? 31) && !cuota.gastoGenerado) {
                cuota.gastosPendientes += politica.gastoCentavos;
                cuota.gastoGenerado = true;
            }
        }
    }

    const aplicaciones: AplicacionCalculada[] = [];
    const pagos = [...pagosFuente].filter(pago => pago.fecha <= fechaCorte)
        .sort((a, b) => a.fecha.localeCompare(b.fecha) || Number(BigInt(a.id) - BigInt(b.id)));
    for (const pago of pagos) {
        avanzarHasta(pago.fecha);
        aplicaciones.push(aplicarPago(cuotas, pago));
    }
    avanzarHasta(fechaCorte);

    const proximaCuota = cuotas.find(cuota => saldo(cuota) > 0n) ?? null;
    const dias = proximaCuota ? diasAtraso(proximaCuota.vencimiento, fechaCorte) : 0;
    return {
        cuotas,
        aplicaciones,
        saldoCapital: cuotas.reduce((total, cuota) => total + cuota.capitalPendiente, 0n),
        diasAtraso: dias,
        incobrable: dias > 120,
        proximaCuota,
        montoExigible: proximaCuota ? saldo(proximaCuota) : 0n
    };
}
