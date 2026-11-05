import { describe, expect, it } from "vitest";
import { reconstruirEstado, type PoliticaFuente } from "../src/persistencia/estado-cartera.js";

const cuota = [{
    numero_cuota: 2,
    fecha_vencimiento: "2026-03-01",
    capital_centavos: "72576",
    interes_centavos: "27886"
}];

const plana: PoliticaFuente = {
    tipo: "plana",
    parametros: { tna_bps: 2400 }
};

const escalonada: PoliticaFuente = {
    tipo: "escalonada",
    parametros: {
        tramos: [
            { ini: 1, fin: 30, bps: 1800 },
            { ini: 31, fin: 60, bps: 2400 },
            { ini: 61, fin: 90, bps: 3000 },
            { ini: 91, fin: 120, bps: 3600 }
        ]
    },
    gastoCentavos: 2500n,
    gastoDia: 31
};

describe("reconstrucción de una cuota a fecha de corte", () => {
    it("reproduce la mora plana de Q7.26 a 15 días", () => {
        const estado = reconstruirEstado(cuota, [], plana, "2026-03-16");
        expect(estado.proximaCuota?.moraPendiente).toBe(726n);
        expect(estado.montoExigible).toBe(101188n);
    });

    it("reproduce el total escalonado de Q1,047.76 a 45 días", () => {
        const estado = reconstruirEstado(cuota, [], escalonada, "2026-04-15");
        expect(estado.proximaCuota?.moraPendiente).toBe(1814n);
        expect(estado.proximaCuota?.gastosPendientes).toBe(2500n);
        expect(estado.montoExigible).toBe(104776n);
    });

    it("marca incobrable después de 120 días y detiene la mora", () => {
        const dia121 = reconstruirEstado(cuota, [], escalonada, "2026-06-30");
        const dia130 = reconstruirEstado(cuota, [], escalonada, "2026-07-09");
        expect(dia121.incobrable).toBe(true);
        expect(dia130.proximaCuota?.moraPendiente).toBe(dia121.proximaCuota?.moraPendiente);
    });

    it("aplica un pago exacto según la prelación", () => {
        const estado = reconstruirEstado(cuota, [{
            id: "1", fecha: "2026-03-16", monto_centavos: "101188"
        }], plana, "2026-03-16");
        expect(estado.aplicaciones[0]).toMatchObject({
            gastos: 0n,
            moratorio: 726n,
            corriente: 27886n,
            capital: 72576n,
            excedente: 0n
        });
        expect(estado.saldoCapital).toBe(0n);
        expect(estado.proximaCuota).toBeNull();
    });
});
