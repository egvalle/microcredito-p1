import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { crearServidorMcp } from "../src/mcp/herramientas.js";
import { consultarEstadoCredito } from "../src/persistencia/consultar-estado.js";

describe("servidor MCP", () => {
    it("expone consultas y solo propone el pago sin escribir en la base", async () => {
        const consultas: string[] = [];
        const falsoPool = {
            async query(sql: string) {
                consultas.push(sql);
                if (sql.includes("FROM creditos WHERE")) return { rows: [{
                    id_credito: "CV-2026-0043", id_cliente: "CL-0001",
                    fecha_otorgamiento: "2026-08-06", capital_centavos: "300000",
                    plazo_meses: 6, tna_bps: 3000, reestructurado: false
                }] };
                if (sql.includes("FROM cuotas_credito")) return { rows: [{
                    numero_cuota: 1, fecha_vencimiento: "2026-09-06",
                    capital_centavos: "46965", interes_centavos: "7500"
                }] };
                if (sql.includes("FROM pagos WHERE")) return { rows: [] };
                if (sql.includes("FROM politicas_mora")) return { rows: [{
                    codigo: "POL-2024-01", tipo: "plana", parametros: { tna_bps: 2400 }
                }] };
                if (sql.includes("FROM configuracion_sistema")) return { rows: [{ valor: {} }] };
                throw new Error(`Consulta inesperada: ${sql}`);
            }
        } as unknown as Pool;
        const servidor = crearServidorMcp(falsoPool);
        const cliente = new Client({ name: "prueba", version: "1.0.0" }, { capabilities: {} });
        const [transporteCliente, transporteServidor] = InMemoryTransport.createLinkedPair();
        await servidor.connect(transporteServidor);
        await cliente.connect(transporteCliente);

        try {
            const herramientas = await cliente.listTools();
            expect(herramientas.tools.map(herramienta => herramienta.name)).toContain("proponer_pago");
            const resultado = await cliente.callTool({
                name: "proponer_pago",
                arguments: { idCredito: "CV-2026-0043", fechaCorte: "2026-10-31" }
            });
            expect(JSON.stringify(resultado)).toContain("REQUIERE_APROBACION_HUMANA");
            const nucleo = await consultarEstadoCredito(falsoPool, "CV-2026-0043", "2026-10-31");
            const texto = resultado.content.find(bloque => bloque.type === "text");
            expect(texto?.type === "text" ? JSON.parse(texto.text).monto_exacto_centavos : null)
                .toBe(nucleo?.estado.montoExigible.toString());
            const importeIncorrecto = await cliente.callTool({
                name: "proponer_pago",
                arguments: { idCredito: "CV-2026-0043", fechaCorte: "2026-10-31", montoCentavos: 50000 }
            });
            expect(JSON.stringify(importeIncorrecto)).toContain("MONTO_NO_EXACTO");
            expect(JSON.stringify(importeIncorrecto)).toContain("monto_correcto_centavos");
            const fechaInvalida = await cliente.callTool({
                name: "consultar_credito",
                arguments: { idCredito: "CV-2026-0043", fechaCorte: "2026-02-30" }
            });
            expect(JSON.stringify(fechaInvalida)).toContain("FECHA_INVALIDA");
            expect(consultas.every(sql => /^\s*SELECT/i.test(sql))).toBe(true);
        } finally {
            await cliente.close();
            await servidor.close();
        }
    });
});
