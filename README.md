# Sistema de Gestión de Microcrédito

Proyecto académico desarrollado para el curso **Análisis de Sistemas II** de la **Universidad Mariano Gálvez de Guatemala**.

El proyecto implementa el núcleo de dominio de un **Sistema de Gestión de Microcrédito para Crédito Vecino, S. A.**, aplicando principios de arquitectura de software, diseño orientado a objetos, patrones de diseño y pruebas automatizadas.

El núcleo permite realizar cálculos financieros y aplicar reglas relacionadas con planes de amortización, interés moratorio, prelación de pagos, clasificación de mora, cartera en riesgo y ciclo de vida del crédito.

---

## Arquitectura

El sistema utiliza una **Arquitectura Hexagonal (Ports and Adapters)** dentro de un **Monolito Modular**.

El objetivo es mantener las reglas del negocio independientes de tecnologías externas como:

- Base de datos.
- Servidor HTTP.
- Interfaz gráfica.
- Frameworks web.
- Servicios externos.
- RAG.
- MCP.

El núcleo de dominio contiene las reglas del negocio y puede ejecutarse y probarse sin infraestructura externa.

Esta separación permitirá que posteriormente una API REST, una interfaz web u otros adaptadores utilicen los mismos casos de uso sin duplicar las reglas del negocio.

---

## Tecnologías utilizadas

- Node.js 20 o superior
- TypeScript
- Vitest
- decimal.js
- bigint para representación de importes monetarios
- PlantUML para diagramas

TypeScript se encuentra configurado en modo:

```json
"strict": true
```

---

## Estructura del proyecto

```text
microcredito-p1/
│
├── src/
│   ├── dominio/
│   │   ├── dinero.ts
│   │   ├── plan-amortizacion.ts
│   │   ├── calculadora-mora.ts
│   │   ├── prelacion-pago.ts
│   │   ├── cartera.ts
│   │   └── credito.ts
│   │
│   └── demo/
│       └── calculos-demo.ts
│
├── tests/
│   ├── dinero.test.ts
│   ├── plan-amortizacion.test.ts
│   ├── calculadora-mora.test.ts
│   ├── prelacion-pago.test.ts
│   ├── cartera.test.ts
│   └── credito.test.ts
│
├── docs/
│   ├── diagramas/
│   ├── adr/
│   └── api/
│
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .gitignore
└── README.md
```

---

# Núcleo de dominio

## Dinero

`dinero.ts` implementa el objeto de valor `Dinero`.

Los importes monetarios no se representan utilizando `Number`, debido a los problemas de precisión asociados con operaciones de punto flotante.

Los importes se almacenan internamente utilizando:

```text
bigint
```

en centavos.

Por ejemplo:

```text
Q100.25
```

se representa internamente como:

```text
10025n
```

Esto permite realizar operaciones monetarias exactas.

También se valida que no se realicen operaciones entre monedas diferentes.

---

## Plan de amortización

`plan-amortizacion.ts` implementa el cálculo de amortización mediante el **método francés**.

Se utiliza el patrón:

**Strategy**

La interfaz:

```text
EstrategiaAmortizacion
```

permite que diferentes estrategias de amortización puedan implementarse en el futuro sin modificar el código consumidor.

Actualmente se implementa:

```text
AmortizacionFrancesa
```

Para los cálculos de tasas se utiliza:

```text
decimal.js
```

y para los importes monetarios se utiliza el objeto de valor:

```text
Dinero
```

El redondeo monetario se realiza a dos decimales utilizando:

```text
ROUND_HALF_UP
```

La última cuota se ajusta para garantizar que:

```text
Σ amortizaciones = capital desembolsado
```

y:

```text
saldo final = Q0.00
```

---

## Interés moratorio

`calculadora-mora.ts` calcula el interés generado sobre el capital vencido.

La fórmula utilizada es:

```text
Interés moratorio =
Capital vencido × Tasa moratoria anual × Días de mora
-----------------------------------------------------
                   Base de días
```

El interés moratorio se calcula únicamente sobre el **capital vencido**.

No se calcula interés sobre interés.

Uno de los casos de referencia implementados es:

```text
Capital vencido: Q1,000.00
Tasa anual:      26.5%
Días de mora:    10
Base:            365

Interés moratorio: Q7.26
```

---

## Prelación de pagos

`prelacion-pago.ts` implementa el orden obligatorio para aplicar un pago.

Se utiliza el patrón:

**Chain of Responsibility**

El orden de aplicación es:

```text
Pago
 │
 ▼
Gastos y comisiones
 │
 ▼
Interés moratorio
 │
 ▼
Interés corriente
 │
 ▼
Capital
 │
 ▼
Excedente
```

Cada componente procesa únicamente la parte del pago que le corresponde y entrega el monto restante al siguiente componente de la cadena.

El sistema también contempla pagos:

- Exactos.
- Parciales.
- Mayores que la deuda.

Cuando existe un monto sobrante se identifica como excedente.

---

## Clasificación de mora

`cartera.ts` contiene la clasificación del atraso utilizando especificaciones del dominio.

Se aplica el patrón:

**Specification**

Los tramos de mora se derivan de los días de atraso y no representan estados independientes del crédito.

Los rangos utilizados son:

| Días de atraso | Tramo |
|---:|---|
| 0 | Sin mora |
| 1 - 30 | Mora 1 |
| 31 - 60 | Mora 2 |
| 61 - 90 | Mora 3 |
| 91 - 120 | Vencido |

Cuando un crédito supera los 120 días de atraso, deja de corresponder a un tramo de mora y debe gestionarse mediante el estado `INCOBRABLE` del ciclo de vida del crédito.

La clasificación por tramos puede cambiar en ambas direcciones cuando el cliente realiza pagos.

Por ejemplo:

```text
45 días
   ↓
MORA_2

10 días
   ↓
MORA_1

0 días
   ↓
SIN_MORA
```

---

## Cartera en riesgo

`cartera.ts` también implementa el cálculo de cartera en riesgo.

Un crédito se considera en riesgo cuando:

```text
días de atraso > 30
```

o cuando se encuentra marcado como:

```text
reestructurado
```

aunque actualmente se encuentre al día.

Los créditos incobrables quedan excluidos de la cartera activa.

La fórmula utilizada es:

```text
                     Capital en riesgo
Cartera en riesgo = ------------------- × 100
                      Cartera activa
```

El caso de referencia utilizado por el proyecto produce:

```text
Cartera activa:     Q800,000.00
Capital en riesgo:   Q56,000.00

Riesgo = 7.00%
```

Al considerar el crédito `C-005` como incobrable:

```text
Cartera activa:     Q792,000.00
Capital en riesgo:   Q48,000.00

Riesgo = 6.06%
```

---

## Ciclo de vida del crédito

`credito.ts` implementa parte del ciclo de vida necesario para validar las reglas del crédito.

Se utiliza el patrón:

**State**

Cada estado controla las operaciones que puede realizar el crédito.

Entre los estados implementados para las pruebas del núcleo se encuentran:

```text
SOLICITADO
VIGENTE
EN_MORA
CANCELADO
```

Un ejemplo de transición reversible es:

```text
VIGENTE
   │
   │ 45 días de atraso
   ▼
EN_MORA / MORA_2
   │
   │ pago parcial
   ▼
EN_MORA / MORA_1
   │
   │ pago de todo lo vencido
   ▼
VIGENTE
```

Las operaciones inválidas son rechazadas por el propio estado.

Por ejemplo:

```text
SOLICITADO
    │
    │ registrar pago
    ▼
   ERROR
```

Un crédito solicitado todavía no puede recibir pagos.

---

# Patrones de diseño

El proyecto aplica diferentes patrones para mantener las responsabilidades separadas.

| Patrón | Aplicación |
|---|---|
| Value Object | Representación de importes mediante `Dinero` |
| Strategy | Estrategias de amortización |
| Chain of Responsibility | Prelación de pagos |
| State | Ciclo de vida del crédito |
| Specification | Clasificación por tramos de mora |

Estos patrones forman parte del diseño definido previamente y posteriormente implementado en el núcleo de dominio.

---

# Instalación

## Requisitos

Es necesario tener instalado:

```text
Node.js 20 o superior
npm
```

Para verificar las versiones:

```bash
node --version
npm --version
```

---

## Clonar el repositorio

```bash
git clone <URL-DEL-REPOSITORIO>
```

Ingresar al proyecto:

```bash
cd microcredito-p1
```

---

## Instalar dependencias

Ejecutar:

```bash
npm install
```

---

# Compilar el proyecto

Para compilar TypeScript:

```bash
npm run build
```

El código compilado se genera en:

```text
dist/
```

Esta carpeta no se almacena en el repositorio porque puede regenerarse mediante el proceso de compilación.

---

# Ejecutar las pruebas

Ejecutar:

```bash
npm test
```

Las pruebas utilizan:

```text
Vitest
```

Actualmente el núcleo cuenta con:

```text
Test Files: 6
Tests:      58
```

Las pruebas verifican, entre otros casos:

- Operaciones monetarias exactas.
- Inmutabilidad de `Dinero`.
- Validación de monedas.
- Plan de amortización francés.
- Las 12 filas del caso de referencia.
- Ajuste de la última cuota.
- Suma exacta de amortizaciones.
- Saldo final igual a Q0.00.
- Cálculo de interés moratorio.
- Redondeo monetario.
- Prelación de pagos.
- Pagos parciales.
- Pagos con excedente.
- Clasificación por días de mora.
- Cartera en riesgo.
- Créditos reestructurados.
- Exclusión de créditos incobrables.
- Reversibilidad de mora.
- Transiciones inválidas del crédito.

El proyecto no necesita una base de datos ni un servidor para ejecutar estas pruebas.

---

# Demostración de los cálculos

Además de las pruebas automatizadas, se incluye un script para visualizar los cálculos realizados por el núcleo.

Ejecutar:

```bash
npm run demo
```

El comando compila el proyecto y ejecuta:

```text
src/demo/calculos-demo.ts
```

La demostración presenta:

```text
1. Plan de amortización
2. Cálculo de interés moratorio
3. Aplicación del pago según prelación
4. Cálculo de cartera en riesgo
5. Cartera después de declarar C-005 incobrable
6. Clasificación de mora y reversibilidad
```

Los resultados se muestran directamente en la consola.

También se genera automáticamente:

```text
resultado-calculos.txt
```

Este archivo contiene la evidencia de los cálculos mostrados durante la ejecución.

El archivo es generado únicamente como salida de la demostración y por ello está excluido del repositorio mediante `.gitignore`.

---

# Comandos principales

Instalar dependencias:

```bash
npm install
```

Compilar:

```bash
npm run build
```

Ejecutar pruebas:

```bash
npm test
```

Ejecutar demostración:

```bash
npm run demo
```

Durante una demostración del proyecto se recomienda ejecutar:

```bash
npm test
npm run demo
```

El primer comando demuestra que las reglas se encuentran verificadas mediante pruebas automatizadas y el segundo permite visualizar los cálculos realizados por el núcleo.

---

# Decisiones técnicas principales

## Representación del dinero

Los importes monetarios utilizan:

```text
bigint en centavos
```

en lugar de `Number`.

Esto evita errores de precisión de punto flotante en operaciones monetarias.

---

## Cálculos financieros

Para tasas, fórmulas y operaciones decimales se utiliza:

```text
decimal.js
```

Los resultados monetarios son convertidos posteriormente a `Dinero`.

---

## Redondeo

Los valores monetarios se redondean a dos decimales utilizando:

```text
ROUND_HALF_UP
```

La última cuota del plan de amortización se ajusta para garantizar que el saldo final sea exactamente cero.

---

## Independencia de infraestructura

El núcleo de dominio no depende de:

```text
Express
PostgreSQL
HTTP
Frontend
RAG
MCP
```

Estas tecnologías corresponden a adaptadores o etapas posteriores del sistema.

Las reglas financieras permanecen dentro del dominio.

---

# Documentación

La documentación del proyecto se organiza dentro de:

```text
docs/
```

## Diagramas

```text
docs/diagramas/
```

Contiene los diagramas editables utilizados para documentar la arquitectura y diseño del sistema.

## ADR

```text
docs/adr/
```

Contiene los registros de decisiones arquitectónicas.

Entre las decisiones documentadas se encuentran:

```text
ADR-001 - Estilo arquitectónico
ADR-002 - Representación de importes monetarios
```

## API

```text
docs/api/
```

Esta carpeta está destinada a los contratos de la API y su especificación OpenAPI.

---

# Alcance actual

El proyecto actual implementa y valida el **núcleo de dominio** requerido para el Proyecto 1.

No forma parte de este núcleo:

- Servidor HTTP.
- Base de datos.
- Interfaz gráfica.
- Autenticación.
- RAG.
- Servidor MCP.

Estas tecnologías se integrarán mediante adaptadores sin trasladar las reglas del negocio fuera del dominio.

---

# Herramientas de IA utilizadas

Durante el desarrollo del proyecto se utilizó **ChatGPT de OpenAI** como herramienta de apoyo.

Se utilizó principalmente para:

- Analizar el enunciado del proyecto.
- Revisar decisiones de arquitectura.
- Apoyar el diseño de diagramas UML y C4.
- Analizar la aplicación de principios SOLID y GRASP.
- Revisar la aplicación de patrones de diseño.
- Apoyar la implementación del núcleo en TypeScript.
- Proponer y revisar pruebas unitarias.
- Revisar casos de referencia y reglas del dominio.
- Apoyar la elaboración de documentación técnica.

Las decisiones de diseño, implementación, revisión y validación del proyecto son responsabilidad de los integrantes del equipo.

---

# Estado del proyecto

El núcleo de dominio se encuentra implementado y las pruebas automatizadas se ejecutan correctamente.

Resultado actual:

```text
Test Files  6 passed (6)
Tests       58 passed (58)
```

La ejecución puede verificarse con:

```bash
npm install
npm run build
npm test
npm run demo
```