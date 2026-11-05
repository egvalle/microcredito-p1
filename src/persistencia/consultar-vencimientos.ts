import { addDays, format, parseISO } from "date-fns";
import type { Pool } from "pg";
import { consultarEstadoCredito, validarFechaCorte } from "./consultar-estado.js";

export async function consultarVencimientos(pool: Pool, fechaCorte: string, ventanaDias: number) {
    validarFechaCorte(fechaCorte);
    if (!Number.isInteger(ventanaDias) || ventanaDias < 1 || ventanaDias > 90) {
        throw new Error("La ventana debe estar entre 1 y 90 días");
    }
    const fin = format(addDays(parseISO(fechaCorte), ventanaDias), "yyyy-MM-dd");
    const creditos = await pool.query<{ id_credito: string }>(
        `SELECT id_credito FROM creditos WHERE fecha_otorgamiento <= $1`,
        [fechaCorte]
    );
    const estados = await Promise.all(creditos.rows.map(credito =>
        consultarEstadoCredito(pool, credito.id_credito, fechaCorte)
    ));
    const cuotas = estados.filter(estado => estado !== null && !estado.estado.incobrable)
        .flatMap(estado => estado!.estado.cuotas
            .filter(cuota => cuota.vencimiento > fechaCorte && cuota.vencimiento <= fin &&
                cuota.capitalPendiente + cuota.interesPendiente > 0n)
            .map(cuota => ({
                id_credito: estado!.credito.id_credito,
                numero_cuota: cuota.numero,
                fecha_vencimiento: cuota.vencimiento,
                monto_centavos: (cuota.capitalPendiente + cuota.interesPendiente).toString()
            })));
    cuotas.sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento) || a.id_credito.localeCompare(b.id_credito));
    return {
        fecha_corte: fechaCorte,
        hasta: fin,
        cantidad: cuotas.length,
        total_centavos: cuotas.reduce((suma, cuota) => suma + BigInt(cuota.monto_centavos), 0n).toString(),
        cuotas
    };
}
