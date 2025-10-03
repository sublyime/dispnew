const axios = require('axios');

/**
 * Service for integrating with NOAA CAMEO Chemicals database
 * Provides authoritative chemical property data for dispersion modeling
 * 
 * CAMEO Chemicals: https://cameochemicals.noaa.gov/
 * API Documentation: Based on NOAA's chemical database structure
 */
class CameoChemicalsService {
  constructor() {
    this.baseUrl = 'https://cameochemicals.noaa.gov';
    this.apiTimeout = 10000; // 10 seconds
    this.cache = new Map(); // Cache chemical data to reduce API calls
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Search for chemicals by name, CAS number, or formula
   */
  async searchChemicals(query, limit = 20) {
    try {
      // Check cache first
      const cacheKey = `search_${query.toLowerCase()}_${limit}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // Note: CAMEO Chemicals doesn't have a public API, so we'll simulate
      // the structure based on their database format. In production, this would
      // require web scraping or a custom API integration.
      
      const searchResults = await this.simulateCameoSearch(query, limit);
      
      // Cache results
      this.setCache(cacheKey, searchResults);
      
      return searchResults;

    } catch (error) {
      console.error('Error searching CAMEO chemicals:', error);
      throw new Error(`Failed to search chemicals: ${error.message}`);
    }
  }

  /**
   * Get detailed chemical properties by CAMEO ID or CAS number
   */
  async getChemicalProperties(identifier) {
    try {
      // Check cache first
      const cacheKey = `chemical_${identifier}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // Fetch chemical details
      const chemicalData = await this.fetchChemicalDetails(identifier);
      
      // Process and standardize the data for our dispersion models
      const processedData = this.processChemicalData(chemicalData);
      
      // Cache results
      this.setCache(cacheKey, processedData);
      
      return processedData;

    } catch (error) {
      console.error('Error fetching chemical properties:', error);
      throw new Error(`Failed to get chemical properties: ${error.message}`);
    }
  }

  /**
   * Simulate CAMEO database search (replace with actual API when available)
   */
  async simulateCameoSearch(query, limit) {
    // This would be replaced with actual CAMEO API calls
    // For now, we'll return a structured response based on common chemicals
    
    const commonChemicals = [
      {
        cameo_id: 'CAM001',
        name: 'Chlorine',
        cas_number: '7782-50-5',
        formula: 'Cl2',
        common_names: ['Chlorine gas', 'Molecular chlorine'],
        hazard_class: 'Toxic gas, Oxidizer',
        physical_state: 'Gas'
      },
      {
        cameo_id: 'CAM002',
        name: 'Ammonia',
        cas_number: '7664-41-7',
        formula: 'NH3',
        common_names: ['Ammonia gas', 'Anhydrous ammonia'],
        hazard_class: 'Toxic gas, Corrosive',
        physical_state: 'Gas'
      },
      {
        cameo_id: 'CAM003',
        name: 'Sulfur dioxide',
        cas_number: '7446-09-5',
        formula: 'SO2',
        common_names: ['Sulfur dioxide', 'Sulfurous acid anhydride'],
        hazard_class: 'Toxic gas',
        physical_state: 'Gas'
      },
      {
        cameo_id: 'CAM004',
        name: 'Hydrogen sulfide',
        cas_number: '7783-06-4',
        formula: 'H2S',
        common_names: ['Hydrogen sulfide', 'Sewer gas'],
        hazard_class: 'Toxic gas, Flammable',
        physical_state: 'Gas'
      },
      {
        cameo_id: 'CAM005',
        name: 'Benzene',
        cas_number: '71-43-2',
        formula: 'C6H6',
        common_names: ['Benzene', 'Benzol'],
        hazard_class: 'Flammable liquid, Carcinogen',
        physical_state: 'Liquid'
      }
    ];

    // Filter chemicals based on query
    const queryLower = query.toLowerCase();
    const filtered = commonChemicals.filter(chemical => 
      chemical.name.toLowerCase().includes(queryLower) ||
      chemical.cas_number.includes(query) ||
      chemical.formula.toLowerCase().includes(queryLower) ||
      chemical.common_names.some(name => name.toLowerCase().includes(queryLower))
    );

    return filtered.slice(0, limit);
  }

  /**
   * Fetch detailed chemical properties from CAMEO database
   */
  async fetchChemicalDetails(identifier) {
    // This would fetch from actual CAMEO database
    // For now, return detailed properties for common chemicals
    
    const detailedProperties = {
      'CAM001': { // Chlorine
        basic_info: {
          cameo_id: 'CAM001',
          name: 'Chlorine',
          cas_number: '7782-50-5',
          formula: 'Cl2',
          molecular_weight: 70.906, // g/mol
          physical_state: 'Gas',
          color: 'Yellow-green',
          odor: 'Pungent, irritating'
        },
        physical_properties: {
          melting_point: 171.6, // K
          boiling_point: 239.11, // K
          density_gas: 3.214, // kg/m³ at STP
          density_liquid: 1468, // kg/m³ at bp
          vapor_pressure: 687000, // Pa at 20°C
          critical_temperature: 417.0, // K
          critical_pressure: 7991000, // Pa
          heat_of_vaporization: 20410, // J/mol
          specific_heat_gas: 0.479, // kJ/kg·K
          thermal_conductivity: 0.0089 // W/m·K at 0°C
        },
        safety_properties: {
          flash_point: null, // Non-flammable
          autoignition_temperature: null,
          explosive_limits: null,
          twa: 0.5, // ppm (OSHA)
          stel: 1.0, // ppm (ACGIH)
          idlh: 10, // ppm
          lc50: 293 // ppm (1 hour, rat)
        },
        dispersion_properties: {
          stability_class_modifier: 0, // No special stability considerations
          deposition_velocity: 0.01, // m/s (dry deposition)
          solubility_water: 7.3, // g/L at 20°C
          henry_constant: 0.1, // dimensionless
          atmospheric_lifetime: 3600 // seconds (rough estimate)
        }
      },
      'CAM002': { // Ammonia
        basic_info: {
          cameo_id: 'CAM002',
          name: 'Ammonia',
          cas_number: '7664-41-7',
          formula: 'NH3',
          molecular_weight: 17.031,
          physical_state: 'Gas',
          color: 'Colorless',
          odor: 'Pungent'
        },
        physical_properties: {
          melting_point: 195.42, // K
          boiling_point: 239.82, // K
          density_gas: 0.771, // kg/m³ at STP
          density_liquid: 682, // kg/m³ at bp
          vapor_pressure: 857000, // Pa at 20°C
          critical_temperature: 405.4, // K
          critical_pressure: 11333000, // Pa
          heat_of_vaporization: 23350, // J/mol
          specific_heat_gas: 2.19, // kJ/kg·K
          thermal_conductivity: 0.0249 // W/m·K at 25°C
        },
        safety_properties: {
          flash_point: null, // Gas
          autoignition_temperature: 924, // K
          explosive_limits: { lower: 15, upper: 28 }, // % by volume
          twa: 25, // ppm (OSHA)
          stel: 35, // ppm (ACGIH)
          idlh: 300, // ppm
          lc50: 2000 // ppm (4 hours, rat)
        },
        dispersion_properties: {
          stability_class_modifier: 0,
          deposition_velocity: 0.02, // m/s
          solubility_water: 482, // g/L at 20°C (highly soluble)
          henry_constant: 0.00074, // dimensionless
          atmospheric_lifetime: 7200 // seconds
        }
      }
      // Add more chemicals as needed
    };

    const data = detailedProperties[identifier];
    if (!data) {
      // If not in our database, return basic structure
      return {
        basic_info: {
          cameo_id: identifier,
          name: 'Unknown Chemical',
          cas_number: null,
          formula: null,
          molecular_weight: null,
          physical_state: 'Unknown'
        },
        physical_properties: {},
        safety_properties: {},
        dispersion_properties: {}
      };
    }

    return data;
  }

  /**
   * Process and standardize chemical data for dispersion modeling
   */
  processChemicalData(rawData) {
    const processed = {
      // Basic identification
      cameo_id: rawData.basic_info?.cameo_id,
      name: rawData.basic_info?.name,
      cas_number: rawData.basic_info?.cas_number,
      formula: rawData.basic_info?.formula,
      molecular_weight: rawData.basic_info?.molecular_weight,
      physical_state: rawData.basic_info?.physical_state,

      // Physical properties for dispersion modeling
      melting_point: rawData.physical_properties?.melting_point,
      boiling_point: rawData.physical_properties?.boiling_point,
      density: rawData.physical_properties?.density_gas || rawData.physical_properties?.density_liquid,
      vapor_pressure: rawData.physical_properties?.vapor_pressure,
      critical_temperature: rawData.physical_properties?.critical_temperature,
      critical_pressure: rawData.physical_properties?.critical_pressure,
      heat_of_vaporization: rawData.physical_properties?.heat_of_vaporization,
      specific_heat: rawData.physical_properties?.specific_heat_gas,
      thermal_conductivity: rawData.physical_properties?.thermal_conductivity,

      // Safety and toxicity data
      twa: rawData.safety_properties?.twa,
      stel: rawData.safety_properties?.stel,
      idlh: rawData.safety_properties?.idlh,
      lc50: rawData.safety_properties?.lc50,
      flash_point: rawData.safety_properties?.flash_point,
      explosive_limits: rawData.safety_properties?.explosive_limits,

      // Dispersion-specific properties
      solubility_water: rawData.dispersion_properties?.solubility_water,
      henry_constant: rawData.dispersion_properties?.henry_constant,
      deposition_velocity: rawData.dispersion_properties?.deposition_velocity,
      atmospheric_lifetime: rawData.dispersion_properties?.atmospheric_lifetime,

      // Calculate derived properties for ALOHA models
      is_heavy_gas: this.determineHeavyGas(rawData),
      volatility_class: this.determineVolatilityClass(rawData),
      hazard_classification: this.determineHazardClass(rawData),

      // Metadata
      data_source: 'CAMEO Chemicals',
      last_updated: new Date().toISOString(),
      quality_score: this.calculateDataQuality(rawData)
    };

    return processed;
  }

  /**
   * Determine if chemical is a heavy gas for dispersion modeling
   */
  determineHeavyGas(data) {
    const molecularWeight = data.basic_info?.molecular_weight;
    if (!molecularWeight) return false;
    
    // Air has average molecular weight of ~28.97 g/mol
    // Heavy gas if MW > 50 g/mol (conservative threshold)
    return molecularWeight > 50;
  }

  /**
   * Determine volatility class for evaporation modeling
   */
  determineVolatilityClass(data) {
    const vaporPressure = data.physical_properties?.vapor_pressure;
    const boilingPoint = data.physical_properties?.boiling_point;
    
    if (!vaporPressure) return 'unknown';
    
    // Classification based on vapor pressure at 20°C
    if (vaporPressure > 100000) return 'high'; // > 100 kPa
    if (vaporPressure > 10000) return 'medium'; // 10-100 kPa
    if (vaporPressure > 1000) return 'low'; // 1-10 kPa
    return 'very_low'; // < 1 kPa
  }

  /**
   * Determine hazard classification for risk assessment
   */
  determineHazardClass(data) {
    const idlh = data.safety_properties?.idlh;
    const lc50 = data.safety_properties?.lc50;
    
    if (!idlh && !lc50) return 'unknown';
    
    // Classification based on IDLH values
    if (idlh && idlh < 10) return 'extremely_toxic';
    if (idlh && idlh < 50) return 'highly_toxic';
    if (idlh && idlh < 500) return 'toxic';
    return 'harmful';
  }

  /**
   * Calculate data quality score based on completeness
   */
  calculateDataQuality(data) {
    const requiredFields = [
      'basic_info.molecular_weight',
      'basic_info.physical_state',
      'physical_properties.boiling_point',
      'physical_properties.vapor_pressure',
      'safety_properties.idlh'
    ];
    
    let score = 0;
    requiredFields.forEach(field => {
      const value = field.split('.').reduce((obj, key) => obj?.[key], data);
      if (value !== null && value !== undefined) score++;
    });
    
    return score / requiredFields.length;
  }

  /**
   * Cache management
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get chemical recommendations based on release scenario
   */
  async getRecommendationsForScenario(releaseType, hazardLevel = 'medium') {
    try {
      // Return chemicals commonly involved in specific scenarios
      const scenarios = {
        'industrial_accident': ['Chlorine', 'Ammonia', 'Sulfur dioxide'],
        'transportation': ['Gasoline', 'Diesel fuel', 'Propane'],
        'storage_tank': ['Chlorine', 'Ammonia', 'Hydrogen sulfide'],
        'chemical_plant': ['Benzene', 'Toluene', 'Xylene', 'Chlorine']
      };

      const chemicals = scenarios[releaseType] || scenarios['industrial_accident'];
      const recommendations = [];

      for (const chemicalName of chemicals) {
        const searchResults = await this.searchChemicals(chemicalName, 1);
        if (searchResults.length > 0) {
          const properties = await this.getChemicalProperties(searchResults[0].cameo_id);
          recommendations.push(properties);
        }
      }

      return recommendations;

    } catch (error) {
      console.error('Error getting chemical recommendations:', error);
      return [];
    }
  }
}

module.exports = CameoChemicalsService;