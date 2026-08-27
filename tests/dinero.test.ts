import { describe, expect, it } from "vitest";
import { Dinero } from "../src/dominio/dinero.js";

describe("Dinero", () => {

    it("debe crear un importe en quetzales", () => {

        const dinero = Dinero.desdeQuetzales("100.25");

        expect(dinero.aDecimal()).toBe("100.25");
        expect(dinero.obtenerCentavos()).toBe(10025n);
    });

    it("debe sumar dos importes de la misma moneda", () => {

        const a = Dinero.desdeQuetzales("100.25");
        const b = Dinero.desdeQuetzales("50.50");

        const resultado = a.sumar(b);

        expect(resultado.aDecimal()).toBe("150.75");
    });

    it("debe restar dos importes", () => {

        const a = Dinero.desdeQuetzales("100.00");
        const b = Dinero.desdeQuetzales("25.50");

        const resultado = a.restar(b);

        expect(resultado.aDecimal()).toBe("74.50");
    });

    it("debe mantener inmutabilidad", () => {

        const original = Dinero.desdeQuetzales("100.00");
        const otro = Dinero.desdeQuetzales("50.00");

        const resultado = original.sumar(otro);

        expect(original.aDecimal()).toBe("100.00");
        expect(resultado.aDecimal()).toBe("150.00");
    });

    it("debe detectar un importe igual a cero", () => {

        const dinero = Dinero.desdeQuetzales("0.00");

        expect(dinero.esCero()).toBe(true);
    });

    it("debe detectar un importe negativo", () => {

        const dinero = Dinero.desdeQuetzales("-10.00");

        expect(dinero.esNegativo()).toBe(true);
    });

    it("no debe permitir operar monedas diferentes", () => {

        const quetzales = Dinero.desdeDecimal("100.00", "GTQ");
        const dolares = Dinero.desdeDecimal("10.00", "USD");

        expect(() => {
            quetzales.sumar(dolares);
        }).toThrow(
            "No se pueden operar monedas diferentes: GTQ y USD"
        );
    });

    it("debe rechazar un importe con más de dos decimales", () => {

        expect(() => {
            Dinero.desdeQuetzales("100.256");
        }).toThrow();
    });

});