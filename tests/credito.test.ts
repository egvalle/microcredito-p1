import { describe, expect, it } from "vitest";

import {
    Credito,
    EstadoCancelado,
    EstadoEnMora,
    EstadoSolicitado,
    EstadoVigente
} from "../src/dominio/credito.js";

describe("Credito - patrón State", () => {

    it("debe pasar de vigente a en mora al registrar atraso", () => {

        const credito =
            new Credito(
                new EstadoVigente()
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
                new EstadoVigente()
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
                new EstadoSolicitado()
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
                new EstadoSolicitado()
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
                new EstadoCancelado()
            );

        expect(() => {
            credito.registrarPago(0);
        }).toThrow(
            "Un crédito cancelado no puede recibir pagos"
        );
    });

    it("debe rechazar días de atraso negativos", () => {

        expect(() => {
            new Credito(
                new EstadoVigente(),
                -1
            );
        }).toThrow(
            "Los días de atraso deben ser un entero mayor o igual a cero"
        );
    });

});