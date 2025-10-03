const DatabaseService = require('./src/services/DatabaseService');

async function fixGeometryColumn() {
  try {
    console.log('Initializing database connection...');
    await DatabaseService.connect();
    
    console.log('Dropping and recreating dispersion_calculations table...');
    
    // Drop the table
    await DatabaseService.query('DROP TABLE IF EXISTS dispersion_calculations CASCADE');
    
    // Recreate with TEXT column
    const createTableQuery = `
      CREATE TABLE dispersion_calculations (
        id SERIAL PRIMARY KEY,
        release_event_id INTEGER REFERENCES release_events(id),
        calculation_time TIMESTAMP NOT NULL,
        plume_geometry TEXT, -- Changed from GEOMETRY to TEXT
        max_concentration DECIMAL(15,6),
        affected_area DECIMAL(12,2),
        calculation_method VARCHAR(50),
        meteorological_conditions JSONB,
        model_parameters JSONB,
        receptor_impacts JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await DatabaseService.query(createTableQuery);
    
    console.log('Table recreated successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('Error fixing geometry column:', error);
    process.exit(1);
  }
}

fixGeometryColumn();