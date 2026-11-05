import { describe, expect, it } from "vitest";

import {
    Credito,
    EstadoCancelado,
    EstadoEnMora,
    EstadoSolicitado,
    EstadoVigente
} from "../src/dominio/credito.js";
import type { ResultadoPagoCredito } from "../src/dominio/credito.js";
import { Dinero } from "../src/dominio/dinero.js";
import { CatalogoPoliticas } from "../src/dominio/politica-mora/catalogo-politicas.js";
import { PoliticaMoraPlana } from "../src/dominio/politica-mora/politica-plana.js";
import { PoliticaMoraEscalonada } from "../src/dominio/politica-mora/politica-escalonada.js";

function resultadoPago(
    diasAtrasoRestantes: number,
    saldoPendiente = "100.00",
    cuotasVencidasPendientes = diasAtrasoRestantes > 0 ? 1 : 0
): ResultadoPagoCredito {
    return {
        diasAtrasoRestantes,
        saldoPendiente: Dinero.desdeQuetzales(saldoPendiente),
        cuotasVencidasPendientes
    };
}

const FECHA_OTORGAMIENTO_GENERICA = new Date("2025-01-01T00:00:00Z");

describe("Credito - patrón State", () => {
    it("pasa de vigente a en mora al registrar atraso", () => {
        const credito = new Credito(
            new EstadoVigente(),
            FECHA_OTORGAMIENTO_GENERICA
        );

        credito.registrarAtraso(45);

        expect(credito.obtenerEstado()).toBe("EN_MORA");
        expect(credito.obtenerDiasAtraso()).toBe(45);
        expect(credito.obtenerTramoMora()).toBe("MORA_2");
    });

    it("baja de Mora 2 a Mora 1 con un pago parcial", () => {
        const credito = new Credito(
            new EstadoEnMora(),
            FECHA_OTORGAMIENTO_GENERICA,
            45
        );

        credito.registrarPago(resultadoPago(10));

        expect(credito.obtenerEstado()).toBe("EN_MORA");
        expect(credito.obtenerDiasAtraso()).toBe(10);
        expect(credito.obtenerTramoMora()).toBe("MORA_1");
    });

    it("regresa a vigente cuando paga todo lo vencido pero queda saldo", () => {
        const credito = new Credito(
            new EstadoEnMora(),
            FECHA_OTORGAMIENTO_GENERICA,
            10
        );

        credito.registrarPago(resultadoPago(0));

        expect(credito.obtenerEstado()).toBe("VIGENTE");
        expect(credito.obtenerDiasAtraso()).toBe(0);
        expect(credito.obtenerTramoMora()).toBe("SIN_MORA");
    });

    it("demuestra la reversibilidad de mora hasta regresar a vigente", () => {
        const credito = new Credito(
            new EstadoVigente(),
            FECHA_OTORGAMIENTO_GENERICA
        );

        credito.registrarAtraso(45);

        expect(credito.obtenerEstado()).toBe("EN_MORA");
        expect(credito.obtenerTramoMora()).toBe("MORA_2");

        credito.registrarPago(resultadoPago(10));

        expect(credito.obtenerEstado()).toBe("EN_MORA");
        expect(credito.obtenerTramoMora()).toBe("MORA_1");

        credito.registrarPago(resultadoPago(0));

        expect(credito.obtenerEstado()).toBe("VIGENTE");
        expect(credito.obtenerTramoMora()).toBe("SIN_MORA");
    });

    it("rechaza pagos sobre un crédito solicitado", () => {
        const credito = new Credito(
            new EstadoSolicitado(),
            FECHA_OTORGAMIENTO_GENERICA
        );

        expect(() => {
            credito.registrarPago(resultadoPago(0));
        }).toThrow("Un crédito solicitado no puede recibir pagos");

        expect(credito.obtenerEstado()).toBe("SOLICITADO");
    });

    it("impide que un crédito solicitado entre en mora", () => {
        const credito = new Credito(
            new EstadoSolicitado(),
            FECHA_OTORGAMIENTO_GENERICA
        );

        expect(() => {
            credito.registrarAtraso(10);
        }).toThrow("Un crédito solicitado no puede entrar en mora");
    });

    it("impide pagos sobre un crédito cancelado", () => {
        const credito = new Credito(
            new EstadoCancelado(),
            FECHA_OTORGAMIENTO_GENERICA
        );

        expect(() => {
            credito.registrarPago(resultadoPago(0));
        }).toThrow("Un crédito cancelado no puede recibir pagos");
    });

    it("CP-04.1: cancela un crédito en mora cuando el saldo y las cuotas vencidas son cero", () => {
        const credito = new Credito(
            new EstadoEnMora(),
            FECHA_OTORGAMIENTO_GENERICA,
            15
        );

        credito.registrarPago(resultadoPago(0, "0.00", 0));

        expect(credito.obtenerEstado()).toBe("CANCELADO");
        expect(credito.obtenerDiasAtraso()).toBe(0);
    });

    it("CP-04.1: pasa a vigente al regularizar si aún queda saldo pendiente", () => {
        const credito = new Credito(
            new EstadoEnMora(),
            FECHA_OTORGAMIENTO_GENERICA,
            15
        );

        credito.registrarPago(resultadoPago(0, "100.00", 0));

        expect(credito.obtenerEstado()).toBe("VIGENTE");
        expect(credito.obtenerDiasAtraso()).toBe(0);
    });

    it("cancela un crédito vigente cuando el pago liquida todo el saldo", () => {
        const credito = new Credito(
            new EstadoVigente(),
            FECHA_OTORGAMIENTO_GENERICA
        );

        credito.registrarPago(resultadoPago(0, "0.00", 0));

        expect(credito.obtenerEstado()).toBe("CANCELADO");
    });

    it("un crédito cancelado no puede volver a recibir pagos", () => {
        const credito = new Credito(
            new EstadoEnMora(),
            FECHA_OTORGAMIENTO_GENERICA,
            15
        );

        credito.registrarPago(resultadoPago(0, "0.00", 0));

        expect(() => {
            credito.registrarPago(resultadoPago(0, "0.00", 0));
        }).toThrow("Un crédito cancelado no puede recibir pagos");
    });

    it("rechaza días de atraso y cuotas vencidas inconsistentes", () => {
        const credito = new Credito(
            new EstadoEnMora(),
            FECHA_OTORGAMIENTO_GENERICA,
            15
        );

        expect(() => {
            credito.registrarPago(resultadoPago(0, "100.00", 1));
        }).toThrow(
            "Los días de atraso y las cuotas vencidas pendientes son inconsistentes"
        );
    });

    it("rechaza días de atraso negativos", () => {
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

    it("usa la política plana para créditos otorgados antes del 1/oct/2026", () => {
        const credito = new Credito(
            new EstadoEnMora(),
            new Date("2025-06-15T00:00:00Z"),
            45
        );

        const interes = credito.calcularInteresMoratorio(
            catalogo,
            CAPITAL_EN_MORA
        );

        expect(interes.aDecimal()).toBe("21.77");
    });

    it("usa la política escalonada para créditos otorgados desde el 1/oct/2026", () => {
        const credito = new Credito(
            new EstadoEnMora(),
            new Date("2026-10-01T00:00:00Z"),
            45
        );

        const interes = credito.calcularInteresMoratorio(
            catalogo,
            CAPITAL_EN_MORA
        );

        expect(interes.aDecimal()).toBe("18.14");
    });

    it("aplica políticas distintas a créditos con la misma mora y fechas de otorgamiento diferentes", () => {
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

        const interesAntiguo = creditoAntiguo.calcularInteresMoratorio(
            catalogo,
            CAPITAL_EN_MORA
        );

        const interesNuevo = creditoNuevo.calcularInteresMoratorio(
            catalogo,
            CAPITAL_EN_MORA
        );

        expect(interesAntiguo.igualA(interesNuevo)).toBe(false);
        expect(interesAntiguo.aDecimal()).toBe("21.77");
        expect(interesNuevo.aDecimal()).toBe("18.14");
    });

    it("rechaza calcular mora para un crédito sin días de atraso", () => {
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

    it("expone la fecha de otorgamiento recibida", () => {
        const fecha = new Date("2026-01-20T00:00:00Z");
        const credito = new Credito(
            new EstadoVigente(),
            fecha
        );

        expect(credito.obtenerFechaOtorgamiento().getTime()).toBe(
            fecha.getTime()
        );
    });
});