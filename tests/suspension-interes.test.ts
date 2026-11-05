import { describe, expect, it } from "vitest";

import { Dinero } from "../src/dominio/dinero.js";
import {
    CalculadoraSuspensionInteres,
    EstadoDevengo
} from "../src/dominio/suspension-interes.js";

describe("CP-04.2: suspensión y acumulación del interés corriente", () => {
    const calculadora = new CalculadoraSuspensionInteres();
    const cero = Dinero.desdeQuetzales("0.00");

    const estadoInicial: EstadoDevengo = {
        interesReconocido: cero,
        interesEnSuspenso: cero
    };

    it("reconoce el interés nuevo hasta el día 90", () => {
        const resultado = calculadora.registrarDevengo(
            Dinero.desdeQuetzales("10.00"),
            90,
            estadoInicial
        );

        expect(resultado.reconocidoEnPeriodo.aDecimal()).toBe("10.00");
        expect(resultado.suspendidoEnPeriodo.aDecimal()).toBe("0.00");
        expect(resultado.estado.interesReconocido.aDecimal()).toBe("10.00");
        expect(resultado.estado.interesEnSuspenso.aDecimal()).toBe("0.00");
    });

    it("desde el día 91 acumula el interés nuevo en suspenso", () => {
        const corte90 = calculadora.registrarDevengo(
            Dinero.desdeQuetzales("10.00"),
            90,
            estadoInicial
        );

        const corte100 = calculadora.registrarDevengo(
            Dinero.desdeQuetzales("2.00"),
            100,
            corte90.estado
        );

        expect(corte100.estado.interesReconocido.aDecimal()).toBe("10.00");
        expect(corte100.estado.interesEnSuspenso.aDecimal()).toBe("2.00");
        expect(
            corte100.estado.interesEnSuspenso.esMayorQue(
                corte90.estado.interesEnSuspenso
            )
        ).toBe(true);
    });

    it("al regularizar reconoce el saldo suspendido y lo deja en cero", () => {
        const corte90 = calculadora.registrarDevengo(
            Dinero.desdeQuetzales("10.00"),
            90,
            estadoInicial
        );

        const corte100 = calculadora.registrarDevengo(
            Dinero.desdeQuetzales("2.00"),
            100,
            corte90.estado
        );

        const regularizacion = calculadora.regularizar(corte100.estado);

        expect(regularizacion.reconocidoEnPeriodo.aDecimal()).toBe("2.00");
        expect(regularizacion.estado.interesReconocido.aDecimal()).toBe("12.00");
        expect(regularizacion.estado.interesEnSuspenso.aDecimal()).toBe("0.00");
    });
});