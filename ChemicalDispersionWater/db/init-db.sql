CREATE TABLE chemicals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    properties JSONB
);

CREATE TABLE spills (
    id SERIAL PRIMARY KEY,
    chemical_id INTEGER REFERENCES chemicals(id),
    volume REAL NOT NULL,
    location geometry(Point, 4326) NOT NULL,
    timestamp TIMESTAMP NOT NULL
);

CREATE TABLE weather (
    id SERIAL PRIMARY KEY,
    measurement_time TIMESTAMP NOT NULL,
    temperature REAL,
    wind_speed REAL
);

CREATE TABLE tides (
    id SERIAL PRIMARY KEY,
    measurement_time TIMESTAMP NOT NULL,
    tidal_height REAL
);
