import { describe, expect, it } from "vitest";
import { Decimal } from "decimal.js";

import { Dinero } from "../src/dominio/dinero.js";
import {
    CalculadoraMora
} from "../src/dominio/calculadora-mora.js";

describe("CalculadoraMora", () => {

    it("debe calcular interés moratorio sobre capital vencido", () => {

        const calculadora =
            new CalculadoraMora();

        const resultado =
            calculadora.calcular({
                capitalVencido:
                    Dinero.desdeQuetzales("1000.00"),
                tasaMoraAnual:
                    new Decimal("0.265"),
                diasMora: 10
            });

        expect(
            resultado.aDecimal()
        ).toBe("7.26");
    });

    it("debe permitir utilizar una base de días personalizada", () => {

        const calculadora =
            new CalculadoraMora();

        const resultado =
            calculadora.calcular({
                capitalVencido:
                    Dinero.desdeQuetzales("1000.00"),
                tasaMoraAnual:
                    new Decimal("0.36"),
                diasMora: 10,
                diasBase: 360
            });

        expect(
            resultado.aDecimal()
        ).toBe("10.00");
    });

    it("debe redondear el resultado a centavos", () => {

        const calculadora =
            new CalculadoraMora();

        const resultado =
            calculadora.calcular({
                capitalVencido:
                    Dinero.desdeQuetzales("1000.00"),
                tasaMoraAnual:
                    new Decimal("0.10"),
                diasMora: 1
            });

        expect(
            resultado.aDecimal()
        ).toBe("0.27");
    });

    it("debe rechazar capital vencido igual a cero", () => {

        const calculadora =
            new CalculadoraMora();

        expect(() => {
            calculadora.calcular({
                capitalVencido:
                    Dinero.desdeQuetzales("0.00"),
                tasaMoraAnual:
                    new Decimal("0.265"),
                diasMora: 10
            });
        }).toThrow(
            "El capital vencido debe ser mayor que cero"
        );
    });

    it("debe rechazar capital vencido negativo", () => {

        const calculadora =
            new CalculadoraMora();

        expect(() => {
            calculadora.calcular({
                capitalVencido:
                    Dinero.desdeQuetzales("-100.00"),
                tasaMoraAnual:
                    new Decimal("0.265"),
                diasMora: 10
            });
        }).toThrow(
            "El capital vencido debe ser mayor que cero"
        );
    });

    it("debe rechazar tasa de mora igual a cero", () => {

        const calculadora =
            new CalculadoraMora();

        expect(() => {
            calculadora.calcular({
                capitalVencido:
                    Dinero.desdeQuetzales("1000.00"),
                tasaMoraAnual:
                    new Decimal("0"),
                diasMora: 10
            });
        }).toThrow(
            "La tasa de mora anual debe ser mayor que cero"
        );
    });

    it("debe rechazar días de mora igual a cero", () => {

        const calculadora =
            new CalculadoraMora();

        expect(() => {
            calculadora.calcular({
                capitalVencido:
                    Dinero.desdeQuetzales("1000.00"),
                tasaMoraAnual:
                    new Decimal("0.265"),
                diasMora: 0
            });
        }).toThrow(
            "Los días de mora deben ser un entero mayor que cero"
        );
    });

    it("debe rechazar una base de días inválida", () => {

        const calculadora =
            new CalculadoraMora();

        expect(() => {
            calculadora.calcular({
                capitalVencido:
                    Dinero.desdeQuetzales("1000.00"),
                tasaMoraAnual:
                    new Decimal("0.265"),
                diasMora: 10,
                diasBase: 0
            });
        }).toThrow(
            "La base de días debe ser un entero mayor que cero"
        );
    });

});