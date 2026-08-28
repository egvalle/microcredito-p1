import { describe, expect, it } from "vitest";

import { Dinero } from "../src/dominio/dinero.js";

import {
    CalculadoraCarteraRiesgo,
    ClasificadorMora,
    CreditoCartera
} from "../src/dominio/cartera.js";

describe("ClasificadorMora", () => {

    const clasificador =
        new ClasificadorMora();

    it("debe clasificar cero días como sin mora", () => {

        expect(
            clasificador.clasificar(0)
        ).toBe("SIN_MORA");
    });

    it("debe clasificar Mora 1 entre 1 y 30 días", () => {

        expect(
            clasificador.clasificar(1)
        ).toBe("MORA_1");

        expect(
            clasificador.clasificar(30)
        ).toBe("MORA_1");
    });

    it("debe clasificar Mora 2 entre 31 y 60 días", () => {

        expect(
            clasificador.clasificar(31)
        ).toBe("MORA_2");

        expect(
            clasificador.clasificar(60)
        ).toBe("MORA_2");
    });

    it("debe clasificar Mora 3 entre 61 y 90 días", () => {

        expect(
            clasificador.clasificar(61)
        ).toBe("MORA_3");

        expect(
            clasificador.clasificar(90)
        ).toBe("MORA_3");
    });

    it("debe clasificar como vencido entre 91 y 120 días", () => {

        expect(
            clasificador.clasificar(91)
        ).toBe("VENCIDO");

        expect(
            clasificador.clasificar(120)
        ).toBe("VENCIDO");
    });

    it("debe clasificar más de 120 días como incobrable", () => {

        expect(
            clasificador.clasificar(121)
        ).toBe("INCOBRABLE");
    });

    it("debe permitir que el tramo disminuya al reducir los días de atraso", () => {

        expect(
            clasificador.clasificar(45)
        ).toBe("MORA_2");

        expect(
            clasificador.clasificar(10)
        ).toBe("MORA_1");

        expect(
            clasificador.clasificar(0)
        ).toBe("SIN_MORA");
    });

    it("debe rechazar días de atraso negativos", () => {

        expect(() => {
            clasificador.clasificar(-1);
        }).toThrow(
            "Los días de atraso deben ser un entero mayor o igual a cero"
        );
    });

});

describe("CalculadoraCarteraRiesgo", () => {

    const crearCarteraReferencia =
        (): CreditoCartera[] => [

            {
                id: "C-001",
                saldoCapital:
                    Dinero.desdeQuetzales("620000.00"),
                diasAtraso: 0,
                reestructurado: false,
                incobrable: false
            },

            {
                id: "C-002",
                saldoCapital:
                    Dinero.desdeQuetzales("124000.00"),
                diasAtraso: 8,
                reestructurado: false,
                incobrable: false
            },

            {
                id: "C-003",
                saldoCapital:
                    Dinero.desdeQuetzales("24000.00"),
                diasAtraso: 45,
                reestructurado: false,
                incobrable: false
            },

            {
                id: "C-004",
                saldoCapital:
                    Dinero.desdeQuetzales("18000.00"),
                diasAtraso: 75,
                reestructurado: false,
                incobrable: false
            },

            {
                id: "C-005",
                saldoCapital:
                    Dinero.desdeQuetzales("8000.00"),
                diasAtraso: 100,
                reestructurado: false,
                incobrable: false
            },

            {
                id: "C-006",
                saldoCapital:
                    Dinero.desdeQuetzales("6000.00"),
                diasAtraso: 0,
                reestructurado: true,
                incobrable: false
            },

            {
                id: "C-007",
                saldoCapital:
                    Dinero.desdeQuetzales("15000.00"),
                diasAtraso: 210,
                reestructurado: false,
                incobrable: true
            }
        ];

    it("debe calcular el caso de referencia con 7.00 por ciento de cartera en riesgo", () => {

        const calculadora =
            new CalculadoraCarteraRiesgo();

        const resultado =
            calculadora.calcular(
                crearCarteraReferencia()
            );

        expect(
            resultado.carteraActiva.aDecimal()
        ).toBe("800000.00");

        expect(
            resultado.capitalEnRiesgo.aDecimal()
        ).toBe("56000.00");

        expect(
            resultado.porcentajeRiesgo.toFixed(2)
        ).toBe("7.00");
    });

    it("debe incluir créditos reestructurados aunque estén al día", () => {

        const calculadora =
            new CalculadoraCarteraRiesgo();

        const resultado =
            calculadora.calcular([
                {
                    id: "R-001",
                    saldoCapital:
                        Dinero.desdeQuetzales("6000.00"),
                    diasAtraso: 0,
                    reestructurado: true,
                    incobrable: false
                }
            ]);

        expect(
            resultado.capitalEnRiesgo.aDecimal()
        ).toBe("6000.00");

        expect(
            resultado.porcentajeRiesgo.toFixed(2)
        ).toBe("100.00");
    });

    it("no debe considerar en riesgo créditos con hasta 30 días de atraso", () => {

        const calculadora =
            new CalculadoraCarteraRiesgo();

        const resultado =
            calculadora.calcular([
                {
                    id: "C-001",
                    saldoCapital:
                        Dinero.desdeQuetzales("10000.00"),
                    diasAtraso: 30,
                    reestructurado: false,
                    incobrable: false
                }
            ]);

        expect(
            resultado.capitalEnRiesgo.aDecimal()
        ).toBe("0.00");

        expect(
            resultado.porcentajeRiesgo.toFixed(2)
        ).toBe("0.00");
    });

    it("debe incluir el saldo completo de capital cuando supera 30 días", () => {

        const calculadora =
            new CalculadoraCarteraRiesgo();

        const resultado =
            calculadora.calcular([
                {
                    id: "C-001",
                    saldoCapital:
                        Dinero.desdeQuetzales("24000.00"),
                    diasAtraso: 45,
                    reestructurado: false,
                    incobrable: false
                }
            ]);

        expect(
            resultado.capitalEnRiesgo.aDecimal()
        ).toBe("24000.00");
    });

    it("debe excluir los créditos incobrables de la cartera activa", () => {

        const calculadora =
            new CalculadoraCarteraRiesgo();

        const resultado =
            calculadora.calcular([
                {
                    id: "ACTIVO",
                    saldoCapital:
                        Dinero.desdeQuetzales("10000.00"),
                    diasAtraso: 0,
                    reestructurado: false,
                    incobrable: false
                },
                {
                    id: "INCOBRABLE",
                    saldoCapital:
                        Dinero.desdeQuetzales("5000.00"),
                    diasAtraso: 150,
                    reestructurado: false,
                    incobrable: true
                }
            ]);

        expect(
            resultado.carteraActiva.aDecimal()
        ).toBe("10000.00");
    });

    it("debe reproducir el caso de 6.06 por ciento al declarar C-005 incobrable", () => {

        const cartera =
            crearCarteraReferencia();

        const creditoC005 =
            cartera.find(
                credito =>
                    credito.id === "C-005"
            );

        if (!creditoC005) {
            throw new Error(
                "No se encontró C-005"
            );
        }

        creditoC005.incobrable = true;

        const calculadora =
            new CalculadoraCarteraRiesgo();

        const resultado =
            calculadora.calcular(cartera);

        expect(
            resultado.carteraActiva.aDecimal()
        ).toBe("792000.00");

        expect(
            resultado.capitalEnRiesgo.aDecimal()
        ).toBe("48000.00");

        expect(
            resultado.porcentajeRiesgo.toFixed(2)
        ).toBe("6.06");
    });

    it("debe mantener la proporción de riesgo entre cero y uno", () => {

        const calculadora =
            new CalculadoraCarteraRiesgo();

        const resultado =
            calculadora.calcular(
                crearCarteraReferencia()
            );

        expect(
            resultado.proporcionRiesgo
                .greaterThanOrEqualTo(0)
        ).toBe(true);

        expect(
            resultado.proporcionRiesgo
                .lessThanOrEqualTo(1)
        ).toBe(true);
    });

    it("debe rechazar una cartera vacía", () => {

        const calculadora =
            new CalculadoraCarteraRiesgo();

        expect(() => {
            calculadora.calcular([]);
        }).toThrow(
            "La cartera debe contener al menos un crédito"
        );
    });

});