-- PulTikma AI: PostgreSQL 16 + PostGIS schema (seed version).
-- scripts/load_data.py executes this file, then loads data/*.csv into the table with the same name
-- (traffic_generators_osm.csv, if present, is loaded into traffic_generators instead).
-- Columns in a CSV that do not exist in the table are ignored; missing columns stay NULL.
-- `source` is one of: real | estimated | synthetic.

CREATE EXTENSION IF NOT EXISTS postgis;

DROP TABLE IF EXISTS competitors, closures, traffic_generators, rent, districts, business_for_sale, benchmarks CASCADE;

CREATE TABLE competitors (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    lat       DOUBLE PRECISION NOT NULL,
    lng       DOUBLE PRECISION NOT NULL,
    category  TEXT NOT NULL,
    source    TEXT NOT NULL DEFAULT 'synthetic',
    geom      geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED
);

CREATE TABLE closures (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    lat          DOUBLE PRECISION NOT NULL,
    lng          DOUBLE PRECISION NOT NULL,
    category     TEXT NOT NULL,
    reason       TEXT,
    closed_year  INTEGER,
    source       TEXT NOT NULL DEFAULT 'synthetic',
    geom         geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED
);

CREATE TABLE traffic_generators (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    lat         DOUBLE PRECISION NOT NULL,
    lng         DOUBLE PRECISION NOT NULL,
    type        TEXT NOT NULL,
    daily_flow  INTEGER NOT NULL,
    source      TEXT NOT NULL DEFAULT 'synthetic',
    geom        geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED
);

CREATE TABLE rent (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    lat               DOUBLE PRECISION NOT NULL,
    lng               DOUBLE PRECISION NOT NULL,
    rent_per_m2_uzs   DOUBLE PRECISION NOT NULL,
    first_line        BOOLEAN NOT NULL DEFAULT FALSE,
    district          TEXT,
    area_m2           DOUBLE PRECISION,
    source            TEXT NOT NULL DEFAULT 'synthetic',
    geom              geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED
);

CREATE TABLE districts (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    lat                   DOUBLE PRECISION NOT NULL,
    lng                   DOUBLE PRECISION NOT NULL,
    avg_rent_per_m2_uzs   DOUBLE PRECISION NOT NULL,
    source                TEXT NOT NULL DEFAULT 'synthetic',
    geom                  geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED
);

CREATE TABLE business_for_sale (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    lat        DOUBLE PRECISION NOT NULL,
    lng        DOUBLE PRECISION NOT NULL,
    category   TEXT NOT NULL,
    price_usd  INTEGER,
    area_m2    DOUBLE PRECISION,
    source     TEXT NOT NULL DEFAULT 'synthetic',
    geom       geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED
);

CREATE TABLE benchmarks (
    category          TEXT PRIMARY KEY,
    avg_check_uzs     INTEGER,
    typical_area_m2   DOUBLE PRECISION,
    startup_cost_usd  INTEGER,
    payback_months    INTEGER,
    margin_pct        DOUBLE PRECISION,
    source            TEXT NOT NULL DEFAULT 'synthetic'
);

-- ST_DWithin(geom::geography, point, 500) is served by these expression indexes.
CREATE INDEX competitors_geog_idx        ON competitors        USING GIST ((geom::geography));
CREATE INDEX closures_geog_idx           ON closures           USING GIST ((geom::geography));
CREATE INDEX traffic_generators_geog_idx ON traffic_generators USING GIST ((geom::geography));
CREATE INDEX rent_geog_idx               ON rent               USING GIST ((geom::geography));
CREATE INDEX competitors_cat_idx         ON competitors (category);
CREATE INDEX closures_cat_idx            ON closures (category);
