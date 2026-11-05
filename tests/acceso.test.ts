import { describe, expect, it } from "vitest";
import { accesoPermitido, validarConfiguracionAcceso } from "../src/api/acceso.js";

describe("acceso local y por Wi-Fi", () => {
    it("exige credenciales cuando se abre la aplicación a la red", () => {
        expect(() => validarConfiguracionAcceso("0.0.0.0", undefined, undefined))
            .toThrow("APP_BASIC_USER");
        expect(() => validarConfiguracionAcceso("127.0.0.1", undefined, undefined))
            .not.toThrow();
    });

    it("acepta solo el usuario y clave correctos", () => {
        const correcto = `Basic ${Buffer.from("asesor:clave-demo").toString("base64")}`;
        const incorrecto = `Basic ${Buffer.from("asesor:otra-clave").toString("base64")}`;
        expect(accesoPermitido(correcto, "asesor", "clave-demo")).toBe(true);
        expect(accesoPermitido(incorrecto, "asesor", "clave-demo")).toBe(false);
        expect(accesoPermitido(undefined, "asesor", "clave-demo")).toBe(false);
    });
});
