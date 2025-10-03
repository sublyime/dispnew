const DatabaseService = require('./DatabaseService');
const WeatherService = require('./WeatherService');

class DispersionService {
  constructor(websocketServer) {
    this.wss = websocketServer;
    this.activeCalculations = new Map();
    this.updateInterval = 30000; // 30 seconds
    this.intervalId = null;
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

      // Get chemical properties
      const chemical = await this.getChemicalProperties(chemical_id);
      if (!chemical) {
        throw new Error('Chemical not found');
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
          ST_GeomFromText('POINT($1 $2)', 4326), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        )
        RETURNING id, start_time
      `;

      const values = [
        parseFloat(longitude),
        parseFloat(latitude),
        chemical_id,
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

      return {
        release_event_id: releaseEventId,
        start_time: result.rows[0].start_time,
        initial_calculation: initialCalculation
      };

    } catch (error) {
      console.error('Error creating release event:', error);
      throw error;
    }
  }

  /**
   * Calculate dispersion for a release event
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

      // Perform dispersion calculation using Gaussian plume model
      const dispersionResult = await this.gaussianPlumeModel(
        releaseEvent,
        weatherData,
        chemical
      );

      // Get affected receptors
      const receptorImpacts = await this.calculateReceptorImpacts(
        releaseEvent,
        dispersionResult,
        chemical
      );

      // Store calculation results
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
        dispersionResult.plumeGeometry,
        dispersionResult.maxConcentration,
        dispersionResult.affectedArea,
        'gaussian_plume',
        JSON.stringify(weatherData),
        JSON.stringify(dispersionResult.modelParameters),
        JSON.stringify(receptorImpacts)
      ];

      const calcResult = await DatabaseService.query(insertQuery, values);
      const calculationId = calcResult.rows[0].id;

      // Store individual receptor impacts
      await this.storeReceptorImpacts(calculationId, receptorImpacts);

      return {
        calculation_id: calculationId,
        plume_geometry: JSON.parse(dispersionResult.plumeGeometry),
        max_concentration: dispersionResult.maxConcentration,
        affected_area: dispersionResult.affectedArea,
        receptor_impacts: receptorImpacts,
        calculation_time: new Date()
      };

    } catch (error) {
      console.error('Error calculating dispersion:', error);
      throw error;
    }
  }

  /**
   * Gaussian plume dispersion model implementation
   */
  async gaussianPlumeModel(releaseEvent, weatherData, chemical) {
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

      // Model parameters
      const effectiveHeight = parseFloat(release_height) || 1.0;
      const windSpeed = Math.max(parseFloat(wind_speed) || 2.0, 0.5); // Minimum 0.5 m/s
      const windDir = parseFloat(wind_direction) || 270; // Default west wind
      const stability = atmospheric_stability || 'D';

      // Pasquill-Gifford dispersion parameters
      const dispersionParams = this.getDispersionParameters(stability);

      // Calculate emission rate
      let emissionRate;
      if (release_rate) {
        emissionRate = parseFloat(release_rate);
      } else if (total_mass) {
        // Estimate emission rate from total mass (assuming 1-hour release if not specified)
        emissionRate = parseFloat(total_mass) / 3600; // g/s
      } else {
        emissionRate = 1.0; // Default 1 g/s
      }

      // Calculate plume centerline concentrations at various distances
      const distances = [50, 100, 200, 500, 1000, 2000, 5000, 10000]; // meters
      const concentrations = [];
      const plumePoints = [];

      for (const distance of distances) {
        // Calculate dispersion coefficients
        const sigmaY = dispersionParams.a * Math.pow(distance, dispersionParams.b);
        const sigmaZ = dispersionParams.c * Math.pow(distance, dispersionParams.d);

        // Limit vertical dispersion by mixing height
        const effectiveSigmaZ = Math.min(sigmaZ, mixing_height / 2.15);

        // Gaussian plume equation for ground-level concentration
        const heightTerm = Math.exp(-0.5 * Math.pow(effectiveHeight / effectiveSigmaZ, 2));
        const reflectionTerm = Math.exp(-0.5 * Math.pow((effectiveHeight + 2 * mixing_height) / effectiveSigmaZ, 2));
        
        const concentration = (emissionRate / (Math.PI * windSpeed * sigmaY * effectiveSigmaZ)) * 
                             (heightTerm + reflectionTerm);

        concentrations.push({
          distance,
          concentration: concentration * 1e6, // Convert to μg/m³
          sigma_y: sigmaY,
          sigma_z: effectiveSigmaZ
        });

        // Calculate plume boundary points (±3σ)
        const crosswindDistance = 3 * sigmaY;
        
        // Convert wind direction to mathematical angle (0° = East, counter-clockwise)
        const mathAngle = (450 - windDir) % 360;
        const radians = (mathAngle * Math.PI) / 180;

        // Calculate downwind point
        const downwindLat = latitude + (distance * Math.cos(radians)) / 111320;
        const downwindLon = longitude + (distance * Math.sin(radians)) / (111320 * Math.cos(latitude * Math.PI / 180));

        // Calculate crosswind boundary points
        const crosswindAngle = radians + Math.PI / 2;
        
        const leftLat = downwindLat + (crosswindDistance * Math.cos(crosswindAngle)) / 111320;
        const leftLon = downwindLon + (crosswindDistance * Math.sin(crosswindAngle)) / (111320 * Math.cos(latitude * Math.PI / 180));
        
        const rightLat = downwindLat - (crosswindDistance * Math.cos(crosswindAngle)) / 111320;
        const rightLon = downwindLon - (crosswindDistance * Math.sin(crosswindAngle)) / (111320 * Math.cos(latitude * Math.PI / 180));

        plumePoints.push({
          center: [downwindLon, downwindLat],
          left: [leftLon, leftLat],
          right: [rightLon, rightLat],
          distance,
          concentration: concentration * 1e6
        });
      }

      // Create plume geometry as GeoJSON polygon
      const plumeCoordinates = [
        [longitude, latitude], // Source point
        ...plumePoints.map(p => p.left),
        ...plumePoints.slice().reverse().map(p => p.right),
        [longitude, latitude] // Close polygon
      ];

      const plumeGeometry = JSON.stringify({
        type: 'Polygon',
        coordinates: [plumeCoordinates]
      });

      // Calculate affected area (simple polygon area calculation)
      const affectedArea = this.calculatePolygonArea(plumeCoordinates);

      // Find maximum concentration
      const maxConcentration = Math.max(...concentrations.map(c => c.concentration));

      return {
        plumeGeometry,
        maxConcentration,
        affectedArea,
        concentrations,
        plumePoints,
        modelParameters: {
          emission_rate: emissionRate,
          wind_speed: windSpeed,
          wind_direction: windDir,
          stability_class: stability,
          effective_height: effectiveHeight,
          mixing_height,
          dispersion_params: dispersionParams
        }
      };

    } catch (error) {
      console.error('Error in Gaussian plume model:', error);
      throw error;
    }
  }

  /**
   * Get Pasquill-Gifford dispersion parameters
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
          ST_Distance(location, ST_GeomFromText('POINT($1 $2)', 4326)) * 111320 as distance_m
        FROM receptors
        WHERE active = true
          AND ST_DWithin(location, ST_GeomFromText('POINT($1 $2)', 4326), 0.18) -- ~20 km
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
   * Get chemical properties
   */
  async getChemicalProperties(chemicalId) {
    try {
      const query = `
        SELECT 
          id, name, cas_number, molecular_weight, density, vapor_pressure,
          boiling_point, melting_point, physical_state, volatility_class,
          toxicity_data, safety_data
        FROM chemicals
        WHERE id = $1
      `;

      const result = await DatabaseService.query(query, [chemicalId]);
      return result.rows[0] || null;

    } catch (error) {
      console.error('Error getting chemical properties:', error);
      throw error;
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

  calculatePolygonArea(coordinates) {
    // Simple polygon area calculation using the shoelace formula
    let area = 0;
    const n = coordinates.length;
    
    for (let i = 0; i < n - 1; i++) {
      area += coordinates[i][0] * coordinates[i + 1][1];
      area -= coordinates[i + 1][0] * coordinates[i][1];
    }
    
    area = Math.abs(area) / 2;
    
    // Convert to square meters (approximate)
    const lat = coordinates[0][1];
    const metersPerDegree = 111320 * Math.cos(lat * Math.PI / 180);
    return area * metersPerDegree * 111320;
  }
}

module.exports = DispersionService;