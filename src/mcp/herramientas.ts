import type { Pool } from "pg";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { consultarEstadoCredito } from "../persistencia/consultar-estado.js";
import { consultarCartera } from "../persistencia/consultar-cartera.js";
import { consultarVencimientos } from "../persistencia/consultar-vencimientos.js";
import { explicarMoraCuota } from "../persistencia/estado-cartera.js";
import { fechaCorteEsquema, idCreditoEsquema } from "../validacion/esquemas.js";

export function crearServidorMcp(pool: Pool): McpServer {
const servidor = new McpServer({ name: "credito-vecino", version: "1.0.0" });
const fecha = fechaCorteEsquema.describe("Fecha de corte AAAA-MM-DD");
const idCredito = idCreditoEsquema.describe("Código del crédito");

function respuesta(datos: unknown) {
    return {
        content: [{
            type: "text" as const,
            text: JSON.stringify(datos, (_clave, valor: unknown) => typeof valor === "bigint" ? valor.toString() : valor)
        }]
    };
}

servidor.registerTool("consultar_credito", {
    description: "Estado, saldo, atraso y cuota de un crédito a la fecha de corte",
    inputSchema: { idCredito, fechaCorte: fecha }
}, async ({ idCredito: id, fechaCorte }) => {
    const resultado = await consultarEstadoCredito(pool, id, fechaCorte);
    if (!resultado) return respuesta({ codigo: "CREDITO_INEXISTENTE" });
    const estado = resultado.estado;
    return respuesta({
        id_credito: id,
        saldo_capital_centavos: estado.saldoCapital,
        dias_atraso: estado.diasAtraso,
        tramo: estado.incobrable ? "INCOBRABLE" :
            estado.diasAtraso > 90 ? "VENCIDO" :
            estado.diasAtraso > 60 ? "MORA_3" :
            estado.diasAtraso > 30 ? "MORA_2" :
            estado.diasAtraso > 0 ? "MORA_1" : "SIN_MORA",
        incobrable: estado.incobrable,
        cuotas_pagadas: estado.cuotas.filter(cuota =>
            cuota.capitalPendiente + cuota.interesPendiente +
            cuota.moraPendiente + cuota.gastosPendientes === 0n
        ).length,
        cuotas_vencidas: estado.cuotas.filter(cuota => cuota.vencimiento < fechaCorte &&
            cuota.capitalPendiente + cuota.interesPendiente + cuota.moraPendiente + cuota.gastosPendientes > 0n).length,
        proxima_cuota: estado.proximaCuota?.numero ?? null,
        monto_exigible_centavos: estado.montoExigible
    });
});

servidor.registerTool("calcular_deuda_cuota", {
    description: "Desglose exacto de la próxima cuota pendiente",
    inputSchema: { idCredito, fechaCorte: fecha }
}, async ({ idCredito: id, fechaCorte }) => {
    const resultado = await consultarEstadoCredito(pool, id, fechaCorte);
    if (!resultado) return respuesta({ codigo: "CREDITO_INEXISTENTE" });
    const cuota = resultado.estado.proximaCuota;
    if (!cuota) return respuesta({ codigo: "CUOTA_PAGADA" });
    if (resultado.estado.incobrable) return respuesta({ codigo: "CREDITO_INCOBRABLE" });
    return respuesta({
        numero: cuota.numero,
        fecha_vencimiento: cuota.vencimiento,
        gastos_centavos: cuota.gastosPendientes,
        moratorio_centavos: cuota.moraPendiente,
        corriente_centavos: cuota.interesPendiente,
        capital_centavos: cuota.capitalPendiente,
        total_centavos: resultado.estado.montoExigible
    });
});

servidor.registerTool("explicar_mora", {
    description: "Días, tasas y tramos recorridos por una cuota en mora",
    inputSchema: { idCredito, fechaCorte: fecha, numeroCuota: z.number().int().positive().optional() }
}, async ({ idCredito: id, fechaCorte, numeroCuota }) => {
    const resultado = await consultarEstadoCredito(pool, id, fechaCorte);
    if (!resultado) return respuesta({ codigo: "CREDITO_INEXISTENTE" });
    const mora = explicarMoraCuota(resultado.estado, fechaCorte, resultado.politicaFuente, numeroCuota);
    if (!mora) return respuesta({ codigo: numeroCuota === undefined ? "CUOTA_PAGADA" : "CUOTA_INEXISTENTE" });
    return respuesta({
        politica: resultado.politica,
        ...mora
    });
});

servidor.registerTool("listar_morosos", {
    description: "Créditos en mora filtrables por tramo",
    inputSchema: { fechaCorte: fecha, tramo: z.enum(["TODOS", "MORA_1", "MORA_2", "MORA_3", "VENCIDO"]).default("TODOS") }
}, async ({ fechaCorte, tramo }) => {
    const cartera = await consultarCartera(pool, fechaCorte);
    return respuesta(cartera.morosos.filter(credito => credito.dias_atraso > 0 && (tramo === "TODOS" || credito.tramo === tramo)));
});

servidor.registerTool("proximos_vencimientos", {
    description: "Cuotas que vencen en una ventana de días",
    inputSchema: { fechaCorte: fecha, dias: z.number().int().min(1).max(90) }
}, async ({ fechaCorte, dias }) => respuesta(await consultarVencimientos(pool, fechaCorte, dias)));

servidor.registerTool("consultar_cartera", {
    description: "Cartera activa, mora, riesgo por tramo e incobrable del mes",
    inputSchema: { fechaCorte: fecha }
}, async ({ fechaCorte }) => respuesta(await consultarCartera(pool, fechaCorte)));

servidor.registerTool("consultar_cierre", {
    description: "Cierre diario o mensual previamente ejecutado",
    inputSchema: { fechaCorte: fecha, tipo: z.enum(["DIARIO", "MENSUAL"]) }
}, async ({ fechaCorte, tipo }) => {
    const resultado = await pool.query(
        `SELECT resumen FROM cierres WHERE tipo = $1 AND fecha_corte = $2`,
        [tipo, fechaCorte]
    );
    return respuesta(resultado.rows[0]?.resumen ?? { codigo: "CIERRE_INEXISTENTE" });
});

servidor.registerTool("proponer_pago", {
    description: "Propone un pago exacto; exige aprobación visible en la aplicación antes de registrarlo",
    inputSchema: { idCredito, fechaCorte: fecha, montoCentavos: z.number().int().positive().optional() }
}, async ({ idCredito: id, fechaCorte, montoCentavos }) => {
    const resultado = await consultarEstadoCredito(pool, id, fechaCorte);
    if (!resultado) return respuesta({ codigo: "CREDITO_INEXISTENTE" });
    if (resultado.estado.incobrable) return respuesta({ codigo: "CREDITO_INCOBRABLE" });
    if (!resultado.estado.proximaCuota) return respuesta({ codigo: "CUOTA_PAGADA" });
    if (montoCentavos !== undefined && BigInt(montoCentavos) !== resultado.estado.montoExigible) {
        return respuesta({
            codigo: "MONTO_NO_EXACTO",
            monto_correcto_centavos: resultado.estado.montoExigible
        });
    }
    return respuesta({
        id_credito: id,
        fecha_corte: fechaCorte,
        cuota: resultado.estado.proximaCuota.numero,
        monto_exacto_centavos: resultado.estado.montoExigible,
        estado: "REQUIERE_APROBACION_HUMANA"
    });
});

return servidor;
}