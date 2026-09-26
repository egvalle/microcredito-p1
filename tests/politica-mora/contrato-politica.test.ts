import { describe, expect, it } from "vitest";

import { Dinero } from "../../src/dominio/dinero.js";
import { PoliticaMora } from "../../src/dominio/politica-mora/politica-mora.js";
import { PoliticaMoraPlana } from "../../src/dominio/politica-mora/politica-plana.js";
import { PoliticaMoraEscalonada } from "../../src/dominio/politica-mora/politica-escalonada.js";
import { PoliticaMoraRetroactiva } from "../../src/dominio/politica-mora/politica-retroactiva.js";

/**
 * La misma batería de pruebas de
 * contrato se ejecuta contra las tres implementaciones. Ninguna debe
 * romper los invariantes del motor, sin importar cuál se inyecte.
 */
const politicas: Array<[string, PoliticaMora]> = [
    ["plana", new PoliticaMoraPlana()],
    ["escalonada", new PoliticaMoraEscalonada()],
    ["retroactiva", new PoliticaMoraRetroactiva()]
];

describe("Contrato de PoliticaMora (Liskov) - las tres implementaciones", () => {

    const capitalEnMora = Dinero.desdeQuetzales("725.76");

    it.each(politicas)(
        "%s: el interés moratorio nunca excede el capital en mora",
        (_nombre, politica) => {

            for (const dias of [1, 15, 45, 90, 100, 120]) {

                const resultado =
                    politica.calcularInteresMoratorio({
                        capitalEnMora,
                        diasAtraso: dias
                    });

                expect(
                    resultado.esMayorQue(capitalEnMora)
                ).toBe(false);
            }
        }
    );

    it.each(politicas)(
        "%s: es monótono creciente respecto de los días de atraso",
        (_nombre, politica) => {

            const dias = [15, 45, 90];

            let anterior = Dinero.desdeCentavos(0n);

            for (const diasAtraso of dias) {

                const resultado =
                    politica.calcularInteresMoratorio({
                        capitalEnMora,
                        diasAtraso
                    });

                expect(
                    resultado.esMayorQue(anterior) ||
                    resultado.igualA(anterior)
                ).toBe(true);

                anterior = resultado;
            }
        }
    );

    it.each(politicas)(
        "%s: rechaza capital en mora igual a cero",
        (_nombre, politica) => {

            expect(() => {
                politica.calcularInteresMoratorio({
                    capitalEnMora: Dinero.desdeQuetzales("0.00"),
                    diasAtraso: 15
                });
            }).toThrow();
        }
    );
});

describe("7.9: el moratorio por tramos recorridos <= política retroactiva del tramo actual", () => {

    const capitalEnMora = Dinero.desdeQuetzales("725.76");
    const escalonada = new PoliticaMoraEscalonada();
    const retroactiva = new PoliticaMoraRetroactiva();

    it.each([15, 45, 100, 120])(
        "a %i días, la escalonada nunca cobra más que la retroactiva",
        diasAtraso => {

            const porTramos =
                escalonada.calcularInteresMoratorio({
                    capitalEnMora,
                    diasAtraso
                });

            const retroactivo =
                retroactiva.calcularInteresMoratorio({
                    capitalEnMora,
                    diasAtraso
                });

            expect(
                porTramos.esMayorQue(retroactivo)
            ).toBe(false);
        }
    );

    it("100 días: la retroactiva da Q72.58 frente a Q50.80 de la escalonada (Anexo E)", () => {

        expect(
            retroactiva.calcularInteresMoratorio({
                capitalEnMora,
                diasAtraso: 100
            }).aDecimal()
        ).toBe("72.58");

        expect(
            escalonada.calcularInteresMoratorio({
                capitalEnMora,
                diasAtraso: 100
            }).aDecimal()
        ).toBe("50.80");
    });
});
