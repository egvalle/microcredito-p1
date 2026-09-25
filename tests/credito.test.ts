import { describe, expect, it } from "vitest";

import {
    Credito,
    EstadoCancelado,
    EstadoEnMora,
    EstadoSolicitado,
    EstadoVigente
} from "../src/dominio/credito.js";
import { Dinero } from "../src/dominio/dinero.js";
import { CatalogoPoliticas } from "../src/dominio/politica-mora/catalogo-politicas.js";
import { PoliticaMoraPlana } from "../src/dominio/politica-mora/politica-plana.js";
import { PoliticaMoraEscalonada } from "../src/dominio/politica-mora/politica-escalonada.js";

const FECHA_OTORGAMIENTO_GENERICA = new Date("2025-01-01T00:00:00Z");

describe("Credito - patrón State", () => {

    it("debe pasar de vigente a en mora al registrar atraso", () => {

        const credito =
            new Credito(
                new EstadoVigente(),
            FECHA_OTORGAMIENTO_GENERICA
            );

        credito.registrarAtraso(45);

        expect(
            credito.obtenerEstado()
        ).toBe("EN_MORA");

        expect(
            credito.obtenerDiasAtraso()
        ).toBe(45);

        expect(
            credito.obtenerTramoMora()
        ).toBe("MORA_2");
    });

    it("debe bajar de Mora 2 a Mora 1 con un pago parcial", () => {

        const credito =
            new Credito(
                new EstadoEnMora(),
                FECHA_OTORGAMIENTO_GENERICA,
                45
            );

        credito.registrarPago(10);

        expect(
            credito.obtenerEstado()
        ).toBe("EN_MORA");

        expect(
            credito.obtenerDiasAtraso()
        ).toBe(10);

        expect(
            credito.obtenerTramoMora()
        ).toBe("MORA_1");
    });

    it("debe regresar a vigente cuando paga todo lo vencido", () => {

        const credito =
            new Credito(
                new EstadoEnMora(),
                FECHA_OTORGAMIENTO_GENERICA,
                10
            );

        credito.registrarPago(0);

        expect(
            credito.obtenerEstado()
        ).toBe("VIGENTE");

        expect(
            credito.obtenerDiasAtraso()
        ).toBe(0);

        expect(
            credito.obtenerTramoMora()
        ).toBe("SIN_MORA");
    });

    it("debe demostrar reversibilidad completa 45 dias a 10 dias y luego vigente", () => {

        const credito =
            new Credito(
                new EstadoVigente(),
            FECHA_OTORGAMIENTO_GENERICA
            );

        credito.registrarAtraso(45);

        expect(
            credito.obtenerEstado()
        ).toBe("EN_MORA");

        expect(
            credito.obtenerTramoMora()
        ).toBe("MORA_2");

        credito.registrarPago(10);

        expect(
            credito.obtenerEstado()
        ).toBe("EN_MORA");

        expect(
            credito.obtenerTramoMora()
        ).toBe("MORA_1");

        credito.registrarPago(0);

        expect(
            credito.obtenerEstado()
        ).toBe("VIGENTE");

        expect(
            credito.obtenerTramoMora()
        ).toBe("SIN_MORA");
    });

    it("debe rechazar pagos sobre un crédito solicitado", () => {

        const credito =
            new Credito(
                new EstadoSolicitado(),
            FECHA_OTORGAMIENTO_GENERICA
            );

        expect(() => {
            credito.registrarPago(0);
        }).toThrow(
            "Un crédito solicitado no puede recibir pagos"
        );

        expect(
            credito.obtenerEstado()
        ).toBe("SOLICITADO");
    });

    it("debe impedir que un crédito solicitado entre en mora", () => {

        const credito =
            new Credito(
                new EstadoSolicitado(),
            FECHA_OTORGAMIENTO_GENERICA
            );

        expect(() => {
            credito.registrarAtraso(10);
        }).toThrow(
            "Un crédito solicitado no puede entrar en mora"
        );
    });

    it("debe impedir pagos sobre un crédito cancelado", () => {

        const credito =
            new Credito(
                new EstadoCancelado(),
            FECHA_OTORGAMIENTO_GENERICA
            );

        expect(() => {
            credito.registrarPago(0);
        }).toThrow(
            "Un crédito cancelado no puede recibir pagos"
        );
    });

    it("CP-04.1: debe pasar a CANCELADO cuando el pago liquida todo el saldo en mora", () => {

        const credito =
            new Credito(
                new EstadoEnMora(),
                FECHA_OTORGAMIENTO_GENERICA,
                15
            );

        credito.registrarPago(0, true);

        expect(
            credito.obtenerEstado()
        ).toBe("CANCELADO");

        expect(
            credito.obtenerDiasAtraso()
        ).toBe(0);
    });

    it("CP-04.1: debe seguir yendo a VIGENTE cuando el pago pone al día pero no liquida el saldo", () => {

        const credito =
            new Credito(
                new EstadoEnMora(),
                FECHA_OTORGAMIENTO_GENERICA,
                15
            );

        credito.registrarPago(0, false);

        expect(
            credito.obtenerEstado()
        ).toBe("VIGENTE");
    });

    it("CP-04.1: un crédito cancelado no puede volver a recibir pagos", () => {

        const credito =
            new Credito(
                new EstadoEnMora(),
                FECHA_OTORGAMIENTO_GENERICA,
                15
            );

        credito.registrarPago(0, true);

        expect(() => {
            credito.registrarPago(0, true);
        }).toThrow(
            "Un crédito cancelado no puede recibir pagos"
        );
    });

    it("CP-04.1: rechaza marcar saldoLiquidado con días de atraso pendientes", () => {

        const credito =
            new Credito(
                new EstadoEnMora(),
                FECHA_OTORGAMIENTO_GENERICA,
                15
            );

        expect(() => {
            credito.registrarPago(5, true);
        }).toThrow(
            "Un saldo liquidado no puede dejar días de atraso pendientes"
        );
    });

    it("debe rechazar días de atraso negativos", () => {

        expect(() => {
            new Credito(
                new EstadoVigente(),
                FECHA_OTORGAMIENTO_GENERICA,
                -1
            );
        }).toThrow(
            "Los días de atraso deben ser un entero mayor o igual a cero"
        );
    });

});

describe("Credito - conexión con CatalogoPoliticas (7.6, coexistencia de políticas)", () => {

    const CAPITAL_EN_MORA = Dinero.desdeQuetzales("725.76");

    const catalogo = new CatalogoPoliticas(
        new PoliticaMoraPlana(),
        new PoliticaMoraEscalonada()
    );

    it("7.6 / CP-03: crédito otorgado antes del 1/oct/2026 usa la política plana -> Q21.77", () => {

        const credito = new Credito(
            new EstadoEnMora(),
            new Date("2025-06-15T00:00:00Z"),
            45
        );

        const interes =
            credito.calcularInteresMoratorio(
                catalogo,
                CAPITAL_EN_MORA
            );

        expect(interes.aDecimal()).toBe("21.77");
    });

    it("7.6: crédito otorgado el 1/oct/2026 o después usa la política escalonada -> Q18.14", () => {

        const credito = new Credito(
            new EstadoEnMora(),
            new Date("2026-10-01T00:00:00Z"),
            45
        );

        const interes =
            credito.calcularInteresMoratorio(
                catalogo,
                CAPITAL_EN_MORA
            );

        expect(interes.aDecimal()).toBe("18.14");
    });

    it("dos créditos con los mismos días de atraso pueden pagar mora distinta según su fecha de otorgamiento", () => {

        const creditoAntiguo = new Credito(
            new EstadoEnMora(),
            new Date("2026-09-30T00:00:00Z"),
            45
        );

        const creditoNuevo = new Credito(
            new EstadoEnMora(),
            new Date("2026-10-02T00:00:00Z"),
            45
        );

        const interesAntiguo =
            creditoAntiguo.calcularInteresMoratorio(
                catalogo,
                CAPITAL_EN_MORA
            );

        const interesNuevo =
            creditoNuevo.calcularInteresMoratorio(
                catalogo,
                CAPITAL_EN_MORA
            );

        expect(interesAntiguo.igualA(interesNuevo)).toBe(false);
        expect(interesAntiguo.aDecimal()).toBe("21.77");
        expect(interesNuevo.aDecimal()).toBe("18.14");
    });

    it("rechaza calcular mora de un crédito que no tiene días de atraso", () => {

        const credito = new Credito(
            new EstadoVigente(),
            new Date("2026-11-01T00:00:00Z")
        );

        expect(() => {
            credito.calcularInteresMoratorio(
                catalogo,
                CAPITAL_EN_MORA
            );
        }).toThrow(
            "Un crédito sin días de atraso no genera interés moratorio"
        );
    });

    it("expone su fecha de otorgamiento sin haberla leído del sistema", () => {

        const fecha = new Date("2026-01-20T00:00:00Z");

        const credito = new Credito(
            new EstadoVigente(),
            fecha
        );

        expect(
            credito.obtenerFechaOtorgamiento().getTime()
        ).toBe(fecha.getTime());
    });

});