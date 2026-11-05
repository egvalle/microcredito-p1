import type { Pool, PoolClient } from "pg";
import { fechaCorteEsquema } from "../validacion/esquemas.js";
import {
    reconstruirEstado,
    type CuotaFuente,
    type PagoFuente,
    type PoliticaFuente
} from "./estado-cartera.js";

type Conexion = Pool | PoolClient;

type CreditoFuente = {
    id_credito: string;
    id_cliente: string;
    fecha_otorgamiento: string;
    capital_centavos: string;
    plazo_meses: number;
    tna_bps: number;
    reestructurado: boolean;
};

type ConfiguracionGasto = {
    monto_centavos: number;
    dia_generacion: number;
    aplica_a_politicas: string[];
};

export function validarFechaCorte(fecha: string): void {
    if (!fechaCorteEsquema.safeParse(fecha).success) {
        throw new Error("La fecha de corte debe ser una fecha válida AAAA-MM-DD");
    }
}

export async function consultarEstadoCredito(conexion: Conexion, idCredito: string, fechaCorte: string) {
    validarFechaCorte(fechaCorte);
    const credito = await conexion.query<CreditoFuente>(
        `SELECT id_credito, id_cliente, fecha_otorgamiento::text,
                capital_centavos::text, plazo_meses, tna_bps, reestructurado
         FROM creditos WHERE id_credito = $1`,
        [idCredito]
    );
    const datos = credito.rows[0];
    if (!datos) return null;

    const cuotas = await conexion.query<CuotaFuente>(
            `SELECT numero_cuota, fecha_vencimiento::text,
                    capital_centavos::text, interes_centavos::text
             FROM cuotas_credito WHERE id_credito = $1 ORDER BY numero_cuota`,
            [idCredito]
        );
    const pagos = await conexion.query<PagoFuente>(
            `SELECT id::text, fecha::text, monto_centavos::text
             FROM pagos WHERE id_credito = $1 AND fecha <= $2
             ORDER BY fecha, id`,
            [idCredito, fechaCorte]
        );
    const politica = await conexion.query<{ codigo: string; tipo: "plana" | "escalonada"; parametros: PoliticaFuente["parametros"] }>(
            `SELECT codigo, tipo, parametros FROM politicas_mora
             WHERE (vigencia_desde IS NULL OR vigencia_desde <= $1)
               AND (vigencia_hasta IS NULL OR vigencia_hasta >= $1)
             ORDER BY vigencia_desde DESC NULLS LAST LIMIT 1`,
            [datos.fecha_otorgamiento]
        );
    const configuracion = await conexion.query<{ valor: { gasto_gestion_cobro?: ConfiguracionGasto } }>(
            `SELECT valor FROM configuracion_sistema
             WHERE clave = 'politicas_canonicas'`
        );

    const regla = politica.rows[0];
    if (!regla || cuotas.rows.length === 0) {
        throw new Error("Falta el plan de cuotas o la política del crédito");
    }
    const gasto = configuracion.rows[0]?.valor.gasto_gestion_cobro;
    const aplicaGasto = gasto?.aplica_a_politicas.includes(regla.codigo) ?? false;
    const fuente: PoliticaFuente = {
        tipo: regla.tipo,
        parametros: regla.parametros,
        gastoCentavos: aplicaGasto ? BigInt(gasto!.monto_centavos) : 0n,
        gastoDia: aplicaGasto ? gasto!.dia_generacion : undefined
    };

    return {
        credito: datos,
        politica: regla.codigo,
        politicaFuente: fuente,
        estado: reconstruirEstado(cuotas.rows, pagos.rows, fuente, fechaCorte)
    };
}
