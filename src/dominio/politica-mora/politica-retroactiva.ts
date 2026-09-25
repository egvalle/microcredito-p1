import { Dinero } from "../dinero.js";
import { CalculadoraMora } from "../calculadora-mora.js";
import { ClasificadorMora } from "../cartera.js";
import {
    DatosPoliticaMora,
    PoliticaMora
} from "./politica-mora.js";
import { TABLA_MORA_ESCALONADA } from "./politica-escalonada.js";

const DIAS_BASE = 360;

/**
 * Política retroactiva — Existe únicamente como tercera implementación
 * para la batería de pruebas de contrato (8.2, sustitución de Liskov):
 * demuestra que el motor puede intercambiar cualquiera de las tres
 * políticas sin romper sus invariantes.
 */
export class PoliticaMoraRetroactiva implements PoliticaMora {

    private readonly calculadora = new CalculadoraMora();
    private readonly clasificador = new ClasificadorMora();

    public calcularInteresMoratorio(
        datos: DatosPoliticaMora
    ): Dinero {

        const tramoActual =
            this.clasificador.clasificar(
                datos.diasAtraso
            );

        const definicion =
            TABLA_MORA_ESCALONADA.find(
                fila => fila.tramo === tramoActual
            );

        if (!definicion) {
            throw new Error(
                "No existe tasa retroactiva para el tramo " +
                tramoActual
            );
        }

        return this.calculadora.calcular({
            capitalVencido: datos.capitalEnMora,
            tasaMoraAnual:
                definicion.tasaNominalAnual,
            diasMora: datos.diasAtraso,
            diasBase: DIAS_BASE
        });
    }
}
