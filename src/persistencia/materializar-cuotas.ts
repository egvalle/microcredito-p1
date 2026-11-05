import "dotenv/config";
import { Pool } from "pg";
import { Decimal } from "decimal.js";

import { Dinero } from "../dominio/dinero.js";
import { AmortizacionFrancesa } from "../dominio/plan-amortizacion.js";
import { generarFechasVencimiento } from "../dominio/calendario-cuotas.js";

type CreditoDb = {
    id_credito: string;
    fecha_otorgamiento: string;
    capital_centavos: string;
    plazo_meses: number;
    tna_bps: string;
};

async function main(): Promise<void> {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        throw new Error("Debes definir la variable DATABASE_URL");
    }

    const pool = new Pool({ connectionString });
    const clienteDb = await pool.connect();

    try {
        await clienteDb.query("BEGIN");

        await clienteDb.query("DELETE FROM cuotas_credito");

        const resultado = await clienteDb.query<CreditoDb>(
            `SELECT id_credito,
                    fecha_otorgamiento::text,
                    capital_centavos::text,
                    plazo_meses,
                    tna_bps::text
             FROM creditos
             ORDER BY fecha_otorgamiento, id_credito`
        );

        const amortizacion = new AmortizacionFrancesa();
        let totalCuotas = 0;

        for (const credito of resultado.rows) {
            const fechas = generarFechasVencimiento(
                credito.fecha_otorgamiento,
                credito.plazo_meses
            );

            const plan = amortizacion.generar({
                capital: Dinero.desdeCentavos(
                    BigInt(credito.capital_centavos)
                ),
                tasaNominalAnual: new Decimal(credito.tna_bps)
                    .div(10_000),
                numeroCuotas: credito.plazo_meses
            });

            const cuotas = plan.obtenerCuotas();

            if (cuotas.length !== fechas.length) {
                throw new Error(
                    `El plan de ${credito.id_credito} no coincide con sus vencimientos`
                );
            }

            for (let indice = 0; indice < cuotas.length; indice += 1) {
                const cuota = cuotas[indice];
                const fechaVencimiento = fechas[indice];

                if (!cuota || !fechaVencimiento) {
                    throw new Error(
                        `No se pudo materializar la cuota ${indice + 1} de ${credito.id_credito}`
                    );
                }

                await clienteDb.query(
                    `INSERT INTO cuotas_credito
                        (id_credito, numero_cuota, fecha_vencimiento,
                         saldo_inicial_centavos, interes_centavos,
                         capital_centavos, monto_cuota_centavos,
                         saldo_final_centavos)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        credito.id_credito,
                        cuota.numero,
                        fechaVencimiento,
                        cuota.saldoInicial.obtenerCentavos().toString(),
                        cuota.interes.obtenerCentavos().toString(),
                        cuota.capital.obtenerCentavos().toString(),
                        cuota.cuota.obtenerCentavos().toString(),
                        cuota.saldoFinal.obtenerCentavos().toString()
                    ]
                );

                totalCuotas += 1;
            }
        }

        await clienteDb.query("COMMIT");

        console.log("Cuotas materializadas:");
        console.log(`Créditos: ${resultado.rows.length}`);
        console.log(`Cuotas: ${totalCuotas}`);
    } catch (error) {
        await clienteDb.query("ROLLBACK");
        throw error;
    } finally {
        clienteDb.release();
        await pool.end();
    }
}

main().catch((error: unknown) => {
    console.error(
        "No se pudieron materializar las cuotas:",
        error instanceof Error ? error.message : error
    );

    process.exitCode = 1;
});