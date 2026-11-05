import { format, parseISO, subDays } from "date-fns";
import type { Pool } from "pg";
import { CalculadoraCarteraRiesgo, type CreditoCartera } from "../dominio/cartera.js";
import { Dinero } from "../dominio/dinero.js";
import { consultarEstadoCredito, validarFechaCorte } from "./consultar-estado.js";

export async function consultarCartera(pool: Pool, fechaCorte: string) {
    validarFechaCorte(fechaCorte);
    const creditos = await pool.query<{ id_credito: string }>(
        `SELECT id_credito FROM creditos WHERE fecha_otorgamiento <= $1
         ORDER BY id_credito`,
        [fechaCorte]
    );
    const estados = await Promise.all(creditos.rows.map(async credito =>
        consultarEstadoCredito(pool, credito.id_credito, fechaCorte)
    ));
    const validos = estados.filter(estado => estado !== null);
    const cartera: CreditoCartera[] = validos.map(({ credito, estado }) => ({
        id: credito.id_credito,
        saldoCapital: Dinero.desdeCentavos(estado.saldoCapital),
        diasAtraso: estado.diasAtraso,
        reestructurado: credito.reestructurado,
        incobrable: estado.incobrable
    }));
    const calculadora = new CalculadoraCarteraRiesgo();
    const riesgo = cartera.length > 0 ? calculadora.calcular(cartera) : null;
    const tramos = cartera.length > 0 ? calculadora.calcularPorTramo(cartera) : null;
    const enMora = cartera.filter(credito => !credito.incobrable && credito.diasAtraso > 0)
        .reduce((suma, credito) => suma + credito.saldoCapital.obtenerCentavos(), 0n);
    const inicioMes = fechaCorte.slice(0, 7) + "-01";
    const diaAnterior = format(subDays(parseISO(inicioMes), 1), "yyyy-MM-dd");
    let incobrableMes = 0n;
    for (const actual of validos.filter(fila => fila.estado.incobrable)) {
        const anterior = await consultarEstadoCredito(pool, actual.credito.id_credito, diaAnterior);
        if (!anterior?.estado.incobrable) incobrableMes += actual.estado.saldoCapital;
    }

    return {
        fecha_corte: fechaCorte,
        cartera_activa_centavos: riesgo?.carteraActiva.obtenerCentavos().toString() ?? "0",
        cartera_mora_centavos: enMora.toString(),
        cartera_riesgo_centavos: riesgo?.capitalEnRiesgo.obtenerCentavos().toString() ?? "0",
        porcentaje_riesgo: riesgo?.porcentajeRiesgo.toFixed(2) ?? "0.00",
        incobrable_mes_centavos: incobrableMes.toString(),
        tramos: tramos?.desglose.map(tramo => ({
            tramo: tramo.tramo,
            saldo_centavos: tramo.saldoCapital.obtenerCentavos().toString(),
            porcentaje: tramo.porcentajeDeCarteraActiva.toFixed(2),
            creditos: tramo.creditos
        })) ?? [],
        morosos: cartera.filter(credito => !credito.incobrable && (credito.diasAtraso > 0 || credito.reestructurado))
            .map(credito => ({
                id_credito: credito.id,
                dias_atraso: credito.diasAtraso,
                tramo: credito.reestructurado ? "REESTRUCTURADO" :
                    credito.diasAtraso > 90 ? "VENCIDO" :
                    credito.diasAtraso > 60 ? "MORA_3" :
                    credito.diasAtraso > 30 ? "MORA_2" : "MORA_1",
                saldo_centavos: credito.saldoCapital.obtenerCentavos().toString()
            }))
    };
}
