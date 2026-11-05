import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";

import { cargarDatosCanonicos } from "./cargador-canonico.js";

async function main(): Promise<void> {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        throw new Error("Debes definir la variable DATABASE_URL");
    }

    const raizProyecto = process.cwd();
    const rutaDatos = process.env.CV_DATA_DIR ?? process.env.DATOS_CANONICOS_DIR;
    const directorioDatos = rutaDatos
        ? resolve(rutaDatos)
        : resolve(raizProyecto, "datos");

    const rutaEsquema = resolve(
        raizProyecto,
        "src/persistencia/schema.sql"
    );

    const esquemaSql = await readFile(rutaEsquema, "utf8");
    const pool = new Pool({ connectionString });

    try {
        await pool.query(esquemaSql);

        const resultado = await cargarDatosCanonicos(
            pool,
            directorioDatos
        );

        console.log("Carga canónica completada:");
        console.log(`\x1b[32mSHA-256 verificado: ${resultado.sha256}\x1b[0m`);
        console.log(`Eventos leídos: ${resultado.eventosLeidos}`);
        console.log(`Clientes: ${resultado.clientesLeidos}`);
        console.log(`Créditos: ${resultado.desembolsosLeidos}`);
        console.log(`Eventos de pago: ${resultado.pagosLeidos}`);
        console.log(`Pagos únicos: ${resultado.pagosUnicos}`);
        console.log(`Duplicados ignorados: ${resultado.pagosDuplicados}`);
        console.log(`Ya estaba cargada: ${resultado.yaEstabaCargada}`);
    } finally {
        await pool.end();
    }
}

main().catch((error: unknown) => {
    console.error(
        "No se pudo inicializar la base de datos:",
        error instanceof Error ? error.message : error
    );

    process.exitCode = 1;
});
