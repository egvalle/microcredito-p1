import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import { Dinero } from "../src/dominio/dinero.js";

import {
    AmortizacionFrancesa
} from "../src/dominio/plan-amortizacion.js";

describe("AmortizacionFrancesa", () => {

    it("debe generar 12 cuotas", () => {

        const estrategia =
            new AmortizacionFrancesa();

        const plan = estrategia.generar({
            capital:
                Dinero.desdeQuetzales("10000.00"),
            tasaNominalAnual:
                new Decimal("0.36"),
            numeroCuotas: 12
        });

        expect(
            plan.obtenerCuotas()
        ).toHaveLength(12);
    });

    it(
        "debe calcular correctamente el interés de la primera cuota",
        () => {

            const estrategia =
                new AmortizacionFrancesa();

            const plan = estrategia.generar({
                capital:
                    Dinero.desdeQuetzales("10000.00"),
                tasaNominalAnual:
                    new Decimal("0.36"),
                numeroCuotas: 12
            });

            const primera =
                plan.obtenerCuotas()[0];

            expect(primera).toBeDefined();

            expect(
                primera?.saldoInicial.aDecimal()
            ).toBe("10000.00");

            expect(
                primera?.interes.aDecimal()
            ).toBe("300.00");
        }
    );

    it("debe terminar con saldo final cero", () => {

        const estrategia =
            new AmortizacionFrancesa();

        const plan = estrategia.generar({
            capital:
                Dinero.desdeQuetzales("10000.00"),
            tasaNominalAnual:
                new Decimal("0.36"),
            numeroCuotas: 12
        });

        const ultima =
            plan.obtenerUltimaCuota();

        expect(
            ultima.saldoFinal.aDecimal()
        ).toBe("0.00");
    });

    it("debe generar una última cuota ajustada", () => {

        const estrategia =
            new AmortizacionFrancesa();

        const plan = estrategia.generar({
            capital:
                Dinero.desdeQuetzales("10000.00"),
            tasaNominalAnual:
                new Decimal("0.36"),
            numeroCuotas: 12
        });

        const ultima =
            plan.obtenerUltimaCuota();

        expect(
            ultima.cuota.aDecimal()
        ).toBe("1004.63");
    });

    it("debe rechazar capital igual a cero", () => {

        const estrategia =
            new AmortizacionFrancesa();

        expect(() => {
            estrategia.generar({
                capital:
                    Dinero.desdeQuetzales("0.00"),
                tasaNominalAnual:
                    new Decimal("0.36"),
                numeroCuotas: 12
            });
        }).toThrow(
            "El capital debe ser mayor que cero"
        );
    });

    it("debe rechazar una tasa igual a cero", () => {

        const estrategia =
            new AmortizacionFrancesa();

        expect(() => {
            estrategia.generar({
                capital:
                    Dinero.desdeQuetzales("10000.00"),
                tasaNominalAnual:
                    new Decimal("0"),
                numeroCuotas: 12
            });
        }).toThrow(
            "La tasa nominal anual debe ser mayor que cero"
        );
    });

    it(
        "debe rechazar un número de cuotas inválido",
        () => {

            const estrategia =
                new AmortizacionFrancesa();

            expect(() => {
                estrategia.generar({
                    capital:
                        Dinero.desdeQuetzales("10000.00"),
                    tasaNominalAnual:
                        new Decimal("0.36"),
                    numeroCuotas: 0
                });
            }).toThrow(
                "El número de cuotas debe ser un entero mayor que cero"
            );
        }
    );

});