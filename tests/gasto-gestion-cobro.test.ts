import { describe, expect, it } from "vitest";

import { GastoGestionCobro } from "../src/dominio/politica-mora/gasto-gestion-cobro.js";

describe("CP-02: gasto de gestión de cobro", () => {

    const gasto = new GastoGestionCobro();

    it("no se cobra en Mora 1 (1-30 días)", () => {

        expect(gasto.calcular(15, false).aDecimal())
            .toBe("0.00");

        expect(gasto.calcular(30, false).aDecimal())
            .toBe("0.00");
    });

    it("se genera al entrar a Mora 2, día 31, por Q25.00", () => {

        expect(gasto.calcular(31, false).aDecimal())
            .toBe("25.00");
    });

    it("no se vuelve a generar al pasar de Mora 2 a Mora 3 o Vencido", () => {

        expect(gasto.calcular(75, true).aDecimal())
            .toBe("0.00");

        expect(gasto.calcular(100, true).aDecimal())
            .toBe("0.00");
    });

    it("reejecutar el cierre del mismo día no duplica el gasto (idempotencia, P1 6.10)", () => {

        const primeraEjecucion =
            gasto.calcular(31, false);

        const segundaEjecucion =
            gasto.calcular(31, true);

        expect(primeraEjecucion.aDecimal()).toBe("25.00");
        expect(segundaEjecucion.aDecimal()).toBe("0.00");
    });
});
