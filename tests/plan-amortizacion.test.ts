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

    it("debe reproducir exactamente las 12 filas del caso de referencia 6.4.1", () => {

        const estrategia =
            new AmortizacionFrancesa();

        const plan =
            estrategia.generar({
                capital:
                    Dinero.desdeQuetzales("10000.00"),
                tasaNominalAnual:
                    new Decimal("0.36"),
                numeroCuotas: 12
            });

        const cuotas =
            plan.obtenerCuotas();

        const tablaEsperada = [
            {
                numero: 1,
                saldoInicial: "10000.00",
                cuota: "1004.62",
                interes: "300.00",
                capital: "704.62",
                saldoFinal: "9295.38"
            },
            {
                numero: 2,
                saldoInicial: "9295.38",
                cuota: "1004.62",
                interes: "278.86",
                capital: "725.76",
                saldoFinal: "8569.62"
            },
            {
                numero: 3,
                saldoInicial: "8569.62",
                cuota: "1004.62",
                interes: "257.09",
                capital: "747.53",
                saldoFinal: "7822.09"
            },
            {
                numero: 4,
                saldoInicial: "7822.09",
                cuota: "1004.62",
                interes: "234.66",
                capital: "769.96",
                saldoFinal: "7052.13"
            },
            {
                numero: 5,
                saldoInicial: "7052.13",
                cuota: "1004.62",
                interes: "211.56",
                capital: "793.06",
                saldoFinal: "6259.07"
            },
            {
                numero: 6,
                saldoInicial: "6259.07",
                cuota: "1004.62",
                interes: "187.77",
                capital: "816.85",
                saldoFinal: "5442.22"
            },
            {
                numero: 7,
                saldoInicial: "5442.22",
                cuota: "1004.62",
                interes: "163.27",
                capital: "841.35",
                saldoFinal: "4600.87"
            },
            {
                numero: 8,
                saldoInicial: "4600.87",
                cuota: "1004.62",
                interes: "138.03",
                capital: "866.59",
                saldoFinal: "3734.28"
            },
            {
                numero: 9,
                saldoInicial: "3734.28",
                cuota: "1004.62",
                interes: "112.03",
                capital: "892.59",
                saldoFinal: "2841.69"
            },
            {
                numero: 10,
                saldoInicial: "2841.69",
                cuota: "1004.62",
                interes: "85.25",
                capital: "919.37",
                saldoFinal: "1922.32"
            },
            {
                numero: 11,
                saldoInicial: "1922.32",
                cuota: "1004.62",
                interes: "57.67",
                capital: "946.95",
                saldoFinal: "975.37"
            },
            {
                numero: 12,
                saldoInicial: "975.37",
                cuota: "1004.63",
                interes: "29.26",
                capital: "975.37",
                saldoFinal: "0.00"
            }
        ];

        expect(cuotas).toHaveLength(12);

        cuotas.forEach(
            (cuota, indice) => {

                const esperada =
                    tablaEsperada[indice];

                if (!esperada) {
                    throw new Error(
                        `No existe información esperada para la cuota ${indice + 1}`
                    );
                }

                expect(cuota.numero)
                    .toBe(esperada.numero);

                expect(cuota.saldoInicial.aDecimal())
                    .toBe(esperada.saldoInicial);

                expect(cuota.cuota.aDecimal())
                    .toBe(esperada.cuota);

                expect(cuota.interes.aDecimal())
                    .toBe(esperada.interes);

                expect(cuota.capital.aDecimal())
                    .toBe(esperada.capital);

                expect(cuota.saldoFinal.aDecimal())
                    .toBe(esperada.saldoFinal);
            }
        );
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

    it("debe hacer que la suma de amortizaciones sea exactamente igual al capital desembolsado", () => {

        const estrategia =
            new AmortizacionFrancesa();

        const capital =
            Dinero.desdeQuetzales(
                "10000.00"
            );

        const plan =
            estrategia.generar({
                capital,
                tasaNominalAnual:
                    new Decimal("0.36"),
                numeroCuotas: 12
            });

        const totalAmortizado =
            plan
                .obtenerCuotas()
                .reduce(
                    (acumulado, cuota) =>
                        acumulado +
                        cuota.capital.obtenerCentavos(),
                    0n
                );

        expect(totalAmortizado)
            .toBe(
                capital.obtenerCentavos()
            );

        expect(totalAmortizado)
            .toBe(1000000n);

        expect(
            plan
                .obtenerUltimaCuota()
                .saldoFinal
                .obtenerCentavos()
        ).toBe(0n);
    });

});