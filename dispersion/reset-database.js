const { Pool } = require('pg');
const DatabaseService = require('./src/services/DatabaseService');

async function resetDatabase() {
  console.log('Starting database schema reset...');
  
  const db = DatabaseService;
  
  try {
    await db.connect();
    
    console.log('Dropping existing tables...');
    
    // Drop tables in reverse order due to foreign key constraints
    const dropTables = `
      DROP TABLE IF EXISTS receptor_impacts CASCADE;
      DROP TABLE IF EXISTS dispersion_calculations CASCADE;
      DROP TABLE IF EXISTS release_events CASCADE;
      DROP TABLE IF EXISTS receptors CASCADE;
      DROP TABLE IF EXISTS topography CASCADE;
      DROP TABLE IF EXISTS buildings CASCADE;
      DROP TABLE IF EXISTS weather_data CASCADE;
      DROP TABLE IF EXISTS weather_stations CASCADE;
      DROP TABLE IF EXISTS chemicals CASCADE;
      DROP TABLE IF EXISTS gis_imports CASCADE;
      DROP TABLE IF EXISTS user_sessions CASCADE;
      
      -- Drop functions and triggers
      DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
    `;
    
    await db.query(dropTables);
    console.log('Existing tables dropped successfully');
    
    // Now recreate the schema
    console.log('Creating new schema...');
    await db.createTables();
    await db.insertInitialData();
    
    console.log('Database schema reset completed successfully!');
    
  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  } finally {
    await db.disconnect();
  }
}

// Run the reset
resetDatabase()
  .then(() => {
    console.log('Database reset completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Database reset failed:', error);
    process.exit(1);
  });