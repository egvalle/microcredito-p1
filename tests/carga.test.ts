import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { cargarDatosCanonicos } from "../src/persistencia/cargador-canonico.js";

const datos = resolve("datos");

describe("carga canónica", () => {
    it("verifica la huella y los conteos antes de escribir; repetir la carga no duplica datos", async () => {
        const eventos = await readFile(join(datos, "eventos.jsonl"));
        const huella = createHash("sha256").update(eventos).digest("hex");
        const consultas: string[] = [];
        const pool = {
            connect: async () => ({
                query: async (sql: string) => {
                    consultas.push(sql.trim());
                    if (sql.includes("FROM cargas_canonicas")) return { rows: [{
                        estado: "COMPLETADA", eventos_leidos: 363, clientes_leidos: 60,
                        desembolsos_leidos: 75, pagos_leidos: 228,
                        pagos_unicos: 226, pagos_duplicados: 2
                    }] };
                    return { rows: [] };
                },
                release: () => undefined
            })
        } as unknown as Pool;
        const primera = await cargarDatosCanonicos(pool, datos);
        const segunda = await cargarDatosCanonicos(pool, datos);
        expect(primera).toMatchObject({
            yaEstabaCargada: true, sha256: huella, eventosLeidos: 363,
            clientesLeidos: 60, desembolsosLeidos: 75,
            pagosLeidos: 228, pagosUnicos: 226, pagosDuplicados: 2
        });
        expect(segunda).toEqual(primera);
        expect(consultas.filter(sql => sql === "COMMIT")).toHaveLength(2);
        expect(consultas.some(sql => sql.startsWith("INSERT"))).toBe(false);
    });

    it("rechaza un archivo alterado antes de abrir una conexión", async () => {
        const temporal = await mkdtemp(join(tmpdir(), "credito-vecino-carga-"));
        try {
            for (const nombre of ["eventos.jsonl", "eventos.sha256", "asesores.csv", "politicas.json"]) {
                await cp(join(datos, nombre), join(temporal, nombre));
            }
            await writeFile(join(temporal, "eventos.jsonl"), "{}\n");
            const pool = { connect: () => { throw new Error("No debería conectar"); } } as unknown as Pool;
            await expect(cargarDatosCanonicos(pool, temporal)).rejects.toThrow("huella");
        } finally {
            await rm(temporal, { recursive: true, force: true });
        }
    });
});
