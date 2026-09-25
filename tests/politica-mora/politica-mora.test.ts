import { describe, expect, it } from "vitest";

import { Dinero } from "../../src/dominio/dinero.js";
import { PoliticaMoraEscalonada } from "../../src/dominio/politica-mora/politica-escalonada.js";
import { PoliticaMoraPlana } from "../../src/dominio/politica-mora/politica-plana.js";
import { PrelacionPago } from "../../src/dominio/prelacion-pago.js";
import { GastoGestionCobro } from "../../src/dominio/politica-mora/gasto-gestion-cobro.js";

// Cuota 2 del caso de referencia del Proyecto 1:
// capital en mora Q725.76, interés corriente Q278.86.
const CAPITAL_EN_MORA =
    Dinero.desdeQuetzales("725.76");

const INTERES_CORRIENTE_CUOTA_2 =
    Dinero.desdeQuetzales("278.86");

describe("PoliticaMoraEscalonada - casos oráculo", () => {

    const politica = new PoliticaMoraEscalonada();

    it("M-1: 15 días de atraso (solo Mora 1) -> Q5.44", () => {

        const resultado =
            politica.calcularInteresMoratorio({
                capitalEnMora: CAPITAL_EN_MORA,
                diasAtraso: 15
            });

        expect(resultado.aDecimal()).toBe("5.44");
    });

    it("M-2: 45 días de atraso (Mora 1 completo + Mora 2 parcial) -> Q18.14", () => {

        const resultado =
            politica.calcularInteresMoratorio({
                capitalEnMora: CAPITAL_EN_MORA,
                diasAtraso: 45
            });

        expect(resultado.aDecimal()).toBe("18.14");
    });

    it("M-3: 100 días de atraso (los cuatro tramos) -> Q50.80", () => {

        const resultado =
            politica.calcularInteresMoratorio({
                capitalEnMora: CAPITAL_EN_MORA,
                diasAtraso: 100
            });

        expect(resultado.aDecimal()).toBe("50.80");
    });

    it("M-4: 120 días de atraso (frontera con incobrable) -> Q65.32", () => {

        const resultado =
            politica.calcularInteresMoratorio({
                capitalEnMora: CAPITAL_EN_MORA,
                diasAtraso: 120
            });

        expect(resultado.aDecimal()).toBe("65.32");
    });

    it("rechaza más de 120 días (a partir de ahí el crédito es incobrable)", () => {

        expect(() => {
            politica.calcularInteresMoratorio({
                capitalEnMora: CAPITAL_EN_MORA,
                diasAtraso: 121
            });
        }).toThrow();
    });

    it("redondea una sola vez al final, no tramo por tramo (7.3)", () => {

        const resultado =
            politica.calcularInteresMoratorio({
                capitalEnMora: CAPITAL_EN_MORA,
                diasAtraso: 45
            });

        expect(resultado.aDecimal()).not.toBe("18.15");
        expect(resultado.aDecimal()).toBe("18.14");
    });

    it("equivalencia en el primer tramo: 1-30 días es igual a una política plana al 18% (7.9)", () => {

        const resultadoEscalonada =
            politica.calcularInteresMoratorio({
                capitalEnMora: CAPITAL_EN_MORA,
                diasAtraso: 20
            });

        // 725.76 * (0.18/360) * 20 = 7.2576 -> Q7.26
        expect(resultadoEscalonada.aDecimal()).toBe("7.26");
    });
});

describe("PoliticaMoraPlana - CP-03 y coexistencia con la escalonada", () => {

    it("CP-03: 45 días con política plana 24% (créditos otorgados antes del 1 oct 2026) -> Q21.77", () => {

        const politicaPlana = new PoliticaMoraPlana();

        const resultado =
            politicaPlana.calcularInteresMoratorio({
                capitalEnMora: CAPITAL_EN_MORA,
                diasAtraso: 45
            });

        expect(resultado.aDecimal()).toBe("21.77");
    });

    it("7.6: la misma cuota a 45 días da Q21.77 con la plana y Q18.14 con la escalonada", () => {

        const plana = new PoliticaMoraPlana();
        const escalonada = new PoliticaMoraEscalonada();

        const resultadoPlana =
            plana.calcularInteresMoratorio({
                capitalEnMora: CAPITAL_EN_MORA,
                diasAtraso: 45
            });

        const resultadoEscalonada =
            escalonada.calcularInteresMoratorio({
                capitalEnMora: CAPITAL_EN_MORA,
                diasAtraso: 45
            });

        expect(resultadoPlana.aDecimal()).toBe("21.77");
        expect(resultadoEscalonada.aDecimal()).toBe("18.14");
    });
});

describe("M-5: total adeudado de la cuota 2 a 45 días de atraso", () => {

    it("debe sumar gastos + moratorio + interés corriente + capital = Q1,047.76", () => {

        const escalonada = new PoliticaMoraEscalonada();
        const gastoGestion = new GastoGestionCobro();

        const moratorio =
            escalonada.calcularInteresMoratorio({
                capitalEnMora: CAPITAL_EN_MORA,
                diasAtraso: 45
            });

        const gastos =
            gastoGestion.calcular(45, false);

        const totalAdeudado =
            gastos
                .sumar(moratorio)
                .sumar(INTERES_CORRIENTE_CUOTA_2)
                .sumar(CAPITAL_EN_MORA);

        expect(gastos.aDecimal()).toBe("25.00");
        expect(moratorio.aDecimal()).toBe("18.14");
        expect(totalAdeudado.aDecimal()).toBe("1047.76");
    });

    it("con 15 días de atraso (Mora 1, sin gasto) el total adeudado es Q1,010.06", () => {

        const escalonada = new PoliticaMoraEscalonada();
        const gastoGestion = new GastoGestionCobro();

        const moratorio =
            escalonada.calcularInteresMoratorio({
                capitalEnMora: CAPITAL_EN_MORA,
                diasAtraso: 15
            });

        const gastos =
            gastoGestion.calcular(15, false);

        const totalAdeudado =
            gastos
                .sumar(moratorio)
                .sumar(INTERES_CORRIENTE_CUOTA_2)
                .sumar(CAPITAL_EN_MORA);

        expect(gastos.aDecimal()).toBe("0.00");
        expect(totalAdeudado.aDecimal()).toBe("1010.06");
    });

    it("la prelación aplica primero a gastos, luego moratorio, luego corriente, luego capital", () => {

        const prelacion = new PrelacionPago();

        const aplicacion =
            prelacion.aplicar(
                Dinero.desdeQuetzales("1047.76"),
                {
                    gastos: Dinero.desdeQuetzales("25.00"),
                    interesMoratorio: Dinero.desdeQuetzales("18.14"),
                    interesCorriente: INTERES_CORRIENTE_CUOTA_2,
                    capital: CAPITAL_EN_MORA
                }
            );

        expect(aplicacion.gastos.aDecimal()).toBe("25.00");
        expect(aplicacion.interesMoratorio.aDecimal()).toBe("18.14");
        expect(aplicacion.interesCorriente.aDecimal()).toBe("278.86");
        expect(aplicacion.capital.aDecimal()).toBe("725.76");
        expect(aplicacion.excedente.aDecimal()).toBe("0.00");
    });
});
