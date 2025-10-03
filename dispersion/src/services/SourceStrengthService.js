/**
 * Source Strength Models Service
 * Implementation following ALOHA 5.4.4 Technical Documentation Chapter 3
 * Based on NOAA Technical Memorandum NOS OR&R 43
 */

class SourceStrengthService {
  constructor() {
    this.g = 9.8; // acceleration of gravity (m/s²)
    this.R = 8.314; // gas constant (J/mol·K)
    this.stefanBoltzmann = 5.67e-8; // Stefan-Boltzmann constant (W/m²·K⁴)
    this.vonKarman = 0.4; // Von Karman constant
  }

  /**
   * Direct Source - user specified release rate
   * ALOHA Section 3.2
   */
  calculateDirectSource(releaseData) {
    const {
      release_rate, // kg/s
      total_mass,   // kg
      duration,     // seconds
      release_type  // 'instantaneous' or 'continuous'
    } = releaseData;

    if (release_type === 'instantaneous') {
      return {
        source_type: 'direct_instantaneous',
        emission_rate: total_mass || 1.0, // kg
        duration: 60, // ALOHA minimum duration (1 minute)
        time_varying: false
      };
    } else {
      const effectiveRate = release_rate || (total_mass / (duration || 3600));
      return {
        source_type: 'direct_continuous',
        emission_rate: effectiveRate, // kg/s
        duration: duration || 3600,
        time_varying: false
      };
    }
  }

  /**
   * Puddle evaporation model following ALOHA Section 3.3
   * Uses Brighton's formulation for non-boiling puddles
   */
  async calculatePuddleEvaporation(puddleData, weatherData, chemical) {
    const {
      area,           // m²
      initial_temperature, // K
      substrate_type, // 'water', 'concrete', 'soil'
      substrate_temperature // K
    } = puddleData;

    const {
      wind_speed,     // m/s
      air_temperature, // K
      relative_humidity, // %
      solar_radiation,   // W/m²
      cloudiness        // 0-10
    } = weatherData;

    // Determine if puddle is boiling
    const ambientBoilingPoint = this.calculateBoilingPoint(chemical, 101325); // Pa
    const puddleTemperature = initial_temperature || air_temperature;
    
    if (puddleTemperature >= ambientBoilingPoint) {
      return this.calculateBoilingPuddleEvaporation(puddleData, weatherData, chemical);
    } else {
      return this.calculateNonBoilingPuddleEvaporation(puddleData, weatherData, chemical);
    }
  }

  /**
   * Non-boiling puddle evaporation using Brighton's model (ALOHA Section 3.3.1)
   */
  calculateNonBoilingPuddleEvaporation(puddleData, weatherData, chemical) {
    const { area } = puddleData;
    const { wind_speed, air_temperature } = weatherData;
    
    // Calculate friction velocity using Deacon's formulation
    const n = this.getPowerLawExponent(weatherData.atmospheric_stability || 'D');
    const frictionVelocity = 0.03 * Math.pow(wind_speed, n);
    
    // Calculate vapor pressure and saturation concentration
    const vaporPressure = this.calculateVaporPressure(chemical, air_temperature);
    const saturationConcentration = this.calculateSaturationConcentration(chemical, vaporPressure, air_temperature);
    
    // Calculate mass transfer coefficient using Brighton's method
    const schmidtNumber = this.calculateSchmidtNumber(chemical, air_temperature);
    const massTransferCoeff = this.calculateMassTransferCoefficient(
      area, frictionVelocity, schmidtNumber, n
    );
    
    // Apply correction for highly volatile liquids
    const ambientPressure = 101325; // Pa
    const volatilityCorrection = this.calculateVolatilityCorrection(vaporPressure, ambientPressure);
    const correctedMassTransferCoeff = massTransferCoeff * volatilityCorrection;
    
    // Calculate evaporation rate
    const evaporationRate = saturationConcentration * frictionVelocity * correctedMassTransferCoeff * area;
    
    return {
      source_type: 'puddle_non_boiling',
      emission_rate: evaporationRate, // kg/s
      evaporation_method: 'brighton',
      mass_transfer_coefficient: correctedMassTransferCoeff,
      volatility_correction: volatilityCorrection,
      time_varying: true
    };
  }

  /**
   * Boiling puddle evaporation using energy balance (ALOHA Section 3.3.2)
   */
  calculateBoilingPuddleEvaporation(puddleData, weatherData, chemical) {
    const { area, substrate_type, substrate_temperature } = puddleData;
    const { wind_speed, air_temperature, solar_radiation, cloudiness } = weatherData;
    
    // Energy balance components (ALOHA Section 3.3.3)
    const solarFlux = this.calculateSolarRadiation(solar_radiation, cloudiness);
    const longwaveDown = this.calculateLongwaveRadiationDown(air_temperature, cloudiness, weatherData.relative_humidity);
    const longwaveUp = this.calculateLongwaveRadiationUp(air_temperature); // Assuming puddle at boiling point
    const groundHeatFlux = this.calculateGroundHeatFlux(substrate_type, substrate_temperature, air_temperature);
    const sensibleHeatFlux = this.calculateSensibleHeatFlux(wind_speed, air_temperature, air_temperature);
    
    // Net energy available for evaporation
    const netEnergyFlux = solarFlux + longwaveDown - longwaveUp + groundHeatFlux + sensibleHeatFlux;
    
    // Heat of vaporization
    const heatOfVaporization = chemical.heat_of_vaporization || 2260000; // J/kg (default to water)
    
    // Evaporation rate limited by energy balance
    const evaporationRate = Math.max(0, (netEnergyFlux * area) / heatOfVaporization);
    
    return {
      source_type: 'puddle_boiling',
      emission_rate: evaporationRate, // kg/s
      energy_balance: {
        solar_flux: solarFlux,
        longwave_down: longwaveDown,
        longwave_up: longwaveUp,
        ground_heat_flux: groundHeatFlux,
        sensible_heat_flux: sensibleHeatFlux,
        net_energy: netEnergyFlux
      },
      time_varying: true
    };
  }

  /**
   * Calculate power law exponent for wind profile
   */
  getPowerLawExponent(stabilityClass) {
    const exponents = {
      'A': 0.108, 'B': 0.112, 'C': 0.120, 'D': 0.142,
      'E': 0.203, 'F': 0.253, 'G': 0.253
    };
    return exponents[stabilityClass] || 0.142;
  }

  /**
   * Calculate vapor pressure using Antoine equation or Clausius-Clapeyron
   */
  calculateVaporPressure(chemical, temperature) {
    // Simplified vapor pressure calculation
    // In practice, would use chemical-specific Antoine constants
    const vapPress = chemical.vapor_pressure || 1000; // Pa at standard conditions
    const refTemp = 298.15; // K
    
    // Clausius-Clapeyron approximation
    const heatOfVap = chemical.heat_of_vaporization || 40000; // J/mol
    const exponent = (heatOfVap / this.R) * (1/refTemp - 1/temperature);
    
    return vapPress * Math.exp(exponent);
  }

  /**
   * Calculate saturation concentration in air
   */
  calculateSaturationConcentration(chemical, vaporPressure, temperature) {
    // Using ideal gas law: C = (P * M) / (R * T)
    const molecularWeight = (chemical.molecular_weight || 29.0) / 1000; // kg/mol
    return (vaporPressure * molecularWeight) / (this.R * temperature);
  }

  /**
   * Calculate Schmidt number
   */
  calculateSchmidtNumber(chemical, temperature) {
    // Molecular kinematic viscosity of air
    const airViscosity = 1.5e-5; // m²/s at standard conditions
    
    // Molecular diffusivity using Graham's Law
    const waterDiffusivity = 2.39e-5; // m²/s
    const molecularWeight = chemical.molecular_weight || 29.0;
    const waterMolecularWeight = 18.0;
    
    const diffusivity = waterDiffusivity * Math.sqrt(waterMolecularWeight / molecularWeight);
    
    return airViscosity / diffusivity;
  }

  /**
   * Calculate mass transfer coefficient using Brighton's formulation
   */
  calculateMassTransferCoefficient(area, frictionVelocity, schmidtNumber, powerLawExponent) {
    // Simplified implementation of Brighton's complex formulation
    // Full implementation would require the complete dimensionless analysis
    const diameter = Math.sqrt(4 * area / Math.PI);
    const roughnessLength = 0.0001; // m, typical for smooth surfaces
    
    // Dimensionless parameters
    const X = Math.pow(diameter / roughnessLength, powerLawExponent);
    const turbulentSchmidt = 0.85;
    
    // Simplified mass transfer coefficient
    return 0.1 * Math.pow(schmidtNumber, -0.67) * Math.pow(X, -0.2);
  }

  /**
   * Calculate volatility correction for highly volatile liquids
   */
  calculateVolatilityCorrection(vaporPressure, ambientPressure) {
    const ratio = vaporPressure / ambientPressure;
    if (ratio < 0.1) return 1.0; // No correction needed
    
    // ALOHA correction formula
    return Math.log(1 + ratio) / ratio;
  }

  /**
   * Calculate boiling point at given pressure
   */
  calculateBoilingPoint(chemical, pressure) {
    // Simplified calculation - would use chemical-specific constants in practice
    const normalBoilingPoint = chemical.boiling_point || 373.15; // K
    const normalPressure = 101325; // Pa
    
    // Simplified Clausius-Clapeyron for boiling point
    const heatOfVap = chemical.heat_of_vaporization || 40000; // J/mol
    const deltaT = (this.R * normalBoilingPoint * normalBoilingPoint / heatOfVap) * 
                   Math.log(pressure / normalPressure);
    
    return normalBoilingPoint + deltaT;
  }

  /**
   * Solar radiation calculation (ALOHA Section 3.3.3.1)
   */
  calculateSolarRadiation(solarIrradiance, cloudiness) {
    const maxSolarFlux = 1111; // W/m² (ALOHA value)
    const cloudinessFactor = 1 - 0.071 * cloudiness;
    return solarIrradiance || (maxSolarFlux * cloudinessFactor);
  }

  /**
   * Longwave radiation calculations (ALOHA Section 3.3.3.2)
   */
  calculateLongwaveRadiationDown(airTemperature, cloudiness, relativeHumidity) {
    const emissivity = 0.97; // Water emissivity
    const radiationFactors = [
      { a: 0.740, b: 44.3e-6 }, { a: 0.750, b: 44.3e-6 }, { a: 0.760, b: 44.3e-6 },
      { a: 0.770, b: 44.2e-6 }, { a: 0.783, b: 40.7e-6 }, { a: 0.793, b: 40.5e-6 },
      { a: 0.800, b: 39.9e-6 }, { a: 0.810, b: 38.4e-6 }, { a: 0.820, b: 35.4e-6 },
      { a: 0.840, b: 31.0e-6 }, { a: 0.870, b: 26.6e-6 }
    ];
    
    const cloudIndex = Math.min(Math.floor(cloudiness), 10);
    const { a, b } = radiationFactors[cloudIndex];
    
    // Water vapor partial pressure
    const waterVaporPressure = (relativeHumidity / 100) * 
      99.89 * Math.exp(21.66 - 5431.3 / airTemperature);
    
    const B = a + b * waterVaporPressure;
    const reflectivity = 0.03; // Water reflectivity
    
    return (1 - reflectivity) * B * this.stefanBoltzmann * Math.pow(airTemperature, 4);
  }

  calculateLongwaveRadiationUp(surfaceTemperature) {
    const emissivity = 0.97; // Water emissivity
    return emissivity * this.stefanBoltzmann * Math.pow(surfaceTemperature, 4);
  }

  /**
   * Ground heat flux calculations (ALOHA Section 3.3.3.3)
   */
  calculateGroundHeatFlux(substrateType, substrateTemp, puddleTemp) {
    const thermalProperties = {
      'water': { conductivity: 0.6, diffusivity: 1.4e-7 },
      'concrete': { conductivity: 8.28, diffusivity: 3.74e-6 },
      'soil': { conductivity: 8.64, diffusivity: 4.13e-6 },
      'sand_dry': { conductivity: 2.34, diffusivity: 1.74e-6 },
      'sand_moist': { conductivity: 5.31, diffusivity: 3.02e-6 }
    };
    
    const props = thermalProperties[substrateType] || thermalProperties['soil'];
    const temperatureDiff = substrateTemp - puddleTemp;
    
    if (substrateType === 'water') {
      // Webber's model for spills on water
      return 500 * temperatureDiff * temperatureDiff; // W/m²
    } else {
      // Conductive heat transfer for solid substrates
      // Simplified - full implementation would solve heat equation numerically
      const thermalBoundaryLayer = 0.1; // m, typical thickness
      return props.conductivity * temperatureDiff / thermalBoundaryLayer;
    }
  }

  /**
   * Sensible heat flux calculation
   */
  calculateSensibleHeatFlux(windSpeed, airTemp, surfaceTemp) {
    const airDensity = 1.225; // kg/m³
    const airHeatCapacity = 1004; // J/kg·K
    const heatTransferCoeff = 0.004; // Typical value
    
    const frictionVelocity = 0.03 * Math.pow(windSpeed, 0.142);
    return airDensity * airHeatCapacity * frictionVelocity * heatTransferCoeff * (airTemp - surfaceTemp);
  }

  /**
   * Tank release models (ALOHA Section 3.4)
   * Simplified implementation - full version would handle multiple phases
   */
  calculateTankRelease(tankData, chemical) {
    const {
      tank_volume,      // m³
      liquid_level,     // fraction (0-1)
      hole_diameter,    // m
      hole_height,      // m above bottom
      tank_pressure,    // Pa (gauge)
      tank_temperature  // K
    } = tankData;

    const liquidVolume = tank_volume * liquid_level;
    const liquidHeight = liquidVolume / (Math.PI * Math.pow(tank_volume / (4/3 * Math.PI), 2/3));
    
    // Determine release type
    const isLiquidRelease = hole_height < liquidHeight;
    const ambientPressure = 101325; // Pa
    const totalPressure = ambientPressure + (tank_pressure || 0);
    
    if (isLiquidRelease) {
      return this.calculateLiquidReleaseFromTank(tankData, chemical, totalPressure);
    } else {
      return this.calculateGasReleaseFromTank(tankData, chemical, totalPressure);
    }
  }

  /**
   * Liquid release through hole (simplified Torricelli's law with discharge coefficient)
   */
  calculateLiquidReleaseFromTank(tankData, chemical, pressure) {
    const { hole_diameter, hole_height, liquid_level, tank_volume } = tankData;
    
    const holeArea = Math.PI * Math.pow(hole_diameter / 2, 2);
    const liquidDensity = chemical.density || 1000; // kg/m³
    const dischargeCoeff = 0.6; // Typical value for sharp-edged orifice
    
    // Hydraulic head
    const liquidHeight = tank_volume * liquid_level / (Math.PI * Math.pow(tank_volume / (4/3 * Math.PI), 2/3));
    const hydraulicHead = liquidHeight - hole_height;
    
    // Release rate using modified Torricelli's equation
    const velocity = dischargeCoeff * Math.sqrt(2 * this.g * hydraulicHead + 2 * pressure / liquidDensity);
    const massFlowRate = liquidDensity * holeArea * velocity;
    
    return {
      source_type: 'tank_liquid',
      emission_rate: massFlowRate, // kg/s
      discharge_coefficient: dischargeCoeff,
      hydraulic_head: hydraulicHead,
      time_varying: true
    };
  }

  /**
   * Gas release through hole
   */
  calculateGasReleaseFromTank(tankData, chemical, pressure) {
    const { hole_diameter, tank_temperature } = tankData;
    
    const holeArea = Math.PI * Math.pow(hole_diameter / 2, 2);
    const temperature = tank_temperature || 293.15; // K
    const gasDensity = this.calculateGasDensity(chemical, temperature, pressure);
    
    // Choked flow calculation (simplified)
    const gamma = 1.4; // Heat capacity ratio (assumed)
    const gasConstant = this.R / (chemical.molecular_weight / 1000 || 0.029); // J/kg·K
    
    const chokedVelocity = Math.sqrt(gamma * gasConstant * temperature);
    const massFlowRate = gasDensity * holeArea * chokedVelocity * 0.6; // With discharge coefficient
    
    return {
      source_type: 'tank_gas',
      emission_rate: massFlowRate, // kg/s
      choked_flow: true,
      time_varying: true
    };
  }

  /**
   * Calculate gas density
   */
  calculateGasDensity(chemical, temperature, pressure) {
    const molecularWeight = (chemical.molecular_weight || 29.0) / 1000; // kg/mol
    return (pressure * molecularWeight) / (this.R * temperature);
  }
}

module.exports = SourceStrengthService;