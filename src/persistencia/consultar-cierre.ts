import type { Pool } from "pg";
import { consultarCartera } from "./consultar-cartera.js";
import { validarFechaCorte } from "./consultar-estado.js";

export type TipoCierre = "DIARIO" | "MENSUAL";

export async function calcularCierre(pool: Pool, tipo: TipoCierre, fechaCorte: string) {
    validarFechaCorte(fechaCorte);
    const inicio = tipo === "DIARIO" ? fechaCorte : fechaCorte.slice(0, 7) + "-01";
    const [desembolsos, recuperaciones, cartera] = await Promise.all([
        pool.query<{ total: string; cantidad: string }>(
            `SELECT COALESCE(SUM(capital_centavos), 0)::text AS total,
                    COUNT(*)::text AS cantidad
             FROM creditos WHERE fecha_otorgamiento BETWEEN $1 AND $2`,
            [inicio, fechaCorte]
        ),
        pool.query<{
            total: string;
            gastos: string;
            moratorio: string;
            corriente: string;
            capital: string;
            excedente: string;
        }>(
            `SELECT COALESCE(SUM(a.monto_pago_centavos), 0)::text AS total,
                    COALESCE(SUM(a.gastos_centavos), 0)::text AS gastos,
                    COALESCE(SUM(a.interes_moratorio_centavos), 0)::text AS moratorio,
                    COALESCE(SUM(a.interes_corriente_centavos), 0)::text AS corriente,
                    COALESCE(SUM(a.capital_centavos), 0)::text AS capital,
                    COALESCE(SUM(a.excedente_centavos), 0)::text AS excedente
             FROM pagos p JOIN aplicaciones_pagos a ON a.pago_id = p.id
             WHERE p.fecha BETWEEN $1 AND $2`,
            [inicio, fechaCorte]
        ),
        consultarCartera(pool, fechaCorte)
    ]);

    return {
        tipo,
        fecha_inicio: inicio,
        fecha_corte: fechaCorte,
        desembolsos_centavos: desembolsos.rows[0]?.total ?? "0",
        cantidad_desembolsos: Number(desembolsos.rows[0]?.cantidad ?? 0),
        recuperaciones_centavos: recuperaciones.rows[0]?.total ?? "0",
        conceptos: {
            gastos_centavos: recuperaciones.rows[0]?.gastos ?? "0",
            moratorio_centavos: recuperaciones.rows[0]?.moratorio ?? "0",
            corriente_centavos: recuperaciones.rows[0]?.corriente ?? "0",
            capital_centavos: recuperaciones.rows[0]?.capital ?? "0",
            excedente_centavos: recuperaciones.rows[0]?.excedente ?? "0"
        },
        cartera_activa_centavos: cartera.cartera_activa_centavos,
        cartera_riesgo_centavos: cartera.cartera_riesgo_centavos,
        incobrable_mes_centavos: cartera.incobrable_mes_centavos,
        tramos: cartera.tramos
    };
}
