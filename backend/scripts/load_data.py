"""Create the schema (data/schema.sql) and load data/*.csv into PostgreSQL + PostGIS.

    DATABASE_URL=postgresql://pulse:pulse@localhost:5432/pulse python backend/scripts/load_data.py

DATABASE_URL is read from the environment, else from ./.env or backend/.env, else the docker-compose default.
Each CSV is loaded into the table of the same name; traffic_generators_osm.csv (if present) is preferred
over traffic_generators.csv. CSV columns that are not in the table are ignored, generated columns
(geom) are filled by the database.
"""
from __future__ import annotations

import csv
import os
import sys
import time
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parent.parent
DATA = Path(os.environ.get("DATA_DIR") or ROOT / "data")
DEFAULT_URL = "postgresql://pulse:pulse@localhost:5432/pulse"  # docker-compose dev defaults, not a secret
TABLES = ["districts", "competitors", "closures", "traffic_generators", "rent", "business_for_sale", "benchmarks"]


def database_url() -> str:
    if os.environ.get("DATABASE_URL"):
        return os.environ["DATABASE_URL"]
    for env_file in (ROOT.parent / ".env", ROOT / ".env"):
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                if line.strip().startswith("DATABASE_URL="):
                    val = line.split("=", 1)[1].strip().strip("'\"")
                    if val:
                        return val
    return DEFAULT_URL


def connect(url: str, wait_s: int = 40) -> psycopg.Connection:
    deadline = time.time() + wait_s
    while True:
        try:
            return psycopg.connect(url, connect_timeout=3)
        except psycopg.OperationalError as exc:
            if time.time() > deadline:
                sys.exit(f"Cannot connect to the database ({exc}). Is `docker compose up -d` running?")
            print("waiting for database...", flush=True)
            time.sleep(2)


def coerce(value: str, data_type: str):
    v = (value or "").strip()
    if v == "":
        return None
    if data_type == "boolean":
        return v.lower() in {"1", "true", "t", "yes", "y", "да"}
    if data_type in {"integer", "bigint", "smallint"}:
        return int(float(v))
    if data_type in {"double precision", "real", "numeric"}:
        return float(v)
    return v


def source_csv(table: str) -> Path | None:
    candidates = [DATA / f"{table}_osm.csv", DATA / f"{table}.csv"] if table == "traffic_generators" else [DATA / f"{table}.csv"]
    return next((p for p in candidates if p.exists()), None)


def main() -> None:
    url = database_url()
    with connect(url) as conn:
        conn.execute((DATA / "schema.sql").read_text(encoding="utf-8"))
        for table in TABLES:
            path = source_csv(table)
            if path is None:
                print(f"skip {table}: no CSV")
                continue
            cols = conn.execute(
                "SELECT column_name, data_type FROM information_schema.columns "
                "WHERE table_name = %s AND is_generated = 'NEVER' ORDER BY ordinal_position",
                (table,),
            ).fetchall()
            types = dict(cols)
            with open(path, newline="", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                use = [c for c in (reader.fieldnames or []) if c in types]
                rows = [[coerce(r.get(c, ""), types[c]) for c in use] for r in reader]
            sql = f"INSERT INTO {table} ({', '.join(use)}) VALUES ({', '.join(['%s'] * len(use))})"
            with conn.cursor() as cur:
                cur.executemany(sql, rows)
            print(f"loaded {len(rows):>4} rows into {table} from {path.name}")
        conn.commit()
        n = conn.execute("SELECT count(*) FROM competitors WHERE ST_DWithin(geom::geography, "
                         "ST_SetSRID(ST_MakePoint(69.2052, 41.2738), 4326)::geography, 500)").fetchone()[0]
        print(f"OK. Sanity check: {n} competitors within 500 m of Chilanzar point.")


if __name__ == "__main__":
    main()
