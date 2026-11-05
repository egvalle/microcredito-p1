import type { PoolClient } from "pg";
import type { AplicacionCalculada } from "./estado-cartera.js";

export async function guardarAplicaciones(
    conexion: PoolClient,
    aplicaciones: AplicacionCalculada[]
): Promise<void> {
    for (const aplicacion of aplicaciones) {
        await conexion.query(
            `INSERT INTO aplicaciones_pagos
                (pago_id, monto_pago_centavos, gastos_centavos, interes_moratorio_centavos,
                 interes_corriente_centavos, capital_centavos, excedente_centavos)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (pago_id) DO UPDATE SET
                monto_pago_centavos = EXCLUDED.monto_pago_centavos,
                gastos_centavos = EXCLUDED.gastos_centavos,
                interes_moratorio_centavos = EXCLUDED.interes_moratorio_centavos,
                interes_corriente_centavos = EXCLUDED.interes_corriente_centavos,
                capital_centavos = EXCLUDED.capital_centavos,
                excedente_centavos = EXCLUDED.excedente_centavos`,
            [aplicacion.pagoId, aplicacion.monto.toString(), aplicacion.gastos.toString(),
             aplicacion.moratorio.toString(), aplicacion.corriente.toString(),
             aplicacion.capital.toString(), aplicacion.excedente.toString()]
        );
    }
}
