import { writeFileSync } from "node:fs";
import { Decimal } from "decimal.js";

import { Dinero } from "../dominio/dinero.js";
import { AmortizacionFrancesa } from "../dominio/plan-amortizacion.js";
import { CalculadoraMora } from "../dominio/calculadora-mora.js";
import { PrelacionPago } from "../dominio/prelacion-pago.js";
import {
    CalculadoraCarteraRiesgo,
    ClasificadorMora
} from "../dominio/cartera.js";
import type {
    CreditoCartera
} from "../dominio/cartera.js";
import {
    Credito,
    EstadoVigente
} from "../dominio/credito.js";

const lineas: string[] = [];

function escribir(texto: string = ""): void {
    console.log(texto);
    lineas.push(texto);
}

function titulo(texto: string): void {
    escribir("");
    escribir("=".repeat(75));
    escribir(texto);
    escribir("=".repeat(75));
}

function moneda(valor: Dinero): string {
    return `Q${valor.aDecimal()}`;
}

/* ============================================================
   ENCABEZADO
   ============================================================ */

escribir("SISTEMA DE GESTIÓN DE MICROCRÉDITO");
escribir("Demostración del núcleo de cálculos");

/* ============================================================
   1. PLAN DE AMORTIZACIÓN
   ============================================================ */

titulo("1. PLAN DE AMORTIZACIÓN - MÉTODO FRANCÉS");

const estrategia =
    new AmortizacionFrancesa();

const capital =
    Dinero.desdeQuetzales("10000.00");

const tasaNominalAnual =
    new Decimal("0.36");

const plan =
    estrategia.generar({
        capital,
        tasaNominalAnual,
        numeroCuotas: 12
    });

escribir(`Capital: ${moneda(capital)}`);
escribir("Tasa nominal anual: 36%");
escribir("Tasa mensual: 3%");
escribir("Número de cuotas: 12");

escribir("");
escribir(
    "N° | Saldo Inicial | Cuota    | Interés | Amortización | Saldo Final"
);
escribir("-".repeat(75));

let totalCuotas = 0n;
let totalIntereses = 0n;
let totalAmortizado = 0n;

for (const cuota of plan.obtenerCuotas()) {

    totalCuotas +=
        cuota.cuota.obtenerCentavos();

    totalIntereses +=
        cuota.interes.obtenerCentavos();

    totalAmortizado +=
        cuota.capital.obtenerCentavos();

    escribir(
        `${cuota.numero.toString().padStart(2)} | ` +
        `${cuota.saldoInicial.aDecimal().padStart(13)} | ` +
        `${cuota.cuota.aDecimal().padStart(8)} | ` +
        `${cuota.interes.aDecimal().padStart(7)} | ` +
        `${cuota.capital.aDecimal().padStart(12)} | ` +
        `${cuota.saldoFinal.aDecimal().padStart(11)}`
    );
}

escribir("-".repeat(75));

escribir(
    `Total cuotas: ${moneda(
        Dinero.desdeCentavos(totalCuotas)
    )}`
);

escribir(
    `Total intereses: ${moneda(
        Dinero.desdeCentavos(totalIntereses)
    )}`
);

escribir(
    `Total amortizado: ${moneda(
        Dinero.desdeCentavos(totalAmortizado)
    )}`
);

escribir(
    `Saldo final: ${moneda(
        plan.obtenerUltimaCuota().saldoFinal
    )}`
);

escribir("");
escribir(
    "Comprobación: suma de amortizaciones = capital desembolsado"
);

escribir(
    `${moneda(
        Dinero.desdeCentavos(totalAmortizado)
    )} = ${moneda(capital)}`
);

/* ============================================================
   2. INTERÉS MORATORIO
   ============================================================ */

titulo("2. CÁLCULO DE INTERÉS MORATORIO");

const calculadoraMora =
    new CalculadoraMora();

const capitalVencido =
    Dinero.desdeQuetzales("1000.00");

const tasaMora =
    new Decimal("0.265");

const diasMora = 10;

const mora =
    calculadoraMora.calcular({
        capitalVencido,
        tasaMoraAnual: tasaMora,
        diasMora,
        diasBase: 365
    });

escribir(
    `Capital vencido: ${moneda(capitalVencido)}`
);

escribir("Tasa moratoria anual: 26.5%");
escribir(`Días de atraso: ${diasMora}`);
escribir("Base de días: 365");

escribir("");
escribir("Fórmula:");

escribir(
    "Capital vencido × tasa anual × días de mora / base de días"
);

escribir("");
escribir(
    "1000.00 × 0.265 × 10 / 365 = 7.260273..."
);

escribir(
    `Interés moratorio redondeado: ${moneda(mora)}`
);

/* ============================================================
   3. PRELACIÓN DEL PAGO
   ============================================================ */

titulo("3. APLICACIÓN DE PAGO - PRELACIÓN");

const prelacion =
    new PrelacionPago();

const pago =
    Dinero.desdeQuetzales("200.00");

const deuda = {
    gastos:
        Dinero.desdeQuetzales("50.00"),

    interesMoratorio:
        Dinero.desdeQuetzales("25.00"),

    interesCorriente:
        Dinero.desdeQuetzales("100.00"),

    capital:
        Dinero.desdeQuetzales("1000.00")
};

const aplicacion =
    prelacion.aplicar(
        pago,
        deuda
    );

escribir(
    `Pago recibido: ${moneda(pago)}`
);

escribir("");
escribir("Orden de aplicación:");
escribir("1. Gastos y comisiones");
escribir("2. Interés moratorio");
escribir("3. Interés corriente");
escribir("4. Capital");

escribir("");
escribir(
    `Aplicado a gastos: ${moneda(aplicacion.gastos)}`
);

escribir(
    `Aplicado a interés moratorio: ${moneda(
        aplicacion.interesMoratorio
    )}`
);

escribir(
    `Aplicado a interés corriente: ${moneda(
        aplicacion.interesCorriente
    )}`
);

escribir(
    `Aplicado a capital: ${moneda(
        aplicacion.capital
    )}`
);

escribir(
    `Excedente: ${moneda(
        aplicacion.excedente
    )}`
);

/* ============================================================
   4. CARTERA EN RIESGO
   ============================================================ */

titulo("4. CÁLCULO DE CARTERA EN RIESGO");

const creditos: CreditoCartera[] = [
    {
        id: "C-001",
        saldoCapital:
            Dinero.desdeQuetzales("620000.00"),
        diasAtraso: 0,
        reestructurado: false,
        incobrable: false
    },
    {
        id: "C-002",
        saldoCapital:
            Dinero.desdeQuetzales("124000.00"),
        diasAtraso: 8,
        reestructurado: false,
        incobrable: false
    },
    {
        id: "C-003",
        saldoCapital:
            Dinero.desdeQuetzales("24000.00"),
        diasAtraso: 45,
        reestructurado: false,
        incobrable: false
    },
    {
        id: "C-004",
        saldoCapital:
            Dinero.desdeQuetzales("18000.00"),
        diasAtraso: 75,
        reestructurado: false,
        incobrable: false
    },
    {
        id: "C-005",
        saldoCapital:
            Dinero.desdeQuetzales("8000.00"),
        diasAtraso: 100,
        reestructurado: false,
        incobrable: false
    },
    {
        id: "C-006",
        saldoCapital:
            Dinero.desdeQuetzales("6000.00"),
        diasAtraso: 0,
        reestructurado: true,
        incobrable: false
    },
    {
        id: "C-007",
        saldoCapital:
            Dinero.desdeQuetzales("15000.00"),
        diasAtraso: 210,
        reestructurado: false,
        incobrable: true
    }
];

const calculadoraCartera =
    new CalculadoraCarteraRiesgo();

const resultadoCartera =
    calculadoraCartera.calcular(
        creditos
    );

escribir("Créditos evaluados:");

for (const credito of creditos) {

    const condicion =
        credito.incobrable
            ? "INCOBRABLE"
            : credito.reestructurado
                ? "REESTRUCTURADO"
                : credito.diasAtraso > 30
                    ? "EN RIESGO"
                    : "SIN RIESGO";

    escribir(
        `${credito.id} | ` +
        `${moneda(credito.saldoCapital)} | ` +
        `${credito.diasAtraso} días | ` +
        condicion
    );
}

escribir("");

escribir(
    `Cartera activa: ${moneda(
        resultadoCartera.carteraActiva
    )}`
);

escribir(
    `Capital en riesgo: ${moneda(
        resultadoCartera.capitalEnRiesgo
    )}`
);

escribir(
    `Porcentaje de riesgo: ${
        resultadoCartera.porcentajeRiesgo.toFixed(2)
    }%`
);

escribir("");
escribir(
    "Fórmula: capital en riesgo / cartera activa × 100"
);

escribir(
    "Q56,000.00 / Q800,000.00 × 100 = 7.00%"
);

/* ============================================================
   5. CASO C-005 COMO INCOBRABLE
   ============================================================ */

titulo("5. CARTERA DESPUÉS DE DECLARAR C-005 INCOBRABLE");

const creditosConC005Incobrable =
    creditos.map(
        credito =>
            credito.id === "C-005"
                ? {
                    ...credito,
                    incobrable: true
                }
                : credito
    );

const resultadoAjustado =
    calculadoraCartera.calcular(
        creditosConC005Incobrable
    );

escribir(
    `Cartera activa: ${moneda(
        resultadoAjustado.carteraActiva
    )}`
);

escribir(
    `Capital en riesgo: ${moneda(
        resultadoAjustado.capitalEnRiesgo
    )}`
);

escribir(
    `Porcentaje de riesgo: ${
        resultadoAjustado.porcentajeRiesgo.toFixed(2)
    }%`
);

escribir("");
escribir(
    "Q48,000.00 / Q792,000.00 × 100 = 6.06%"
);

/* ============================================================
   6. CLASIFICACIÓN Y REVERSIBILIDAD
   ============================================================ */

titulo("6. CLASIFICACIÓN DE MORA Y REVERSIBILIDAD");

const clasificador =
    new ClasificadorMora();

escribir(
    `45 días de atraso -> ${
        clasificador.clasificar(45)
    }`
);

escribir(
    `10 días de atraso -> ${
        clasificador.clasificar(10)
    }`
);

escribir(
    `0 días de atraso -> ${
        clasificador.clasificar(0)
    }`
);

escribir("");

const creditoDemo =
    new Credito(
        new EstadoVigente()
    );

escribir(
    `Estado inicial: ${
        creditoDemo.obtenerEstado()
    }`
);

creditoDemo.registrarAtraso(45);

escribir(
    `45 días -> ${
        creditoDemo.obtenerEstado()
    } / ${
        creditoDemo.obtenerTramoMora()
    }`
);

creditoDemo.registrarPago(10);

escribir(
    `Pago parcial -> 10 días -> ${
        creditoDemo.obtenerEstado()
    } / ${
        creditoDemo.obtenerTramoMora()
    }`
);

creditoDemo.registrarPago(0);

escribir(
    `Pago total de lo vencido -> ${
        creditoDemo.obtenerEstado()
    } / ${
        creditoDemo.obtenerTramoMora()
    }`
);

/* ============================================================
   ARCHIVO TXT
   ============================================================ */

titulo("FIN DE LA DEMOSTRACIÓN");

const nombreArchivo =
    "resultado-calculos.txt";

writeFileSync(
    nombreArchivo,
    lineas.join("\n"),
    {
        encoding: "utf8"
    }
);

console.log(
    `\nArchivo generado: ${nombreArchivo}`
);