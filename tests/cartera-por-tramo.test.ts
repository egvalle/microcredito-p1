import { describe, expect, it } from "vitest";

import { Dinero } from "../src/dominio/dinero.js";
import {
    CalculadoraCarteraRiesgo,
    CreditoCartera
} from "../src/dominio/cartera.js";

const creditos: CreditoCartera[] = [
    {
        id: "C-001",
        saldoCapital: Dinero.desdeQuetzales("620000.00"),
        diasAtraso: 0,
        reestructurado: false,
        incobrable: false
    },
    {
        id: "C-002",
        saldoCapital: Dinero.desdeQuetzales("124000.00"),
        diasAtraso: 8,
        reestructurado: false,
        incobrable: false
    },
    {
        id: "C-003",
        saldoCapital: Dinero.desdeQuetzales("24000.00"),
        diasAtraso: 45,
        reestructurado: false,
        incobrable: false
    },
    {
        id: "C-004",
        saldoCapital: Dinero.desdeQuetzales("18000.00"),
        diasAtraso: 75,
        reestructurado: false,
        incobrable: false
    },
    {
        id: "C-005",
        saldoCapital: Dinero.desdeQuetzales("8000.00"),
        diasAtraso: 100,
        reestructurado: false,
        incobrable: false
    },
    {
        id: "C-006",
        saldoCapital: Dinero.desdeQuetzales("6000.00"),
        diasAtraso: 0,
        reestructurado: true,
        incobrable: false
    },
    {
        id: "C-007",
        saldoCapital: Dinero.desdeQuetzales("15000.00"),
        diasAtraso: 210,
        reestructurado: false,
        incobrable: true
    }
];

describe("CP-04.3: desglose de cartera en riesgo por tramo (7.8)", () => {

    const calculadora = new CalculadoraCarteraRiesgo();

    it("reproduce el oráculo de la sección 7.8", () => {

        const resultado =
            calculadora.calcularPorTramo(creditos);

        expect(resultado.carteraActiva.aDecimal())
            .toBe("800000.00");

        const porTramo = (tramo: string) =>
            resultado.desglose.find(
                fila => fila.tramo === tramo
            );

        expect(porTramo("MORA_1")?.saldoCapital.aDecimal())
            .toBe("0.00");
        expect(porTramo("MORA_1")?.porcentajeDeCarteraActiva.toFixed(2))
            .toBe("0.00");

        expect(porTramo("MORA_2")?.creditos)
            .toEqual(["C-003"]);
        expect(porTramo("MORA_2")?.saldoCapital.aDecimal())
            .toBe("24000.00");
        expect(porTramo("MORA_2")?.porcentajeDeCarteraActiva.toFixed(2))
            .toBe("3.00");

        expect(porTramo("MORA_3")?.creditos)
            .toEqual(["C-004"]);
        expect(porTramo("MORA_3")?.saldoCapital.aDecimal())
            .toBe("18000.00");
        expect(porTramo("MORA_3")?.porcentajeDeCarteraActiva.toFixed(2))
            .toBe("2.25");

        expect(porTramo("VENCIDO")?.creditos)
            .toEqual(["C-005"]);
        expect(porTramo("VENCIDO")?.saldoCapital.aDecimal())
            .toBe("8000.00");
        expect(porTramo("VENCIDO")?.porcentajeDeCarteraActiva.toFixed(2))
            .toBe("1.00");

        expect(porTramo("REESTRUCTURADO")?.creditos)
            .toEqual(["C-006"]);
        expect(porTramo("REESTRUCTURADO")?.saldoCapital.aDecimal())
            .toBe("6000.00");
        expect(porTramo("REESTRUCTURADO")?.porcentajeDeCarteraActiva.toFixed(2))
            .toBe("0.75");
    });

    it("la suma de los porcentajes por tramo es igual al porcentaje total, sin errores de redondeo (7.9)", () => {

        const resultado =
            calculadora.calcularPorTramo(creditos);

        expect(resultado.totalEnRiesgo.aDecimal())
            .toBe("56000.00");

        expect(resultado.porcentajeTotalEnRiesgo.toFixed(2))
            .toBe("7.00");

        const sumaPorcentajes = resultado.desglose.reduce(
            (total, fila) =>
                total + fila.porcentajeDeCarteraActiva.toNumber(),
            0
        );

        expect(sumaPorcentajes).toBeCloseTo(7.00, 2);
    });

    it("C-007 (incobrable) no cuenta en la cartera activa ni en el desglose", () => {

        const resultado =
            calculadora.calcularPorTramo(creditos);

        const idsEnDesglose =
            resultado.desglose.flatMap(fila => fila.creditos);

        expect(idsEnDesglose).not.toContain("C-007");
    });

    it("cartera en mora (todo atraso >= 1 día) sigue siendo distinta de cartera en riesgo", () => {

        // Cartera en mora = C-002 + C-003 + C-004 + C-005 = 174,000.00
        // (21.75% de 800,000.00). Cartera en riesgo (7.8) excluye
        // C-002 porque solo tiene 8 días (Mora 1, no entra a riesgo).
        const totalEnMora = creditos
            .filter(c => !c.incobrable && c.diasAtraso >= 1)
            .reduce(
                (total, c) => total.sumar(c.saldoCapital),
                Dinero.desdeCentavos(0n)
            );

        expect(totalEnMora.aDecimal()).toBe("174000.00");

        const resultado = calculadora.calcularPorTramo(creditos);

        expect(
            resultado.totalEnRiesgo.igualA(totalEnMora)
        ).toBe(false);
    });
});
