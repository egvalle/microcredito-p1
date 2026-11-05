import "dotenv/config";
import { Pool } from "pg";
import { consultarEstadoCredito } from "./consultar-estado.js";
import { guardarAplicaciones } from "./guardar-aplicaciones.js";

async function main(): Promise<void> {
    if (!process.env.DATABASE_URL) throw new Error("Debes definir DATABASE_URL");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const conexion = await pool.connect();
    try {
        await conexion.query("BEGIN");
        const creditos = await conexion.query<{ id_credito: string; fecha: string | null }>(
            `SELECT c.id_credito, MAX(p.fecha)::text AS fecha
             FROM creditos c JOIN pagos p ON p.id_credito = c.id_credito
             GROUP BY c.id_credito ORDER BY c.id_credito`
        );
        let total = 0;
        for (const credito of creditos.rows) {
            if (!credito.fecha) continue;
            const resultado = await consultarEstadoCredito(conexion, credito.id_credito, credito.fecha);
            if (!resultado) throw new Error(`No se encontró el crédito ${credito.id_credito}`);
            await guardarAplicaciones(conexion, resultado.estado.aplicaciones);
            total += resultado.estado.aplicaciones.length;
        }
        await conexion.query("COMMIT");
        console.log(`Aplicaciones materializadas: ${total}`);
    } catch (problema) {
        await conexion.query("ROLLBACK");
        throw problema;
    } finally {
        conexion.release();
        await pool.end();
    }
}

main().catch((problema: unknown) => {
    console.error("No se pudieron materializar los pagos:", problema instanceof Error ? problema.message : problema);
    process.exitCode = 1;
});
