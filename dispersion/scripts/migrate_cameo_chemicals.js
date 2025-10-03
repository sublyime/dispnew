const DatabaseService = require('../src/services/DatabaseService');

/**
 * Migration script to update chemicals table for CAMEO Chemicals integration
 * Adds necessary fields to support NOAA CAMEO database properties
 */
async function migrateCameoChemicals() {
  console.log('Starting CAMEO Chemicals database migration...');

  try {
    await DatabaseService.connect();

    // Add CAMEO-specific columns to chemicals table
    const addColumnsSQL = `
      -- Add CAMEO identifier and formula if not exists
      ALTER TABLE chemicals 
      ADD COLUMN IF NOT EXISTS cameo_id VARCHAR(20) UNIQUE,
      ADD COLUMN IF NOT EXISTS formula VARCHAR(100),
      
      -- Add additional physical properties for ALOHA modeling
      ADD COLUMN IF NOT EXISTS critical_temperature DECIMAL(8,2),
      ADD COLUMN IF NOT EXISTS critical_pressure DECIMAL(12,2),
      ADD COLUMN IF NOT EXISTS heat_of_vaporization DECIMAL(12,2),
      ADD COLUMN IF NOT EXISTS specific_heat DECIMAL(8,4),
      ADD COLUMN IF NOT EXISTS thermal_conductivity DECIMAL(10,6),
      
      -- Add safety and toxicity properties
      ADD COLUMN IF NOT EXISTS flash_point DECIMAL(8,2),
      ADD COLUMN IF NOT EXISTS autoignition_temperature DECIMAL(8,2),
      ADD COLUMN IF NOT EXISTS twa DECIMAL(10,4),
      ADD COLUMN IF NOT EXISTS stel DECIMAL(10,4),
      ADD COLUMN IF NOT EXISTS idlh DECIMAL(10,4),
      ADD COLUMN IF NOT EXISTS lc50 DECIMAL(10,4),
      
      -- Add dispersion-specific properties
      ADD COLUMN IF NOT EXISTS deposition_velocity DECIMAL(8,6),
      ADD COLUMN IF NOT EXISTS atmospheric_lifetime INTEGER,
      ADD COLUMN IF NOT EXISTS is_heavy_gas BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS hazard_classification VARCHAR(50),
      
      -- Add metadata fields
      ADD COLUMN IF NOT EXISTS data_source VARCHAR(100) DEFAULT 'CAMEO Chemicals',
      ADD COLUMN IF NOT EXISTS quality_score DECIMAL(3,2),
      ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `;

    await DatabaseService.query(addColumnsSQL);
    console.log('✅ Added CAMEO columns to chemicals table');

    // Create index on CAMEO ID for faster lookups
    const createIndexSQL = `
      CREATE INDEX IF NOT EXISTS idx_chemicals_cameo_id ON chemicals(cameo_id);
      CREATE INDEX IF NOT EXISTS idx_chemicals_cas_number ON chemicals(cas_number);
      CREATE INDEX IF NOT EXISTS idx_chemicals_formula ON chemicals(formula);
    `;

    await DatabaseService.query(createIndexSQL);
    console.log('✅ Created indexes for chemical lookup');

    // Update the chemicals table constraint to allow duplicate names (since CAMEO may have variants)
    const updateConstraintsSQL = `
      -- Drop the unique constraint on name to allow for chemical variants
      ALTER TABLE chemicals DROP CONSTRAINT IF EXISTS chemicals_name_key;
      
      -- Add a unique constraint on cameo_id instead
      ALTER TABLE chemicals ADD CONSTRAINT chemicals_cameo_id_unique UNIQUE (cameo_id);
    `;

    await DatabaseService.query(updateConstraintsSQL);
    console.log('✅ Updated table constraints for CAMEO integration');

    // Insert some sample CAMEO chemicals if table is empty
    const countQuery = 'SELECT COUNT(*) FROM chemicals';
    const countResult = await DatabaseService.query(countQuery);
    
    if (parseInt(countResult.rows[0].count) === 0) {
      console.log('Inserting sample CAMEO chemicals...');
      await insertSampleCameoChemicals();
    }

    console.log('🎉 CAMEO Chemicals migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Insert sample chemicals from CAMEO database
 */
async function insertSampleCameoChemicals() {
  const sampleChemicals = [
    {
      cameo_id: 'CAM001',
      name: 'Chlorine',
      cas_number: '7782-50-5',
      formula: 'Cl2',
      molecular_weight: 70.906,
      density: 3.214,
      vapor_pressure: 687000,
      boiling_point: 239.11,
      melting_point: 171.6,
      critical_temperature: 417.0,
      critical_pressure: 7991000,
      heat_of_vaporization: 20410,
      specific_heat: 0.479,
      thermal_conductivity: 0.0089,
      physical_state: 'Gas',
      volatility_class: 'high',
      twa: 0.5,
      stel: 1.0,
      idlh: 10,
      lc50: 293,
      is_heavy_gas: true,
      hazard_classification: 'extremely_toxic',
      deposition_velocity: 0.01,
      atmospheric_lifetime: 3600,
      quality_score: 0.95
    },
    {
      cameo_id: 'CAM002',
      name: 'Ammonia',
      cas_number: '7664-41-7',
      formula: 'NH3',
      molecular_weight: 17.031,
      density: 0.771,
      vapor_pressure: 857000,
      boiling_point: 239.82,
      melting_point: 195.42,
      critical_temperature: 405.4,
      critical_pressure: 11333000,
      heat_of_vaporization: 23350,
      specific_heat: 2.19,
      thermal_conductivity: 0.0249,
      physical_state: 'Gas',
      volatility_class: 'high',
      twa: 25,
      stel: 35,
      idlh: 300,
      lc50: 2000,
      is_heavy_gas: false,
      hazard_classification: 'toxic',
      deposition_velocity: 0.02,
      atmospheric_lifetime: 7200,
      quality_score: 0.90
    },
    {
      cameo_id: 'CAM003',
      name: 'Sulfur dioxide',
      cas_number: '7446-09-5',
      formula: 'SO2',
      molecular_weight: 64.066,
      density: 2.927,
      vapor_pressure: 330000,
      boiling_point: 263.13,
      melting_point: 200.0,
      critical_temperature: 430.8,
      critical_pressure: 7884000,
      heat_of_vaporization: 24940,
      specific_heat: 0.640,
      thermal_conductivity: 0.0086,
      physical_state: 'Gas',
      volatility_class: 'high',
      twa: 2,
      stel: 5,
      idlh: 100,
      lc50: 2520,
      is_heavy_gas: true,
      hazard_classification: 'toxic',
      deposition_velocity: 0.012,
      atmospheric_lifetime: 1800,
      quality_score: 0.88
    }
  ];

  for (const chemical of sampleChemicals) {
    const insertSQL = `
      INSERT INTO chemicals (
        cameo_id, name, cas_number, formula, molecular_weight, density,
        vapor_pressure, boiling_point, melting_point, critical_temperature,
        critical_pressure, heat_of_vaporization, specific_heat, thermal_conductivity,
        physical_state, volatility_class, twa, stel, idlh, lc50,
        is_heavy_gas, hazard_classification, deposition_velocity,
        atmospheric_lifetime, quality_score, data_source, last_updated
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
      ) ON CONFLICT (cameo_id) DO NOTHING
    `;

    const values = [
      chemical.cameo_id, chemical.name, chemical.cas_number, chemical.formula,
      chemical.molecular_weight, chemical.density, chemical.vapor_pressure,
      chemical.boiling_point, chemical.melting_point, chemical.critical_temperature,
      chemical.critical_pressure, chemical.heat_of_vaporization, chemical.specific_heat,
      chemical.thermal_conductivity, chemical.physical_state, chemical.volatility_class,
      chemical.twa, chemical.stel, chemical.idlh, chemical.lc50,
      chemical.is_heavy_gas, chemical.hazard_classification, chemical.deposition_velocity,
      chemical.atmospheric_lifetime, chemical.quality_score, 'CAMEO Chemicals', new Date()
    ];

    await DatabaseService.query(insertSQL, values);
    console.log(`  ✓ Inserted ${chemical.name} (${chemical.cameo_id})`);
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateCameoChemicals()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateCameoChemicals, insertSampleCameoChemicals };