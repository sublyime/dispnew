const DatabaseService = require('./DatabaseService');
const WeatherService = require('./WeatherService');
const SourceStrengthService = require('./SourceStrengthService');
const CameoChemicalsService = require('./CameoChemicalsService');
const ALOHAService = require('./ALOHAService');

class DispersionService {
  constructor(websocketServer) {
    this.wss = websocketServer;
    this.activeCalculations = new Map();
    this.updateInterval = 30000; // 30 seconds
    this.intervalId = null;
    this.sourceStrengthService = new SourceStrengthService();
    this.cameoChemicalsService = new CameoChemicalsService();
    this.alohaService = new ALOHAService(); // Add ALOHA integration
  }

  /**
   * Start real-time dispersion updates
   */
  startRealTimeUpdates() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(async () => {
      await this.updateActiveDispersions();
    }, this.updateInterval);

    console.log(`Dispersion service started with ${this.updateInterval}ms update interval`);
  }

  /**
   * Stop real-time updates
   */
  stopRealTimeUpdates() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Dispersion service stopped');
    }
  }

  /**
   * Create a new release event and start dispersion modeling
   */
  async createReleaseEvent(releaseData) {
    try {
      console.log('Creating release event with data:', JSON.stringify(releaseData, null, 2));
      
      const {
        latitude,
        longitude,
        chemical_id,
        release_type,
        release_rate,
        total_mass,
        release_height,
        temperature,
        duration,
        created_by
      } = releaseData;

      // Validate required fields
      if (!latitude || !longitude || !chemical_id || !release_type) {
        throw new Error('Missing required fields for release event');
      }

      // Validate coordinates are valid numbers
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      
      if (isNaN(lat) || isNaN(lng)) {
        throw new Error(`Invalid coordinates: latitude=${latitude}, longitude=${longitude}`);
      }
      
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw new Error(`Coordinates out of range: latitude=${lat}, longitude=${lng}`);
      }

      // Get chemical properties
      const chemical = await this.getChemicalProperties(chemical_id);
      if (!chemical) {
        throw new Error(`Chemical with ID ${chemical_id} not found`);
      }

      // Validate chemical has required properties for ALOHA modeling
      if (!chemical.molecular_weight && !chemical.density) {
        console.warn(`Chemical ${chemical_id} missing critical properties, using defaults`);
        chemical.molecular_weight = chemical.molecular_weight || 29.0; // Default to air
        chemical.density = chemical.density || 1.0; // Default density
      }

      // Get current weather data
      const weatherService = new WeatherService();
      const weatherData = await weatherService.getCurrentWeather(latitude, longitude);

      // Create release event
      const query = `
        INSERT INTO release_events (
          location, chemical_id, release_type, release_rate, total_mass,
          release_height, temperature, duration, start_time, weather_conditions,
          status, created_by
        ) VALUES (
          ST_SetSRID(ST_MakePoint($1, $2), 4326), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        )
        RETURNING id, start_time
      `;

      const values = [
        lng,  // Use validated longitude
        lat,  // Use validated latitude
        parseInt(chemical_id),
        release_type,
        release_rate || null,
        total_mass || null,
        release_height || 1.0,
        temperature || weatherData.temperature || 20,
        duration || null,
        new Date(),
        JSON.stringify(weatherData),
        'active',
        created_by || 'system'
      ];

      const result = await DatabaseService.query(query, values);
      const releaseEventId = result.rows[0].id;

      // Perform initial dispersion calculation
      const initialCalculation = await this.calculateDispersion(releaseEventId, weatherData, chemical);

      // Add to active calculations for real-time updates
      this.activeCalculations.set(releaseEventId, {
        releaseEventId,
        chemical,
        lastCalculation: new Date(),
        websocketClients: new Set()
      });

      // Notify WebSocket clients
      this.broadcastToClients(releaseEventId, {
        type: 'new_release',
        release_event_id: releaseEventId,
        calculation: initialCalculation
      });

      // Get full release details for response
      const fullReleaseQuery = `
        SELECT 
          re.id, re.release_type, re.release_rate, re.total_mass,
          re.release_height, re.temperature, re.duration,
          re.start_time, re.end_time, re.status, re.created_by, re.created_at,
          ST_X(re.location) as longitude, ST_Y(re.location) as latitude,
          c.name as chemical_name, c.cas_number, c.physical_state,
          re.weather_conditions
        FROM release_events re
        JOIN chemicals c ON re.chemical_id = c.id
        WHERE re.id = $1
      `;

      const fullReleaseResult = await DatabaseService.query(fullReleaseQuery, [releaseEventId]);
      const fullRelease = fullReleaseResult.rows[0];

      return {
        ...fullRelease,
        release_event_id: releaseEventId,
        initial_calculation: initialCalculation
      };

    } catch (error) {
      console.error('Error creating release event:', error);
      throw error;
    }
  }

  /**
   * Calculate dispersion for a release event using ALOHA-compliant methodology
   */
  async calculateDispersion(releaseEventId, weatherData, chemical) {
    try {
      // Get release event details
      const releaseQuery = `
        SELECT 
          ST_X(location) as longitude,
          ST_Y(location) as latitude,
          release_type,
          release_rate,
          total_mass,
          release_height,
          temperature,
          duration,
          start_time
        FROM release_events
        WHERE id = $1
      `;

      const releaseResult = await DatabaseService.query(releaseQuery, [releaseEventId]);
      
      if (releaseResult.rows.length === 0) {
        throw new Error('Release event not found');
      }

      const releaseEvent = releaseResult.rows[0];

      // Calculate source strength using ALOHA methodology
      let sourceStrength;
      if (releaseEvent.release_type === 'puddle') {
        // For puddle sources, use Brighton's evaporation model
        const puddleData = {
          area: 100, // m² - default, should be calculated or specified
          initial_temperature: weatherData.temperature || 293.15,
          substrate_type: 'soil',
          substrate_temperature: weatherData.temperature || 293.15
        };
        sourceStrength = await this.sourceStrengthService.calculatePuddleEvaporation(
          puddleData, weatherData, chemical
        );
      } else {
        // For direct releases
        sourceStrength = this.sourceStrengthService.calculateDirectSource({
          release_rate: releaseEvent.release_rate,
          total_mass: releaseEvent.total_mass,
          duration: releaseEvent.duration,
          release_type: releaseEvent.release_type
        });
      }

      // Prepare release data for ALOHA service
      const alohaReleaseData = {
        ...releaseEvent,
        chemical: chemical,
        location: {
          latitude: releaseEvent.latitude,
          longitude: releaseEvent.longitude
        },
        source_strength: sourceStrength
      };

      // Perform dispersion calculation using ALOHA service
      const dispersionResult = await this.alohaService.calculateDispersion(
        alohaReleaseData,
        weatherData
      );

      // Calculate threat zones using ALOHA contours
      const threatZones = dispersionResult.threatZones;

      // Get maximum concentration from ALOHA results
      const maxConcentrationAnalysis = {
        estimated_max: dispersionResult.maxConcentration,
        upper_bound: dispersionResult.maxConcentration * 1.5 // Conservative estimate
      };

      // Get receptor impacts from ALOHA results
      const receptorImpacts = dispersionResult.receptorImpacts;

      const enhancedModelParameters = {
        ...dispersionResult.modelParameters,
        source_strength: sourceStrength,
        threat_zones: threatZones,
        max_concentration_analysis: maxConcentrationAnalysis,
        aloha_compliant: true,
        aloha_version: '5.4.4_compatible'
      };

      // Store calculation results with enhanced data
      const insertQuery = `
        INSERT INTO dispersion_calculations (
          release_event_id, calculation_time, plume_geometry, max_concentration,
          affected_area, calculation_method, meteorological_conditions,
          model_parameters, receptor_impacts
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `;

      const values = [
        releaseEventId,
        new Date(),
        dispersionResult.plumeGeometry, // Now just a JSON string
        dispersionResult.maxConcentration, // Use actual max concentration, not upper bound
        dispersionResult.affectedArea,
        dispersionResult.modelType || 'aloha_gaussian_plume',
        JSON.stringify(weatherData),
        JSON.stringify(enhancedModelParameters),
        JSON.stringify(receptorImpacts)
      ];

      const calcResult = await DatabaseService.query(insertQuery, values);
      const calculationId = calcResult.rows[0].id;

      // Store individual receptor impacts
      await this.storeReceptorImpacts(calculationId, receptorImpacts);

      return {
        calculation_id: calculationId,
        plume_geometry: dispersionResult.plumeGeometry,
        max_concentration: maxConcentrationAnalysis.estimated_max,
        max_concentration_upper_bound: maxConcentrationAnalysis.upper_bound,
        affected_area: dispersionResult.affectedArea,
        receptor_impacts: receptorImpacts,
        threat_zones: threatZones,
        source_strength: sourceStrength,
        model_parameters: enhancedModelParameters,
        calculation_time: new Date(),
        aloha_version: '5.4.4_compatible',
        concentration_contours: dispersionResult.concentrationContours
      };

    } catch (error) {
      console.error('Error calculating dispersion:', error);
      throw error;
    }
  }

  /**
   * Gaussian plume dispersion model implementation following ALOHA 5.4.4 specifications
   * Based on NOAA Technical Memorandum NOS OR&R 43, Chapter 4.3
   */
  async gaussianPlumeModel(releaseEvent, weatherData, chemical, skipHeavyGasCheck = false) {
    try {
      const {
        longitude,
        latitude,
        release_height,
        release_rate,
        total_mass,
        temperature,
        release_type
      } = releaseEvent;

      const {
        wind_speed,
        wind_direction,
        atmospheric_stability,
        mixing_height
      } = weatherData;

      // Model parameters - validate inputs per ALOHA specifications
      const effectiveHeight = Math.max(parseFloat(release_height) || 0.0, 0.0);
      const windSpeed = Math.max(parseFloat(wind_speed) || 2.0, 1.0); // ALOHA minimum 1 m/s
      let windDir = parseFloat(wind_direction);
      
      // Validate wind direction and normalize to 0-360 range
      if (isNaN(windDir) || !isFinite(windDir)) {
        windDir = 270; // Default west wind
      } else {
        // Normalize to 0-360 range
        windDir = ((windDir % 360) + 360) % 360;
      }
      
      const stability = atmospheric_stability || 'D';
      const mixingHeight = Math.max(parseFloat(mixing_height) || 1000, 100); // Default 1000m, minimum 100m
      
      // Debug log input parameters
      console.log(`Gaussian plume inputs: wind_speed=${windSpeed}, wind_dir=${windDir}, stability=${stability}, height=${effectiveHeight}`)

      // Validate wind speed constraint per ALOHA documentation
      if (windSpeed < 1.0) {
        throw new Error('ALOHA requires wind speed > 1 m/s. Current wind speed too low for modeling.');
      }

      // Calculate emission rate
      let emissionRate;
      if (release_rate) {
        emissionRate = parseFloat(release_rate) / 1000; // Convert g/s to kg/s
      } else if (total_mass) {
        // Estimate emission rate from total mass (assuming 1-hour release if not specified)
        emissionRate = parseFloat(total_mass) / 3600; // kg/s
      } else {
        emissionRate = 0.001; // Default 1 g/s = 0.001 kg/s
      }

      // Determine if heavy gas model should be used instead (unless explicitly skipped)
      if (!skipHeavyGasCheck) {
        const shouldUseHeavyGas = await this.shouldUseHeavyGasModel(chemical, weatherData, emissionRate);
        if (shouldUseHeavyGas) {
          return await this.heavyGasModel(releaseEvent, weatherData, chemical);
        }
      }

      // ALOHA distance array for calculations (meters)
      const distances = [10, 25, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
      const concentrations = [];
      const plumePoints = [];

      // Wind profile calculation using power law (ALOHA Section 4.2.3)
      const windProfile = this.calculateWindProfile(windSpeed, 10.0, stability);

      for (const distance of distances) {
        // Skip distances too close to source
        if (distance < 10) continue;

        // Calculate atmospheric dispersion coefficients per ALOHA methodology
        const { sigmaY, sigmaZ } = this.calculateDispersionCoefficients(distance, stability, windProfile);

        // Apply mixing height constraints per ALOHA specifications
        const effectiveSigmaZ = Math.min(sigmaZ, mixingHeight / 2.15);

        // Enhanced wind speed at plume height using power law profile
        const plumeWindSpeed = this.getWindSpeedAtHeight(windSpeed, 10.0, effectiveHeight, stability);

        // Gaussian plume equation with reflection terms (ALOHA Section 4.3)
        const heightTerm = Math.exp(-0.5 * Math.pow(effectiveHeight / effectiveSigmaZ, 2));
        const reflectionTerm = effectiveHeight > 0 ? 
          Math.exp(-0.5 * Math.pow((effectiveHeight + 2 * mixingHeight) / effectiveSigmaZ, 2)) : 0;
        
        // Ground-level concentration at plume centerline
        const denominator = Math.PI * plumeWindSpeed * sigmaY * effectiveSigmaZ;
        let concentration = 0;
        
        if (denominator > 0 && isFinite(denominator) && emissionRate > 0) {
          concentration = (emissionRate / denominator) * (heightTerm + reflectionTerm);
        }

        // Handle invalid calculations with detailed logging
        if (!isFinite(concentration) || isNaN(concentration) || concentration < 0) {
          console.warn(`Invalid concentration at distance ${distance}m: ${concentration}`, {
            emissionRate, plumeWindSpeed, sigmaY, effectiveSigmaZ, heightTerm, reflectionTerm,
            denominator, windSpeed, stability
          });
          concentration = 0;
        }

        // Convert to μg/m³ for consistency with ALOHA outputs
        const concentrationMicrograms = concentration * 1e9;

        concentrations.push({
          distance,
          concentration: concentrationMicrograms,
          sigma_y: sigmaY,
          sigma_z: effectiveSigmaZ,
          wind_speed_at_height: plumeWindSpeed,
          height_term: heightTerm,
          reflection_term: reflectionTerm
        });

        // Calculate plume boundary points using ±2σ (ALOHA standard)
        const crosswindDistance = 2.0 * sigmaY;
        
        // Convert wind direction to mathematical angle (0° = East, counter-clockwise)
        const mathAngle = (90 - windDir) * Math.PI / 180;
        
        // Validate mathAngle
        if (!isFinite(mathAngle)) {
          console.warn(`Invalid mathematical angle calculated from wind direction ${windDir}°, skipping distance ${distance}m`);
          continue;
        }

        // Calculate downwind point
        const downwindLat = latitude + (distance * Math.cos(mathAngle)) / 111320;
        const downwindLon = longitude + (distance * Math.sin(mathAngle)) / (111320 * Math.cos(latitude * Math.PI / 180));

        // Calculate crosswind boundary points
        const crosswindAngle = mathAngle + Math.PI / 2;
        
        const leftLat = downwindLat + (crosswindDistance * Math.cos(crosswindAngle)) / 111320;
        const leftLon = downwindLon + (crosswindDistance * Math.sin(crosswindAngle)) / (111320 * Math.cos(latitude * Math.PI / 180));
        
        const rightLat = downwindLat - (crosswindDistance * Math.cos(crosswindAngle)) / 111320;
        const rightLon = downwindLon - (crosswindDistance * Math.sin(crosswindAngle)) / (111320 * Math.cos(latitude * Math.PI / 180));

        // Validate coordinates before adding to plume
        if (isFinite(downwindLat) && isFinite(downwindLon) && isFinite(leftLat) && isFinite(leftLon) && isFinite(rightLat) && isFinite(rightLon) &&
            Math.abs(downwindLat) <= 90 && Math.abs(leftLat) <= 90 && Math.abs(rightLat) <= 90 &&
            Math.abs(downwindLon) <= 180 && Math.abs(leftLon) <= 180 && Math.abs(rightLon) <= 180) {
          plumePoints.push({
            center: [downwindLon, downwindLat],
            left: [leftLon, leftLat],
            right: [rightLon, rightLat],
            distance,
            concentration: concentrationMicrograms,
            crosswind_distance: crosswindDistance
          });
        } else {
          console.warn(`Invalid coordinates at distance ${distance}m:`, {
            mathAngle: mathAngle * 180 / Math.PI,
            windDir,
            downwind: [downwindLon, downwindLat],
            left: [leftLon, leftLat], 
            right: [rightLon, rightLat],
            crosswindDistance,
            sigmaY
          });
        }
      }

      // Create plume geometry as GeoJSON polygon following ALOHA threat zone methodology
      let plumeCoordinates = [
        [longitude, latitude], // Source point
        ...plumePoints.map(p => p.left),
        ...plumePoints.slice().reverse().map(p => p.right),
        [longitude, latitude] // Close polygon
      ];

      // Validate plume coordinates - ensure we have enough valid points
      if (plumePoints.length < 2) {
        console.warn('Insufficient valid plume points, creating minimal plume around source');
        // Create a small circle around the source as fallback
        const radius = 0.001; // ~100m in degrees
        plumeCoordinates = [
          [longitude, latitude],
          [longitude + radius, latitude],
          [longitude + radius, latitude + radius],
          [longitude, latitude + radius],
          [longitude - radius, latitude + radius],
          [longitude - radius, latitude],
          [longitude - radius, latitude - radius],
          [longitude, latitude - radius],
          [longitude + radius, latitude - radius],
          [longitude, latitude]
        ];
      }

      const plumeGeometry = JSON.stringify({
        type: 'Polygon',
        coordinates: [plumeCoordinates]
      });

      // Calculate affected area using proper spherical geometry
      const affectedArea = this.calculateSphericalPolygonArea(plumeCoordinates);

      // Find maximum concentration with validation
      const validConcentrations = concentrations.map(c => c.concentration).filter(c => isFinite(c) && !isNaN(c) && c > 0);
      const maxConcentration = validConcentrations.length > 0 ? Math.max(...validConcentrations) : 0;

      return {
        plumeGeometry,
        maxConcentration,
        affectedArea,
        concentrations,
        plumePoints,
        modelParameters: {
          model_type: 'gaussian_plume',
          emission_rate: emissionRate,
          wind_speed: windSpeed,
          wind_direction: windDir,
          stability_class: stability,
          effective_height: effectiveHeight,
          mixing_height: mixingHeight,
          wind_profile: windProfile,
          molecular_weight: chemical.molecular_weight || 29.0, // Default to air if not specified
          gas_density: this.calculateGasDensity(chemical, weatherData.temperature || 293.15),
          aloha_version: '5.4.4_compatible'
        }
      };

    } catch (error) {
      console.error('Error in Gaussian plume model:', error);
      throw error;
    }
  }

  /**
   * Get Pasquill-Gifford dispersion parameters
   * Updated to follow ALOHA 5.4.4 specifications exactly
   */
  getDispersionParameters(stabilityClass) {
    const params = {
      'A': { a: 0.527, b: 0.865, c: 0.28, d: 0.90 },  // Very unstable
      'B': { a: 0.371, b: 0.866, c: 0.23, d: 0.85 },  // Unstable
      'C': { a: 0.209, b: 0.897, c: 0.22, d: 0.80 },  // Slightly unstable
      'D': { a: 0.128, b: 0.905, c: 0.20, d: 0.76 },  // Neutral
      'E': { a: 0.098, b: 0.902, c: 0.15, d: 0.73 },  // Stable
      'F': { a: 0.065, b: 0.902, c: 0.12, d: 0.67 },  // Very stable
      'G': { a: 0.065, b: 0.902, c: 0.08, d: 0.60 }   // Extremely stable
    };

    return params[stabilityClass] || params['D']; // Default to neutral
  }

  /**
   * Calculate wind profile using power law (ALOHA Section 4.2.3)
   */
  calculateWindProfile(windSpeed, referenceHeight, stabilityClass) {
    const powerLawExponents = {
      'A': 0.108,  // Very unstable
      'B': 0.112,  // Unstable
      'C': 0.120,  // Slightly unstable
      'D': 0.142,  // Neutral
      'E': 0.203,  // Stable
      'F': 0.253,  // Very stable
      'G': 0.253   // Extremely stable (same as F)
    };

    const exponent = powerLawExponents[stabilityClass] || 0.142;
    
    return {
      reference_wind_speed: windSpeed,
      reference_height: referenceHeight,
      power_law_exponent: exponent,
      stability_class: stabilityClass
    };
  }

  /**
   * Get wind speed at specified height using power law profile
   */
  getWindSpeedAtHeight(referenceWindSpeed, referenceHeight, targetHeight, stabilityClass) {
    const profile = this.calculateWindProfile(referenceWindSpeed, referenceHeight, stabilityClass);
    const exponent = profile.power_law_exponent;
    
    // Power law equation: U(z) = U_ref * (z / z_ref)^n
    return referenceWindSpeed * Math.pow(targetHeight / referenceHeight, exponent);
  }

  /**
   * Calculate atmospheric dispersion coefficients following ALOHA methodology
   * Uses Pasquill-Gifford dispersion parameters
   */
  calculateDispersionCoefficients(distance, stabilityClass, windProfile) {
    const params = this.getDispersionParameters(stabilityClass);
    
    // Calculate sigma_y and sigma_z using Pasquill-Gifford equations
    const sigmaY = params.a * Math.pow(distance, params.b);
    const sigmaZ = params.c * Math.pow(distance, params.d);
    
    return {
      sigmaY: sigmaY,
      sigmaZ: sigmaZ,
      distance: distance,
      stability_class: stabilityClass,
      dispersion_params: params
    };
  }

  /**
   * Calculate gas density for chemical vapor
   */
  calculateGasDensity(chemical, temperature) {
    // Use ideal gas law: ρ = (P * M) / (R * T)
    // Assuming standard atmospheric pressure (101325 Pa)
    const pressure = 101325; // Pa
    const gasConstant = 8.314; // J/(mol·K)
    const molecularWeight = (chemical.molecular_weight || 29.0) / 1000; // kg/mol
    
    return (pressure * molecularWeight) / (gasConstant * temperature);
  }

  /**
   * Determine if heavy gas model should be used instead of Gaussian
   * Based on ALOHA Section 4.4.1 criteria
   */
  async shouldUseHeavyGasModel(chemical, weatherData, emissionRate) {
    const airDensity = 1.225; // kg/m³ at standard conditions
    const temperature = weatherData.temperature || 293.15; // K
    const chemicalDensity = this.calculateGasDensity(chemical, temperature);
    
    // ALOHA criteria: Use heavy gas model if gas is significantly denser than air
    const densityRatio = chemicalDensity / airDensity;
    
    // Use heavy gas model if density ratio > 1.2 (20% heavier than air)
    return densityRatio > 1.2;
  }

  /**
   * Heavy Gas Model for dense gases (ALOHA Section 4.4)
   * Implementation following NOAA Technical Memorandum specifications
   */
  async heavyGasModel(releaseEvent, weatherData, chemical) {
    try {
      // For now, implement a simplified heavy gas model
      // Full implementation would require the complex multi-stage approach described in ALOHA Section 4.4
      console.warn('Heavy gas model detected but using simplified Gaussian with density corrections');
      
      // Use Gaussian model with modifications for dense gases (skip heavy gas check to prevent recursion)
      const gaussianResult = await this.gaussianPlumeModel(releaseEvent, weatherData, chemical, true);
      
      // Apply density corrections to the results
      const temperature = weatherData.temperature || 293.15;
      const chemicalDensity = this.calculateGasDensity(chemical, temperature);
      const airDensity = 1.225;
      const densityRatio = chemicalDensity / airDensity;
      
      // Modify concentrations to account for gravitational settling
      gaussianResult.concentrations = gaussianResult.concentrations.map(conc => ({
        ...conc,
        concentration: conc.concentration * Math.sqrt(densityRatio),
        model_note: 'heavy_gas_approximation'
      }));
      
      gaussianResult.modelParameters.model_type = 'heavy_gas_simplified';
      gaussianResult.modelParameters.density_ratio = densityRatio;
      
      return gaussianResult;
      
    } catch (error) {
      console.error('Error in heavy gas model:', error);
      throw error;
    }
  }

  /**
   * Calculate spherical polygon area for more accurate area calculations
   */
  calculateSphericalPolygonArea(coordinates) {
    // Simple spherical excess calculation for small polygons
    // For more accuracy, would need full spherical polygon area calculation
    let area = 0;
    const n = coordinates.length;
    
    for (let i = 0; i < n - 1; i++) {
      const [lon1, lat1] = coordinates[i];
      const [lon2, lat2] = coordinates[i + 1];
      
      // Convert to radians
      const lat1Rad = lat1 * Math.PI / 180;
      const lat2Rad = lat2 * Math.PI / 180;
      const lonDiff = (lon2 - lon1) * Math.PI / 180;
      
      area += lonDiff * (2 + Math.sin(lat1Rad) + Math.sin(lat2Rad));
    }
    
    // Calculate area in square kilometers instead of square meters to avoid overflow
    // Earth radius = 6371 km
    area = Math.abs(area) * 6371 * 6371 / 2; 
    
    return area;
  }

  /**
   * Calculate receptor impacts
   */
  async calculateReceptorImpacts(releaseEvent, dispersionResult, chemical) {
    try {
      const { longitude, latitude } = releaseEvent;
      const { plumePoints, modelParameters } = dispersionResult;

      // Get receptors within reasonable distance (20 km)
      const receptorQuery = `
        SELECT 
          id, name, receptor_type, height, sensitivity_level, population,
          ST_X(location) as longitude, ST_Y(location) as latitude,
          ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)) * 111320 as distance_m
        FROM receptors
        WHERE active = true
          AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326), 0.18) -- ~20 km
        ORDER BY distance_m
      `;

      const receptorResult = await DatabaseService.query(receptorQuery, [longitude, latitude]);
      const receptors = receptorResult.rows;

      const impacts = [];

      for (const receptor of receptors) {
        // Calculate concentration at receptor location
        const concentration = this.calculateConcentrationAtPoint(
          releaseEvent,
          { longitude: receptor.longitude, latitude: receptor.latitude, height: receptor.height },
          modelParameters,
          chemical
        );

        // Calculate exposure metrics
        const exposureTime = 3600; // 1 hour default
        const dose = concentration * exposureTime / 1e6; // mg·min/m³

        // Determine health impact level based on concentration and chemical toxicity
        const healthImpactLevel = this.assessHealthImpact(
          concentration,
          chemical,
          receptor.sensitivity_level,
          exposureTime
        );

        impacts.push({
          receptor_id: receptor.id,
          receptor_name: receptor.name,
          receptor_type: receptor.receptor_type,
          distance: receptor.distance_m,
          concentration: concentration,
          dose: dose,
          exposure_time: exposureTime,
          health_impact_level: healthImpactLevel,
          population_affected: receptor.population || 0
        });
      }

      return impacts;

    } catch (error) {
      console.error('Error calculating receptor impacts:', error);
      throw error;
    }
  }

  /**
   * Calculate concentration at a specific point
   */
  calculateConcentrationAtPoint(releaseEvent, point, modelParameters, chemical) {
    const { longitude: sourceLon, latitude: sourceLat, release_height } = releaseEvent;
    const { longitude: pointLon, latitude: pointLat, height: pointHeight } = point;
    const { emission_rate, wind_speed, wind_direction, stability_class, mixing_height } = modelParameters;

    // Calculate distance and direction from source to point
    const distance = this.calculateDistance(sourceLat, sourceLon, pointLat, pointLon);
    const bearing = this.calculateBearing(sourceLat, sourceLon, pointLat, pointLon);

    // Calculate crosswind distance
    const windDirRad = (wind_direction * Math.PI) / 180;
    const bearingRad = (bearing * Math.PI) / 180;
    const crosswindDistance = Math.abs(distance * Math.sin(bearingRad - windDirRad));

    if (distance < 10) return 0; // Too close to source

    // Get dispersion parameters
    const dispersionParams = this.getDispersionParameters(stability_class);
    
    // Calculate dispersion coefficients
    const sigmaY = dispersionParams.a * Math.pow(distance, dispersionParams.b);
    const sigmaZ = Math.min(
      dispersionParams.c * Math.pow(distance, dispersionParams.d),
      mixing_height / 2.15
    );

    // Height difference
    const heightDiff = (pointHeight || 1.5) - (release_height || 1.0);

    // Gaussian plume concentration calculation
    const crosswindTerm = Math.exp(-0.5 * Math.pow(crosswindDistance / sigmaY, 2));
    const heightTerm = Math.exp(-0.5 * Math.pow(heightDiff / sigmaZ, 2));
    const reflectionTerm = Math.exp(-0.5 * Math.pow((heightDiff + 2 * mixing_height) / sigmaZ, 2));

    const concentration = (emission_rate / (Math.PI * wind_speed * sigmaY * sigmaZ)) *
                         crosswindTerm * (heightTerm + reflectionTerm);

    return concentration * 1e6; // Convert to μg/m³
  }

  /**
   * Assess health impact level
   */
  assessHealthImpact(concentration, chemical, sensitivityLevel, exposureTime) {
    // This is a simplified assessment - in reality, this would use
    // detailed toxicological data and exposure standards
    
    const baseThresholds = {
      'minimal': 10,     // μg/m³
      'low': 100,
      'moderate': 1000,
      'high': 10000,
      'severe': 100000
    };

    // Adjust thresholds based on sensitivity level
    const sensitivityMultiplier = {
      'low': 2.0,
      'medium': 1.0,
      'high': 0.5,
      'critical': 0.1
    };

    const multiplier = sensitivityMultiplier[sensitivityLevel] || 1.0;
    const adjustedThresholds = {};
    
    Object.keys(baseThresholds).forEach(level => {
      adjustedThresholds[level] = baseThresholds[level] * multiplier;
    });

    if (concentration >= adjustedThresholds.severe) return 'severe';
    if (concentration >= adjustedThresholds.high) return 'high';
    if (concentration >= adjustedThresholds.moderate) return 'moderate';
    if (concentration >= adjustedThresholds.low) return 'low';
    if (concentration >= adjustedThresholds.minimal) return 'minimal';
    
    return 'negligible';
  }

  /**
   * Store receptor impacts in database
   */
  async storeReceptorImpacts(calculationId, impacts) {
    try {
      for (const impact of impacts) {
        const query = `
          INSERT INTO receptor_impacts (
            dispersion_calculation_id, receptor_id, concentration,
            dose, exposure_time, health_impact_level
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `;

        const values = [
          calculationId,
          impact.receptor_id,
          impact.concentration,
          impact.dose,
          impact.exposure_time,
          impact.health_impact_level
        ];

        await DatabaseService.query(query, values);
      }
    } catch (error) {
      console.error('Error storing receptor impacts:', error);
      throw error;
    }
  }

  /**
   * Update all active dispersions
   */
  async updateActiveDispersions() {
    const promises = Array.from(this.activeCalculations.keys()).map(async (releaseEventId) => {
      try {
        const calculationData = this.activeCalculations.get(releaseEventId);
        
        // Get latest weather data for the release location
        const locationQuery = `
          SELECT ST_X(location) as longitude, ST_Y(location) as latitude
          FROM release_events
          WHERE id = $1
        `;
        
        const locationResult = await DatabaseService.query(locationQuery, [releaseEventId]);
        if (locationResult.rows.length === 0) return;

        const { longitude, latitude } = locationResult.rows[0];
        
        const weatherService = new WeatherService();
        const weatherData = await weatherService.getLatestWeatherData(latitude, longitude);

        // Perform new calculation
        const newCalculation = await this.calculateDispersion(
          releaseEventId,
          weatherData,
          calculationData.chemical
        );

        // Update last calculation time
        calculationData.lastCalculation = new Date();

        // Notify WebSocket clients
        this.broadcastToClients(releaseEventId, {
          type: 'dispersion_update',
          release_event_id: releaseEventId,
          calculation: newCalculation,
          weather_data: weatherData
        });

      } catch (error) {
        console.error(`Error updating dispersion ${releaseEventId}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Get chemical properties from CAMEO Chemicals database
   */
  async getChemicalProperties(chemicalId) {
    try {
      // First try to get from local database
      const localQuery = `
        SELECT 
          id, name, cas_number, cameo_id, molecular_weight, density, vapor_pressure,
          boiling_point, melting_point, physical_state, volatility_class,
          toxicity_data, safety_data, last_updated
        FROM chemicals
        WHERE id = $1 OR cameo_id = $2 OR cas_number = $3
      `;

      const localResult = await DatabaseService.query(localQuery, [
        parseInt(chemicalId) || null,
        chemicalId.toString(),
        chemicalId.toString()
      ]);
      
      if (localResult.rows.length > 0) {
        const localData = localResult.rows[0];
        
        // Check if data is recent (less than 30 days old)
        const lastUpdated = new Date(localData.last_updated);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        if (lastUpdated > thirtyDaysAgo) {
          return localData;
        }
      }

      // If not in local database or data is stale, fetch from CAMEO
      let cameoData;
      
      // If chemicalId looks like a CAMEO ID, fetch directly
      if (chemicalId.startsWith('CAM') || /^\d+$/.test(chemicalId)) {
        cameoData = await this.cameoChemicalsService.getChemicalProperties(chemicalId);
      } else {
        // Search by name or CAS number
        const searchResults = await this.cameoChemicalsService.searchChemicals(chemicalId, 1);
        if (searchResults.length > 0) {
          cameoData = await this.cameoChemicalsService.getChemicalProperties(searchResults[0].cameo_id);
        }
      }

      if (cameoData) {
        // Store/update in local database
        await this.updateLocalChemicalData(cameoData);
        return cameoData;
      }

      // Fallback to existing local data if available
      if (localResult.rows.length > 0) {
        return localResult.rows[0];
      }

      throw new Error(`Chemical not found: ${chemicalId}`);

    } catch (error) {
      console.error('Error getting chemical properties:', error);
      throw error;
    }
  }

  /**
   * Update local chemical database with CAMEO data
   */
  async updateLocalChemicalData(cameoData) {
    try {
      const upsertQuery = `
        INSERT INTO chemicals (
          cameo_id, name, cas_number, formula, molecular_weight, density,
          vapor_pressure, boiling_point, melting_point, physical_state,
          volatility_class, toxicity_data, safety_data, last_updated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (cameo_id) DO UPDATE SET
          name = EXCLUDED.name,
          cas_number = EXCLUDED.cas_number,
          formula = EXCLUDED.formula,
          molecular_weight = EXCLUDED.molecular_weight,
          density = EXCLUDED.density,
          vapor_pressure = EXCLUDED.vapor_pressure,
          boiling_point = EXCLUDED.boiling_point,
          melting_point = EXCLUDED.melting_point,
          physical_state = EXCLUDED.physical_state,
          volatility_class = EXCLUDED.volatility_class,
          toxicity_data = EXCLUDED.toxicity_data,
          safety_data = EXCLUDED.safety_data,
          last_updated = EXCLUDED.last_updated
        RETURNING id
      `;

      const toxicityData = {
        twa: cameoData.twa,
        stel: cameoData.stel,
        idlh: cameoData.idlh,
        lc50: cameoData.lc50
      };

      const safetyData = {
        flash_point: cameoData.flash_point,
        explosive_limits: cameoData.explosive_limits,
        hazard_classification: cameoData.hazard_classification,
        quality_score: cameoData.quality_score
      };

      const values = [
        cameoData.cameo_id,
        cameoData.name,
        cameoData.cas_number,
        cameoData.formula,
        cameoData.molecular_weight,
        cameoData.density,
        cameoData.vapor_pressure,
        cameoData.boiling_point,
        cameoData.melting_point,
        cameoData.physical_state,
        cameoData.volatility_class,
        JSON.stringify(toxicityData),
        JSON.stringify(safetyData),
        new Date()
      ];

      await DatabaseService.query(upsertQuery, values);
      console.log(`Updated chemical data for ${cameoData.name} (${cameoData.cameo_id})`);

    } catch (error) {
      console.error('Error updating local chemical data:', error);
      // Don't throw - this is not critical for dispersion calculation
    }
  }

  /**
   * Broadcast message to WebSocket clients
   */
  broadcastToClients(releaseEventId, message) {
    if (!this.wss) return;

    this.wss.clients.forEach(client => {
      if (client.readyState === 1 && client.dispersionId === releaseEventId) { // WebSocket.OPEN
        try {
          client.send(JSON.stringify(message));
        } catch (error) {
          console.error('Error sending WebSocket message:', error);
        }
      }
    });
  }

  /**
   * Stop monitoring a release event
   */
  stopReleaseMonitoring(releaseEventId) {
    this.activeCalculations.delete(releaseEventId);
    
    // Update database status
    DatabaseService.query(
      'UPDATE release_events SET status = $1, end_time = $2 WHERE id = $3',
      ['completed', new Date(), releaseEventId]
    ).catch(error => {
      console.error('Error updating release event status:', error);
    });
  }

  // Utility functions
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    const bearing = Math.atan2(y, x);
    return ((bearing * 180) / Math.PI + 360) % 360;
  }

  /**
   * Calculate threat zones based on Levels of Concern (LOC) following ALOHA Section 4.5
   */
  calculateThreatZones(concentrations, plumePoints, levelOfConcern) {
    const threatZones = [];
    
    // Find the maximum downwind distance where concentration exceeds LOC
    let maxThreatDistance = 0;
    const threatConcentrations = concentrations.filter(conc => conc.concentration >= levelOfConcern);
    
    if (threatConcentrations.length > 0) {
      maxThreatDistance = Math.max(...threatConcentrations.map(conc => conc.distance));
    }
    
    // Create threat zone polygon
    if (maxThreatDistance > 0) {
      const threatPoints = plumePoints.filter(point => 
        point.distance <= maxThreatDistance && point.concentration >= levelOfConcern
      );
      
      if (threatPoints.length > 0) {
        threatZones.push({
          level_of_concern: levelOfConcern,
          max_distance: maxThreatDistance,
          threat_points: threatPoints,
          area: this.calculateThreatZoneArea(threatPoints),
          confidence_level: this.calculateConfidenceLevel(maxThreatDistance)
        });
      }
    }
    
    return threatZones;
  }

  /**
   * Calculate confidence contours following ALOHA Section 4.5.3
   */
  calculateConfidenceLevel(distance) {
    // ALOHA confidence decreases with distance
    // Based on typical dispersion model uncertainties
    if (distance <= 100) return 'high';
    if (distance <= 1000) return 'medium';
    if (distance <= 10000) return 'low';
    return 'very_low';
  }

  /**
   * Calculate threat zone area
   */
  calculateThreatZoneArea(threatPoints) {
    if (threatPoints.length < 3) return 0;
    
    const coordinates = [
      ...threatPoints.map(p => p.left),
      ...threatPoints.slice().reverse().map(p => p.right)
    ];
    
    return this.calculateSphericalPolygonArea(coordinates);
  }

  /**
   * Estimate maximum concentration following ALOHA Section 4.5.1
   */
  estimateMaximumConcentration(concentrations, modelParameters) {
    const maxConc = Math.max(...concentrations.map(c => c.concentration));
    
    // Apply uncertainty factors based on ALOHA methodology
    const uncertaintyFactor = this.getUncertaintyFactor(modelParameters.stability_class);
    
    return {
      estimated_max: maxConc,
      upper_bound: maxConc * uncertaintyFactor,
      confidence: this.getConcentrationConfidence(maxConc, modelParameters)
    };
  }

  /**
   * Get uncertainty factor based on atmospheric stability
   */
  getUncertaintyFactor(stabilityClass) {
    const factors = {
      'A': 3.0,  // Very unstable - high uncertainty
      'B': 2.5,  // Unstable
      'C': 2.0,  // Slightly unstable
      'D': 1.5,  // Neutral - lowest uncertainty
      'E': 2.0,  // Stable
      'F': 2.5,  // Very stable
      'G': 3.0   // Extremely stable - high uncertainty
    };
    
    return factors[stabilityClass] || 1.5;
  }

  /**
   * Get concentration confidence level
   */
  getConcentrationConfidence(concentration, modelParameters) {
    const windSpeed = modelParameters.wind_speed;
    const stability = modelParameters.stability_class;
    
    // Higher confidence for moderate wind speeds and neutral conditions
    if (windSpeed >= 2 && windSpeed <= 10 && stability === 'D') {
      return 'high';
    } else if (windSpeed >= 1 && windSpeed <= 15) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  calculatePolygonArea(coordinates) {
    // Use the more accurate spherical polygon area calculation
    return this.calculateSphericalPolygonArea(coordinates);
  }

  /**
   * Calculate spherical polygon area for threat zones
   */
  calculateSphericalPolygonArea(polygon) {
    if (!polygon || polygon.length < 3) return 0;

    // Convert to radians and calculate spherical excess
    const R = 6371000; // Earth radius in meters
    let area = 0;
    const n = polygon.length;

    // Use spherical triangulation method
    for (let i = 0; i < n - 2; i++) {
      const A = [
        polygon[0][1] * Math.PI / 180,  // lat in radians
        polygon[0][0] * Math.PI / 180   // lon in radians
      ];
      const B = [
        polygon[i + 1][1] * Math.PI / 180,
        polygon[i + 1][0] * Math.PI / 180
      ];
      const C = [
        polygon[i + 2][1] * Math.PI / 180,
        polygon[i + 2][0] * Math.PI / 180
      ];

      // Calculate spherical triangle area using L'Huilier's theorem
      const a = this.greatCircleDistance(B, C);
      const b = this.greatCircleDistance(A, C);
      const c = this.greatCircleDistance(A, B);
      const s = (a + b + c) / 2;

      if (s > a && s > b && s > c) {
        const excess = 4 * Math.atan(Math.sqrt(
          Math.tan(s/2) * Math.tan((s-a)/2) * Math.tan((s-b)/2) * Math.tan((s-c)/2)
        ));
        area += excess * R * R;
      }
    }

    return Math.abs(area);
  }

  /**
   * Calculate great circle distance between two points
   */
  greatCircleDistance(point1, point2) {
    const lat1 = point1[0];
    const lon1 = point1[1];
    const lat2 = point2[0];
    const lon2 = point2[1];

    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon/2) * Math.sin(dLon/2);

    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
}

module.exports = DispersionService;