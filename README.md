# Crédito Vecino — Sistema de Gestión de Microcrédito

Proyecto de **Análisis de Sistemas II**. La aplicación permite gestionar clientes, solicitudes y créditos; consultar cartera y mora; registrar pagos; trabajar con operaciones sin conexión desde la PWA; y consultar documentos del proyecto mediante un chat gerencial con IA.

## Tecnologías implementadas

- **Backend:** Node.js, TypeScript, Express 5.
- **Interfaz web/PWA:** React 19, Vite 7 y Tailwind CSS 4; diseño adaptable y almacenamiento local con IndexedDB.
- **Persistencia:** PostgreSQL 16 con la extensión pgvector, ejecutado con Docker Compose.
- **Dominio financiero:** `decimal.js` para cálculos decimales y `bigint` en centavos para representar dinero con exactitud.
- **IA documental (RAG):** Ollama, Qwen3 4B Instruct para generar respuestas y BGE-M3 para embeddings; LangChain para fragmentar documentos; PostgreSQL/pgvector para recuperar fuentes.
- **Integración y validación:** servidor MCP, Zod para validar entradas y Vitest para pruebas automatizadas.
- **Acceso HTTPS opcional:** Caddy para el perfil de uso móvil.

La aplicación organiza el dominio, la API, la persistencia, la PWA y el módulo RAG como un monolito modular con separación hexagonal. Las reglas de dinero, amortización, prelación de pagos y mora se mantienen en el dominio.

## Requisitos

- Node.js 20 o posterior y npm.
- Docker Desktop con Docker Compose.
- Ollama y los modelos indicados abajo para habilitar el chat gerencial con IA.

## Preparación local

Desde la carpeta del proyecto instala dependencias:

```powershell
npm install
```

Crea un archivo `.env` en la raíz del proyecto. Usa una contraseña propia y la misma en `POSTGRES_PASSWORD` y en `DATABASE_URL`:

```dotenv
POSTGRES_PASSWORD=cambia_esta_clave
DATABASE_URL=postgresql://postgres:cambia_esta_clave@127.0.0.1:5434/credito_vecino
DATOS_CANONICOS_DIR=./datos
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_CHAT_MODEL=qwen3:4b-instruct
```

El puerto `5434` del equipo se redirige al puerto `5432` de PostgreSQL dentro de Docker. No publiques ni subas `.env`; ya está excluido por `.gitignore`.

Inicia PostgreSQL y carga los datos canónicos, las cuotas y los pagos:

```powershell
docker compose up -d postgres
npm run db:load
```

## Ejecutar la aplicación

Para levantar el frontend y el API en modo desarrollo:

```powershell
npm run dev
```

Abre <http://127.0.0.1:5173>. Este comando inicia Vite y el API en paralelo.

Para ejecutar la versión compilada, que sirve la PWA y la API desde un solo puerto:

```powershell
npm run build
npm start
```

Abre <http://127.0.0.1:3000>. La terminal debe permanecer abierta mientras se usa la aplicación.

## Chat gerencial con IA (opcional)

Instala Ollama y descarga los dos modelos requeridos:

```powershell
ollama pull qwen3:4b-instruct
ollama pull bge-m3
```

Asegúrate de que Ollama esté ejecutándose en `http://127.0.0.1:11434`. Después, desde la raíz del proyecto, indexa el corpus documental en PostgreSQL:

```powershell
npm run db:rag
```

El chat responde preguntas basadas en los documentos disponibles en `datos/corpus/` y muestra las fuentes recuperadas. Si Ollama está apagado, el resto de la aplicación puede ejecutarse, pero el chat no responderá.

## Comandos útiles

| Comando | Función |
|---|---|
| `npm run build` | Compila TypeScript y genera la PWA de producción en `client-dist/`. |
| `npm test` | Ejecuta las pruebas automatizadas con Vitest. |
| `npm run test:watch` | Ejecuta Vitest en modo de observación. |
| `npm run demo` | Compila y muestra la demostración de cálculos del núcleo. |
| `npm run db:load` | Inicializa PostgreSQL y carga datos canónicos, cuotas y pagos. |
| `npm run db:materializar-cuotas` | Genera las cuotas de los créditos. |
| `npm run db:materializar-pagos` | Materializa las aplicaciones de pago. |
| `npm run db:rag` | Indexa los documentos para el chat RAG. |
| `npm run mcp` | Inicia el servidor MCP por entrada/salida estándar. |

## Persistencia sin conexión

La PWA usa **IndexedDB** en el navegador para conservar datos locales y operaciones pendientes cuando el dispositivo pierde conexión. Al reconectarse, las operaciones pendientes pueden sincronizarse con la API y PostgreSQL. La persistencia central compartida del sistema se mantiene en PostgreSQL.

## Video de demostración

[Ver videos de demostración del sistema](https://drive.google.com/drive/folders/1GLXrzmB-Z9H4jztuCO5hX833whhe13wM?usp=sharing)

## Estructura principal

```text
src/dominio/       Reglas financieras y estados del crédito
src/api/           API HTTP y control de acceso
src/persistencia/  Esquema, carga canónica y consultas PostgreSQL
src/rag/           Corpus, embeddings, recuperación y chat
src/mcp/           Herramientas para integración MCP
web/               Interfaz React, estilos, manifiesto PWA y service worker
web/src/almacen-local.ts
                   Persistencia local en IndexedDB
datos/             Datos canónicos y documentos para el RAG
tests/             Pruebas unitarias y de integración
docs/              Diagramas, decisiones arquitectónicas y especificación API
```
