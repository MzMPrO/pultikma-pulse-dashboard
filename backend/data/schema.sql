CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Конкуренты
CREATE TABLE competitors (
    id VARCHAR(16) PRIMARY KEY,
    name TEXT NOT NULL,
    category VARCHAR(32) NOT NULL CHECK (category IN ('fast_food', 'coffee', 'cafe', 'pharmacy')),
    district VARCHAR(64) NOT NULL,
    lat NUMERIC(9, 6) NOT NULL,
    lng NUMERIC(9, 6) NOT NULL,
    address TEXT,
    rating NUMERIC(2, 1),
    reviews_count INTEGER,
    avg_check_uzs BIGINT,
    status VARCHAR(32) NOT NULL CHECK (status IN ('open', 'closed_permanently')),
    closed_year INTEGER,
    sustainability_rating VARCHAR(8),
    legal_form VARCHAR(16),
    source VARCHAR(16) NOT NULL,
    source_url TEXT,
    geom GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(lng::double precision, lat::double precision), 4326)::geography
    ) STORED
);
CREATE INDEX idx_competitors_geom ON competitors USING GIST (geom);
CREATE INDEX idx_competitors_cat_status ON competitors (category, status);

-- 2. Генераторы трафика
CREATE TABLE traffic_generators (
    id VARCHAR(16) PRIMARY KEY,
    name TEXT NOT NULL,
    type VARCHAR(32) NOT NULL,
    district VARCHAR(64) NOT NULL,
    lat NUMERIC(9, 6) NOT NULL,
    lng NUMERIC(9, 6) NOT NULL,
    est_daily_people INTEGER NOT NULL,
    source VARCHAR(16) NOT NULL,
    source_url TEXT,
    geom GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(lng::double precision, lat::double precision), 4326)::geography
    ) STORED
);
CREATE INDEX idx_traffic_generators_geom ON traffic_generators USING GIST (geom);

-- 3. Закрытия бизнесов
CREATE TABLE closures (
    id VARCHAR(16) PRIMARY KEY,
    competitor_id VARCHAR(16) REFERENCES competitors(id),
    name TEXT NOT NULL,
    category VARCHAR(32) NOT NULL,
    district VARCHAR(64) NOT NULL,
    lat NUMERIC(9, 6) NOT NULL,
    lng NUMERIC(9, 6) NOT NULL,
    opened_year INTEGER,
    closed_year INTEGER,
    closure_reason TEXT,
    reason_category VARCHAR(32),
    evidence TEXT,
    source VARCHAR(16) NOT NULL,
    source_url TEXT,
    geom GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(lng::double precision, lat::double precision), 4326)::geography
    ) STORED
);
CREATE INDEX idx_closures_geom ON closures USING GIST (geom);

-- 4. Продажа готового бизнеса
CREATE TABLE business_for_sale (
    id VARCHAR(16) PRIMARY KEY,
    title TEXT NOT NULL,
    category VARCHAR(32) NOT NULL,
    district VARCHAR(64) NOT NULL,
    lat NUMERIC(9, 6) NOT NULL,
    lng NUMERIC(9, 6) NOT NULL,
    price_uzs BIGINT,
    monthly_revenue_uzs BIGINT,
    reason_for_sale TEXT,
    posted_date DATE,
    source VARCHAR(16) NOT NULL,
    source_url TEXT,
    geom GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(lng::double precision, lat::double precision), 4326)::geography
    ) STORED
);
CREATE INDEX idx_business_for_sale_geom ON business_for_sale USING GIST (geom);

-- 5. Аренда коммерческих помещений
CREATE TABLE rent (
    id VARCHAR(16) PRIMARY KEY,
    district VARCHAR(64) NOT NULL,
    street TEXT NOT NULL,
    lat NUMERIC(9, 6) NOT NULL,
    lng NUMERIC(9, 6) NOT NULL,
    area_m2 NUMERIC(8, 2) NOT NULL,
    price_month_uzs BIGINT NOT NULL,
    price_per_m2_uzs BIGINT NOT NULL,
    floor INTEGER,
    first_line BOOLEAN,
    source VARCHAR(16) NOT NULL,
    source_url TEXT,
    geom GEOGRAPHY(Point, 4326) GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint(lng::double precision, lat::double precision), 4326)::geography
    ) STORED
);
CREATE INDEX idx_rent_geom ON rent USING GIST (geom);

-- 6. Статистика районов
CREATE TABLE districts (
    district VARCHAR(64) PRIMARY KEY,
    population INTEGER,
    area_km2 NUMERIC(8, 2),
    density_per_km2 INTEGER,
    smb_count INTEGER,
    food_service_count INTEGER,
    closures_last_year INTEGER,
    avg_rent_per_m2_uzs BIGINT,
    source VARCHAR(16) NOT NULL,
    source_url TEXT
);

-- 7. Бенчмарки финмодели
CREATE TABLE benchmarks (
    id SERIAL PRIMARY KEY,
    metric VARCHAR(64) NOT NULL,
    category VARCHAR(64) NOT NULL,
    value NUMERIC(16, 2) NOT NULL,
    unit VARCHAR(32) NOT NULL,
    source VARCHAR(16) NOT NULL,
    source_url TEXT
);

-- Команды быстрой загрузки CSV через psql:
-- \copy competitors(id,name,category,district,lat,lng,address,rating,reviews_count,avg_check_uzs,status,closed_year,sustainability_rating,legal_form,source,source_url) FROM 'competitors.csv' WITH (FORMAT csv, HEADER true, NULL '');
-- \copy traffic_generators(id,name,type,district,lat,lng,est_daily_people,source,source_url) FROM 'traffic_generators.csv' WITH (FORMAT csv, HEADER true, NULL '');
-- \copy closures(id,competitor_id,name,category,district,lat,lng,opened_year,closed_year,closure_reason,reason_category,evidence,source,source_url) FROM 'closures.csv' WITH (FORMAT csv, HEADER true, NULL '');
-- \copy business_for_sale(id,title,category,district,lat,lng,price_uzs,monthly_revenue_uzs,reason_for_sale,posted_date,source,source_url) FROM 'business_for_sale.csv' WITH (FORMAT csv, HEADER true, NULL '');
-- \copy rent(id,district,street,lat,lng,area_m2,price_month_uzs,price_per_m2_uzs,floor,first_line,source,source_url) FROM 'rent.csv' WITH (FORMAT csv, HEADER true, NULL '');
-- \copy districts(district,population,area_km2,density_per_km2,smb_count,food_service_count,closures_last_year,avg_rent_per_m2_uzs,source,source_url) FROM 'districts.csv' WITH (FORMAT csv, HEADER true, NULL '');
-- \copy benchmarks(metric,category,value,unit,source,source_url) FROM 'benchmarks.csv' WITH (FORMAT csv, HEADER true, NULL '');
