CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS cargas_canonicas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sha256_eventos CHAR(64) NOT NULL UNIQUE,
    nombre_archivo TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'EN_PROCESO'
        CHECK (estado IN ('EN_PROCESO', 'COMPLETADA', 'FALLIDA')),
    eventos_leidos INTEGER NOT NULL DEFAULT 0 CHECK (eventos_leidos >= 0),
    clientes_leidos INTEGER NOT NULL DEFAULT 0 CHECK (clientes_leidos >= 0),
    desembolsos_leidos INTEGER NOT NULL DEFAULT 0 CHECK (desembolsos_leidos >= 0),
    pagos_leidos INTEGER NOT NULL DEFAULT 0 CHECK (pagos_leidos >= 0),
    pagos_unicos INTEGER NOT NULL DEFAULT 0 CHECK (pagos_unicos >= 0),
    pagos_duplicados INTEGER NOT NULL DEFAULT 0 CHECK (pagos_duplicados >= 0),
    iniciada_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completada_en TIMESTAMPTZ,
    CHECK (pagos_leidos = pagos_unicos + pagos_duplicados)
);

CREATE TABLE IF NOT EXISTS asesores (
    id_asesor TEXT PRIMARY KEY,
    nombre_completo TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS eventos_canonicos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    carga_id BIGINT NOT NULL REFERENCES cargas_canonicas(id),
    secuencia_fuente BIGINT NOT NULL CHECK (secuencia_fuente > 0),
    tipo TEXT NOT NULL
        CHECK (tipo IN ('CLIENTE', 'DESEMBOLSO', 'PAGO')),
    payload JSONB NOT NULL,
    UNIQUE (carga_id, secuencia_fuente)
);

CREATE TABLE IF NOT EXISTS clientes (
    id_cliente TEXT PRIMARY KEY,
    nombre_completo TEXT NOT NULL,
    dpi TEXT NOT NULL UNIQUE,
    telefono TEXT NOT NULL,
    municipio TEXT NOT NULL,
    fecha_alta DATE NOT NULL,
    evento_origen_id BIGINT NOT NULL UNIQUE
        REFERENCES eventos_canonicos(id)
);

ALTER TABLE clientes ALTER COLUMN evento_origen_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS creditos (
    id_credito TEXT PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente),
    id_asesor TEXT NOT NULL REFERENCES asesores(id_asesor),
    fecha_otorgamiento DATE NOT NULL,
    capital_centavos BIGINT NOT NULL CHECK (capital_centavos > 0),
    plazo_meses SMALLINT NOT NULL CHECK (plazo_meses BETWEEN 3 AND 24),
    tna_bps INTEGER NOT NULL CHECK (tna_bps >= 0),
    reestructurado BOOLEAN NOT NULL DEFAULT FALSE,
    evento_origen_id BIGINT NOT NULL UNIQUE
        REFERENCES eventos_canonicos(id)
);

ALTER TABLE creditos ALTER COLUMN evento_origen_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS pagos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    clave_idempotencia TEXT NOT NULL UNIQUE,
    id_credito TEXT NOT NULL REFERENCES creditos(id_credito),
    fecha DATE NOT NULL,
    monto_centavos BIGINT NOT NULL CHECK (monto_centavos > 0),
    canal TEXT NOT NULL,
    evento_origen_id BIGINT NOT NULL UNIQUE
        REFERENCES eventos_canonicos(id)
);

ALTER TABLE pagos ALTER COLUMN evento_origen_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS politicas_mora (
    codigo TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('plana', 'escalonada')),
    vigencia_desde DATE,
    vigencia_hasta DATE,
    parametros JSONB NOT NULL,
    autor TEXT NOT NULL,
    motivo TEXT NOT NULL,
    CHECK (
        vigencia_desde IS NULL
        OR vigencia_hasta IS NULL
        OR vigencia_hasta >= vigencia_desde
    )
);

CREATE TABLE IF NOT EXISTS configuracion_sistema (
    clave TEXT PRIMARY KEY,
    valor JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS cuotas_credito (
    id_credito TEXT NOT NULL
        REFERENCES creditos(id_credito) ON DELETE CASCADE,
    numero_cuota SMALLINT NOT NULL CHECK (numero_cuota > 0),
    fecha_vencimiento DATE NOT NULL,
    saldo_inicial_centavos BIGINT NOT NULL
        CHECK (saldo_inicial_centavos >= 0),
    interes_centavos BIGINT NOT NULL
        CHECK (interes_centavos >= 0),
    capital_centavos BIGINT NOT NULL
        CHECK (capital_centavos >= 0),
    monto_cuota_centavos BIGINT NOT NULL
        CHECK (monto_cuota_centavos > 0),
    saldo_final_centavos BIGINT NOT NULL
        CHECK (saldo_final_centavos >= 0),
    PRIMARY KEY (id_credito, numero_cuota)
);

CREATE INDEX IF NOT EXISTS idx_cuotas_fecha_vencimiento
    ON cuotas_credito (fecha_vencimiento);

CREATE TABLE IF NOT EXISTS aplicaciones_pagos (
    pago_id BIGINT PRIMARY KEY REFERENCES pagos(id) ON DELETE CASCADE,
    monto_pago_centavos BIGINT NOT NULL CHECK (monto_pago_centavos > 0),
    gastos_centavos BIGINT NOT NULL DEFAULT 0 CHECK (gastos_centavos >= 0),
    interes_moratorio_centavos BIGINT NOT NULL DEFAULT 0
        CHECK (interes_moratorio_centavos >= 0),
    interes_corriente_centavos BIGINT NOT NULL DEFAULT 0
        CHECK (interes_corriente_centavos >= 0),
    capital_centavos BIGINT NOT NULL DEFAULT 0 CHECK (capital_centavos >= 0),
    excedente_centavos BIGINT NOT NULL DEFAULT 0 CHECK (excedente_centavos >= 0),
    aplicado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        monto_pago_centavos =
            gastos_centavos
            + interes_moratorio_centavos
            + interes_corriente_centavos
            + capital_centavos
            + excedente_centavos
    )
);

CREATE TABLE IF NOT EXISTS solicitudes_credito (
    id_solicitud UUID PRIMARY KEY,
    id_cliente TEXT NOT NULL REFERENCES clientes(id_cliente),
    monto_centavos BIGINT NOT NULL CHECK (monto_centavos BETWEEN 100000 AND 2500000),
    plazo_meses SMALLINT NOT NULL CHECK (plazo_meses BETWEEN 3 AND 24),
    tna_bps INTEGER NOT NULL CHECK (tna_bps > 0),
    motivo TEXT NOT NULL CHECK (length(trim(motivo)) BETWEEN 3 AND 500),
    estado TEXT NOT NULL DEFAULT 'SOLICITADO'
        CHECK (estado IN ('SOLICITADO', 'APROBADO', 'RECHAZADO')),
    fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE solicitudes_credito
    ADD COLUMN IF NOT EXISTS clave_idempotencia UUID;

ALTER TABLE solicitudes_credito
    ADD COLUMN IF NOT EXISTS fecha_operacion DATE;

ALTER TABLE solicitudes_credito
    ADD COLUMN IF NOT EXISTS id_credito TEXT REFERENCES creditos(id_credito);

ALTER TABLE solicitudes_credito
    DROP CONSTRAINT IF EXISTS solicitudes_credito_estado_check;

ALTER TABLE solicitudes_credito
    ADD CONSTRAINT solicitudes_credito_estado_check
    CHECK (estado IN ('SOLICITADO', 'APROBADO', 'RECHAZADO', 'DESEMBOLSADO'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_solicitudes_idempotencia
    ON solicitudes_credito (clave_idempotencia);

CREATE INDEX IF NOT EXISTS idx_solicitudes_cliente_fecha
    ON solicitudes_credito (id_cliente, fecha_solicitud DESC);

CREATE TABLE IF NOT EXISTS cierres (
    tipo TEXT NOT NULL CHECK (tipo IN ('DIARIO', 'MENSUAL')),
    fecha_corte DATE NOT NULL,
    resumen JSONB NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tipo, fecha_corte)
);

CREATE TABLE IF NOT EXISTS documentos_rag (
    doc_id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    vigencia TEXT NOT NULL,
    sha256 CHAR(64) NOT NULL,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fragmentos_rag (
    doc_id TEXT NOT NULL REFERENCES documentos_rag(doc_id) ON DELETE CASCADE,
    numero INTEGER NOT NULL CHECK (numero >= 0),
    contenido TEXT NOT NULL,
    embedding vector(1024) NOT NULL,
    PRIMARY KEY (doc_id, numero)
);
