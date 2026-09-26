import { describe, expect, it } from "vitest";

import { Dinero } from "../src/dominio/dinero.js";
import { CalculadoraSuspensionInteres } from "../src/dominio/suspension-interes.js";

describe("CP-04.2: suspensión del devengo de interés corriente a los 90 días", () => {

    const calculadora = new CalculadoraSuspensionInteres();
    const interesCorriente = Dinero.desdeQuetzales("278.86");

    it("reconoce el interés corriente completo hasta el día 90", () => {

        const resultado =
            calculadora.calcularDevengo(
                interesCorriente,
                90
            );

        expect(resultado.interesReconocido.aDecimal())
            .toBe("278.86");

        expect(resultado.interesEnSuspenso.aDecimal())
            .toBe("0.00");
    });

    it("suspende el devengo a partir del día 91", () => {

        const resultado =
            calculadora.calcularDevengo(
                interesCorriente,
                91
            );

        expect(resultado.interesReconocido.aDecimal())
            .toBe("0.00");

        expect(resultado.interesEnSuspenso.aDecimal())
            .toBe("278.86");
    });

    it("entre un corte al día 90 y otro al día 100, el ingreso reconocido no aumenta y el suspenso sí", () => {

        const corte90 =
            calculadora.calcularDevengo(
                interesCorriente,
                90
            );

        const corte100 =
            calculadora.calcularDevengo(
                interesCorriente,
                100
            );

        expect(
            corte100.interesReconocido.esMayorQue(
                corte90.interesReconocido
            )
        ).toBe(false);

        expect(
            corte100.interesEnSuspenso.esMayorQue(
                corte90.interesEnSuspenso
            ) ||
            corte100.interesEnSuspenso.igualA(
                corte90.interesEnSuspenso
            )
        ).toBe(true);
    });

    it("al regularizar, lo acumulado en suspenso se reconoce íntegro", () => {

        const suspenso =
            Dinero.desdeQuetzales("278.86");

        const resultado =
            calculadora.regularizar(suspenso);

        expect(resultado.interesReconocido.aDecimal())
            .toBe("278.86");

        expect(resultado.interesEnSuspenso.aDecimal())
            .toBe("0.00");
    });
});
