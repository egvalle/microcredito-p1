import { describe, expect, it } from "vitest";

import { Dinero } from "../src/dominio/dinero.js";

import {
    DeudaPago,
    PrelacionPago
} from "../src/dominio/prelacion-pago.js";

describe("PrelacionPago", () => {

    const crearDeuda = (): DeudaPago => ({
        gastos:
            Dinero.desdeQuetzales("50.00"),

        interesMoratorio:
            Dinero.desdeQuetzales("25.00"),

        interesCorriente:
            Dinero.desdeQuetzales("100.00"),

        capital:
            Dinero.desdeQuetzales("1000.00")
    });

    it("debe aplicar primero a gastos", () => {

        const prelacion =
            new PrelacionPago();

        const resultado =
            prelacion.aplicar(
                Dinero.desdeQuetzales("30.00"),
                crearDeuda()
            );

        expect(
            resultado.gastos.aDecimal()
        ).toBe("30.00");

        expect(
            resultado.interesMoratorio.aDecimal()
        ).toBe("0.00");

        expect(
            resultado.interesCorriente.aDecimal()
        ).toBe("0.00");

        expect(
            resultado.capital.aDecimal()
        ).toBe("0.00");

        expect(
            resultado.excedente.aDecimal()
        ).toBe("0.00");
    });

    it("debe continuar con interés moratorio después de cubrir gastos", () => {

        const prelacion =
            new PrelacionPago();

        const resultado =
            prelacion.aplicar(
                Dinero.desdeQuetzales("60.00"),
                crearDeuda()
            );

        expect(
            resultado.gastos.aDecimal()
        ).toBe("50.00");

        expect(
            resultado.interesMoratorio.aDecimal()
        ).toBe("10.00");

        expect(
            resultado.interesCorriente.aDecimal()
        ).toBe("0.00");

        expect(
            resultado.capital.aDecimal()
        ).toBe("0.00");
    });

    it("debe respetar toda la prelación del pago", () => {

        const prelacion =
            new PrelacionPago();

        const resultado =
            prelacion.aplicar(
                Dinero.desdeQuetzales("200.00"),
                crearDeuda()
            );

        expect(
            resultado.gastos.aDecimal()
        ).toBe("50.00");

        expect(
            resultado.interesMoratorio.aDecimal()
        ).toBe("25.00");

        expect(
            resultado.interesCorriente.aDecimal()
        ).toBe("100.00");

        expect(
            resultado.capital.aDecimal()
        ).toBe("25.00");

        expect(
            resultado.excedente.aDecimal()
        ).toBe("0.00");
    });

    it("debe aplicar un pago que cubre exactamente toda la deuda", () => {

        const prelacion =
            new PrelacionPago();

        const resultado =
            prelacion.aplicar(
                Dinero.desdeQuetzales("1175.00"),
                crearDeuda()
            );

        expect(
            resultado.gastos.aDecimal()
        ).toBe("50.00");

        expect(
            resultado.interesMoratorio.aDecimal()
        ).toBe("25.00");

        expect(
            resultado.interesCorriente.aDecimal()
        ).toBe("100.00");

        expect(
            resultado.capital.aDecimal()
        ).toBe("1000.00");

        expect(
            resultado.excedente.aDecimal()
        ).toBe("0.00");
    });

    it("debe conservar como excedente el pago superior a la deuda", () => {

        const prelacion =
            new PrelacionPago();

        const resultado =
            prelacion.aplicar(
                Dinero.desdeQuetzales("1200.00"),
                crearDeuda()
            );

        expect(
            resultado.gastos.aDecimal()
        ).toBe("50.00");

        expect(
            resultado.interesMoratorio.aDecimal()
        ).toBe("25.00");

        expect(
            resultado.interesCorriente.aDecimal()
        ).toBe("100.00");

        expect(
            resultado.capital.aDecimal()
        ).toBe("1000.00");

        expect(
            resultado.excedente.aDecimal()
        ).toBe("25.00");
    });

    it("debe saltar conceptos cuyo saldo sea cero", () => {

        const prelacion =
            new PrelacionPago();

        const deuda: DeudaPago = {
            gastos:
                Dinero.desdeQuetzales("0.00"),

            interesMoratorio:
                Dinero.desdeQuetzales("0.00"),

            interesCorriente:
                Dinero.desdeQuetzales("100.00"),

            capital:
                Dinero.desdeQuetzales("1000.00")
        };

        const resultado =
            prelacion.aplicar(
                Dinero.desdeQuetzales("150.00"),
                deuda
            );

        expect(
            resultado.gastos.aDecimal()
        ).toBe("0.00");

        expect(
            resultado.interesMoratorio.aDecimal()
        ).toBe("0.00");

        expect(
            resultado.interesCorriente.aDecimal()
        ).toBe("100.00");

        expect(
            resultado.capital.aDecimal()
        ).toBe("50.00");
    });

    it("debe rechazar un pago igual a cero", () => {

        const prelacion =
            new PrelacionPago();

        expect(() => {
            prelacion.aplicar(
                Dinero.desdeQuetzales("0.00"),
                crearDeuda()
            );
        }).toThrow(
            "El pago debe ser mayor que cero"
        );
    });

    it("debe rechazar componentes negativos de deuda", () => {

        const prelacion =
            new PrelacionPago();

        const deuda: DeudaPago = {
            gastos:
                Dinero.desdeQuetzales("-10.00"),

            interesMoratorio:
                Dinero.desdeQuetzales("25.00"),

            interesCorriente:
                Dinero.desdeQuetzales("100.00"),

            capital:
                Dinero.desdeQuetzales("1000.00")
        };

        expect(() => {
            prelacion.aplicar(
                Dinero.desdeQuetzales("100.00"),
                deuda
            );
        }).toThrow(
            "Los componentes de la deuda no pueden ser negativos"
        );
    });

    it("debe rechazar deuda en una moneda diferente al pago", () => {

        const prelacion =
            new PrelacionPago();

        const deuda: DeudaPago = {
            gastos:
                Dinero.desdeDecimal(
                    "10.00",
                    "USD"
                ),

            interesMoratorio:
                Dinero.desdeQuetzales("0.00"),

            interesCorriente:
                Dinero.desdeQuetzales("0.00"),

            capital:
                Dinero.desdeQuetzales("1000.00")
        };

        expect(() => {
            prelacion.aplicar(
                Dinero.desdeQuetzales("100.00"),
                deuda
            );
        }).toThrow(
            "El pago y la deuda deben utilizar la misma moneda"
        );
    });

});