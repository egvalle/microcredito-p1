import { Decimal } from "decimal.js";

import { Dinero } from "../dinero.js";
import { CalculadoraMora } from "../calculadora-mora.js";
import {
    DatosPoliticaMora,
    PoliticaMora
} from "./politica-mora.js";

/**
 * Política vigente hasta el 30 de septiembre de 2026: tasa moratoria
 * plana del 24% nominal anual, base Actual/360. Es la política del
 * Proyecto 1 — no cambia. Los créditos otorgados antes del 1 de
 * octubre de 2026 siguen usando esta política
 */
export class PoliticaMoraPlana implements PoliticaMora {

    private static readonly TASA_ANUAL =
        new Decimal("0.24");

    private static readonly DIAS_BASE = 360;

    private readonly calculadora =
        new CalculadoraMora();

    public calcularInteresMoratorio(
        datos: DatosPoliticaMora
    ): Dinero {

        return this.calculadora.calcular({
            capitalVencido: datos.capitalEnMora,
            tasaMoraAnual:
                PoliticaMoraPlana.TASA_ANUAL,
            diasMora: datos.diasAtraso,
            diasBase:
                PoliticaMoraPlana.DIAS_BASE
        });
    }
}
