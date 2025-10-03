const { Pool } = require('pg');

class DatabaseService {
  constructor() {
    this.pool = null;
  }

  async connect() {
    try {
      this.pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'dispersion',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'ala1nna',
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });

      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      console.log('Database connection established successfully');
      
      // Initialize database schema
      await this.initializeSchema();
      
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      console.log('Database connection closed');
    }
  }

  async query(text, params) {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text: text.substring(0, 100) + '...', duration, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async initializeSchema() {
    try {
      console.log('Initializing database schema...');
      
      // Check if tables exist, if not create them
      const tableCheckQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'chemicals'
      `;
      
      const result = await this.query(tableCheckQuery);
      
      if (result.rows.length === 0) {
        console.log('Tables not found, creating schema...');
        await this.createTables();
        await this.insertInitialData();
      } else {
        console.log('Database schema already exists');
      }
      
    } catch (error) {
      console.error('Error initializing schema:', error);
      throw error;
    }
  }

  async createTables() {
    const createTablesSQL = `
      -- Enable PostGIS extension for spatial data
      CREATE EXTENSION IF NOT EXISTS postgis;
      
      -- Chemicals table
      CREATE TABLE IF NOT EXISTS chemicals (
        id SERIAL PRIMARY KEY,
        cameo_id VARCHAR(50) UNIQUE,
        name VARCHAR(255) NOT NULL UNIQUE,
        cas_number VARCHAR(20),
        molecular_weight DECIMAL(10,4),
        density DECIMAL(10,4),
        vapor_pressure DECIMAL(15,6),
        boiling_point DECIMAL(8,2),
        melting_point DECIMAL(8,2),
        solubility DECIMAL(10,4),
        henry_constant DECIMAL(15,6),
        diffusion_coefficient DECIMAL(15,6),
        volatility_class VARCHAR(20),
        physical_state VARCHAR(20),
        toxicity_data JSONB,
        safety_data JSONB,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Weather stations table
      CREATE TABLE IF NOT EXISTS weather_stations (
        id SERIAL PRIMARY KEY,
        station_id VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(255),
        location GEOMETRY(POINT, 4326),
        elevation DECIMAL(8,2),
        station_type VARCHAR(50),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Weather data table
      CREATE TABLE IF NOT EXISTS weather_data (
        id SERIAL PRIMARY KEY,
        station_id INTEGER REFERENCES weather_stations(id),
        timestamp TIMESTAMP NOT NULL,
        temperature DECIMAL(5,2),
        humidity DECIMAL(5,2),
        pressure DECIMAL(8,2),
        wind_speed DECIMAL(6,2),
        wind_direction DECIMAL(5,1),
        precipitation DECIMAL(6,2),
        cloud_cover DECIMAL(3,1),
        visibility DECIMAL(6,2),
        solar_radiation DECIMAL(8,2),
        atmospheric_stability VARCHAR(10),
        mixing_height DECIMAL(8,2),
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Buildings table
      CREATE TABLE IF NOT EXISTS buildings (
        id SERIAL PRIMARY KEY,
        geometry GEOMETRY(POLYGON, 4326),
        height DECIMAL(8,2),
        building_type VARCHAR(100),
        stories INTEGER,
        roof_type VARCHAR(50),
        material VARCHAR(100),
        occupancy INTEGER,
        properties JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Topography data table
      CREATE TABLE IF NOT EXISTS topography (
        id SERIAL PRIMARY KEY,
        geometry GEOMETRY(POLYGON, 4326),
        elevation DECIMAL(8,2),
        slope DECIMAL(5,2),
        aspect DECIMAL(5,1),
        land_use VARCHAR(100),
        roughness_length DECIMAL(8,4),
        properties JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Receptors table
      CREATE TABLE IF NOT EXISTS receptors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        location GEOMETRY(POINT, 4326),
        receptor_type VARCHAR(50),
        height DECIMAL(6,2),
        sensitivity_level VARCHAR(20),
        population INTEGER,
        properties JSONB,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Release events table
      CREATE TABLE IF NOT EXISTS release_events (
        id SERIAL PRIMARY KEY,
        location GEOMETRY(POINT, 4326),
        chemical_id INTEGER REFERENCES chemicals(id),
        release_type VARCHAR(50),
        release_rate DECIMAL(12,4),
        total_mass DECIMAL(12,4),
        release_height DECIMAL(8,2),
        temperature DECIMAL(6,2),
        duration DECIMAL(10,2),
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        weather_conditions JSONB,
        status VARCHAR(20) DEFAULT 'active',
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Dispersion calculations table
      CREATE TABLE IF NOT EXISTS dispersion_calculations (
        id SERIAL PRIMARY KEY,
        release_event_id INTEGER REFERENCES release_events(id),
        calculation_time TIMESTAMP NOT NULL,
        plume_geometry GEOMETRY(POLYGON, 4326),
        max_concentration DECIMAL(15,6),
        affected_area DECIMAL(12,2),
        calculation_method VARCHAR(50),
        meteorological_conditions JSONB,
        model_parameters JSONB,
        receptor_impacts JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Receptor impacts table
      CREATE TABLE IF NOT EXISTS receptor_impacts (
        id SERIAL PRIMARY KEY,
        dispersion_calculation_id INTEGER REFERENCES dispersion_calculations(id),
        receptor_id INTEGER REFERENCES receptors(id),
        concentration DECIMAL(15,6),
        dose DECIMAL(15,6),
        exposure_time DECIMAL(10,2),
        health_impact_level VARCHAR(20),
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- GIS data imports table
      CREATE TABLE IF NOT EXISTS gis_imports (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255),
        file_type VARCHAR(50),
        import_type VARCHAR(50),
        geometry_type VARCHAR(50),
        features_count INTEGER,
        projection VARCHAR(100),
        status VARCHAR(20),
        error_message TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- User sessions table (for future authentication)
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) UNIQUE,
        user_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_weather_data_timestamp ON weather_data(timestamp);
      CREATE INDEX IF NOT EXISTS idx_weather_data_station ON weather_data(station_id);
      CREATE INDEX IF NOT EXISTS idx_buildings_geometry ON buildings USING GIST(geometry);
      CREATE INDEX IF NOT EXISTS idx_topography_geometry ON topography USING GIST(geometry);
      CREATE INDEX IF NOT EXISTS idx_receptors_location ON receptors USING GIST(location);
      CREATE INDEX IF NOT EXISTS idx_release_events_location ON release_events USING GIST(location);
      CREATE INDEX IF NOT EXISTS idx_release_events_status ON release_events(status);
      CREATE INDEX IF NOT EXISTS idx_dispersion_calc_release ON dispersion_calculations(release_event_id);
      CREATE INDEX IF NOT EXISTS idx_dispersion_calc_time ON dispersion_calculations(calculation_time);
      CREATE INDEX IF NOT EXISTS idx_receptor_impacts_dispersion ON receptor_impacts(dispersion_calculation_id);
      CREATE INDEX IF NOT EXISTS idx_receptor_impacts_receptor ON receptor_impacts(receptor_id);

      -- Create triggers for updated_at timestamps
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      CREATE TRIGGER update_chemicals_updated_at BEFORE UPDATE ON chemicals
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      CREATE TRIGGER update_release_events_updated_at BEFORE UPDATE ON release_events
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `;

    await this.query(createTablesSQL);
    console.log('Database tables created successfully');
  }

  async insertInitialData() {
    try {
      console.log('Inserting initial data...');
      
      // Insert common chemicals
      const chemicalsData = `
        INSERT INTO chemicals (name, cas_number, molecular_weight, density, vapor_pressure, boiling_point, physical_state, volatility_class) VALUES
        ('Chlorine', '7782-50-5', 70.906, 3.214, 6800, -34.04, 'gas', 'high'),
        ('Ammonia', '7664-41-7', 17.031, 0.73, 8600, -33.34, 'gas', 'high'),
        ('Sulfur Dioxide', '7446-09-5', 64.066, 2.619, 3300, -10.05, 'gas', 'high'),
        ('Hydrogen Sulfide', '7783-06-4', 34.081, 1.539, 18600, -60.28, 'gas', 'high'),
        ('Benzene', '71-43-2', 78.114, 0.8765, 95, 80.1, 'liquid', 'medium'),
        ('Toluene', '108-88-3', 92.141, 0.8669, 29, 110.6, 'liquid', 'medium'),
        ('Acetone', '67-64-1', 58.080, 0.791, 231, 56.0, 'liquid', 'high'),
        ('Methanol', '67-56-1', 32.042, 0.7918, 128, 64.7, 'liquid', 'medium')
        ON CONFLICT (name) DO NOTHING;
      `;
      
      await this.query(chemicalsData);
      
      // Insert default weather station (will be updated with real data)
      const weatherStationData = `
        INSERT INTO weather_stations (station_id, name, location, elevation, station_type) VALUES
        ('DEFAULT', 'Default Weather Station', ST_GeomFromText('POINT(-95.7129 37.0902)', 4326), 200, 'virtual')
        ON CONFLICT (station_id) DO NOTHING;
      `;
      
      await this.query(weatherStationData);
      
      console.log('Initial data inserted successfully');
      
    } catch (error) {
      console.error('Error inserting initial data:', error);
      throw error;
    }
  }

  getPool() {
    return this.pool;
  }
}

module.exports = new DatabaseService();