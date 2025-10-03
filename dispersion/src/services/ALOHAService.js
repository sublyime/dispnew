const DatabaseService = require('./DatabaseService');

/**
 * ALOHA (Areal Locations of Hazardous Atmospheres) Integration Service
 * 
 * This service implements the core ALOHA atmospheric dispersion modeling algorithms
 * used by EPA for emergency response and chemical hazard analysis.
 */
class ALOHAService {
  constructor() {
    this.models = {
      GAUSSIAN_PLUME: 'gaussian_plume',
      HEAVY_GAS: 'heavy_gas',
      PUFF: 'puff',
      INSTANTANEOUS: 'instantaneous'
    };
    
    this.stabilityClasses = {
      A: { name: 'Extremely Unstable', sigma_y: 0.22, sigma_z: 0.20, p: 0.0, q: 0.0 },
      B: { name: 'Moderately Unstable', sigma_y: 0.16, sigma_z: 0.12, p: 0.0, q: 0.0 },
      C: { name: 'Slightly Unstable', sigma_y: 0.11, sigma_z: 0.08, p: 0.0, q: 0.0 },
      D: { name: 'Neutral', sigma_y: 0.08, sigma_z: 0.06, p: 0.0, q: 0.0 },
      E: { name: 'Slightly Stable', sigma_y: 0.06, sigma_z: 0.03, p: 0.0, q: -0.5 },
      F: { name: 'Moderately Stable', sigma_y: 0.04, sigma_z: 0.016, p: 0.0, q: -1.0 }
    };
  }

  /**
   * Main ALOHA dispersion calculation entry point
   */
  async calculateDispersion(releaseData, weatherData) {
    try {
      console.log('Starting ALOHA dispersion calculation...');
      
      // Determine appropriate model based on chemical properties and release type
      const model = this.selectModel(releaseData, weatherData);
      
      // Calculate source term
      const sourceterm = await this.calculateSourceTerm(releaseData, weatherData);
      
      // Perform atmospheric dispersion modeling
      const dispersionResults = await this.performDispersionModeling(
        sourceterm, weatherData, model, releaseData
      );
      
      // Generate concentration contours
      const contours = this.generateConcentrationContours(
        dispersionResults, releaseData.location
      );
      
      // Calculate receptor impacts
      const receptorImpacts = await this.calculateReceptorImpacts(
        dispersionResults, releaseData.location
      );
      
      // Store results in database
      const calculationId = await this.storeCalculationResults({
        releaseData,
        weatherData,
        model,
        sourceterm,
        dispersionResults,
        contours,
        receptorImpacts
      });
      
      return {
        calculationId,
        model,
        sourceterm,
        dispersionResults,
        contours,
        receptorImpacts,
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error('ALOHA calculation error:', error);
      throw error;
    }
  }

  /**
   * Select appropriate ALOHA model based on release characteristics
   */
  selectModel(releaseData, weatherData) {
    const { chemical, release_type, release_rate } = releaseData;
    
    // Heavy gas model for dense gases
    if (chemical.molecular_weight > 30 && chemical.density > 1.2) {
      return this.models.HEAVY_GAS;
    }
    
    // Instantaneous release model for spills/explosions
    if (release_type === 'instantaneous' || release_type === 'spill') {
      return this.models.INSTANTANEOUS;
    }
    
    // Puff model for short duration releases
    if (releaseData.duration && releaseData.duration < 600) { // 10 minutes
      return this.models.PUFF;
    }
    
    // Default to Gaussian plume for continuous releases
    return this.models.GAUSSIAN_PLUME;
  }

  /**
   * Calculate source term (emission rate and characteristics)
   */
  async calculateSourceTerm(releaseData, weatherData) {
    const { chemical, release_type, release_rate, total_mass, release_height, temperature } = releaseData;
    
    let emissionRate; // kg/s
    let duration = releaseData.duration || 3600; // default 1 hour
    
    if (release_type === 'continuous' && release_rate) {
      emissionRate = parseFloat(release_rate);
    } else if (release_type === 'instantaneous' && total_mass) {
      emissionRate = parseFloat(total_mass);
      duration = 1; // instantaneous
    } else if (total_mass && releaseData.duration) {
      emissionRate = parseFloat(total_mass) / parseFloat(releaseData.duration);
    } else {
      throw new Error('Insufficient data to calculate emission rate');
    }
    
    // Calculate buoyancy effects
    const buoyancy = this.calculateBuoyancy(chemical, weatherData, temperature);
    
    // Calculate initial plume characteristics
    const initialDispersion = this.calculateInitialDispersion(
      emissionRate, release_height || 1.0, weatherData, buoyancy
    );
    
    return {
      emission_rate: emissionRate,
      duration: duration,
      release_height: release_height || 1.0,
      temperature: temperature || weatherData.temperature,
      buoyancy,
      initial_sigma_y: initialDispersion.sigma_y,
      initial_sigma_z: initialDispersion.sigma_z,
      effective_height: initialDispersion.effective_height
    };
  }

  /**
   * Calculate buoyancy effects for plume rise
   */
  calculateBuoyancy(chemical, weatherData, releaseTemp) {
    const airDensity = 1.225; // kg/m³ at standard conditions
    const chemicalDensity = chemical.density || 1.0;
    const airTemp = weatherData.temperature + 273.15; // Convert to Kelvin
    const sourceTemp = (releaseTemp || weatherData.temperature) + 273.15;
    
    // Buoyancy flux parameter
    const buoyancyFlux = 9.81 * (airDensity - chemicalDensity) / airDensity;
    
    // Temperature difference effect
    const thermalBuoyancy = 9.81 * (sourceTemp - airTemp) / airTemp;
    
    return {
      density_ratio: chemicalDensity / airDensity,
      buoyancy_flux: buoyancyFlux,
      thermal_buoyancy: thermalBuoyancy,
      is_heavy_gas: chemicalDensity > airDensity,
      is_hot_gas: sourceTemp > airTemp
    };
  }

  /**
   * Calculate initial dispersion parameters
   */
  calculateInitialDispersion(emissionRate, height, weatherData, buoyancy) {
    const windSpeed = Math.max(weatherData.wind_speed, 0.5); // Minimum 0.5 m/s
    
    // Initial dispersion coefficients (based on source characteristics)
    let initialSigmaY = 0.1; // m
    let initialSigmaZ = 0.1; // m
    
    // Adjust for stack/elevated releases
    if (height > 5) {
      initialSigmaY = Math.max(0.1, height * 0.1);
      initialSigmaZ = Math.max(0.1, height * 0.05);
    }
    
    // Calculate effective height including plume rise
    let effectiveHeight = height;
    
    if (buoyancy.thermal_buoyancy > 0) {
      // Briggs plume rise formula for buoyant plumes
      const plumeRise = 1.6 * Math.pow(buoyancy.thermal_buoyancy / windSpeed, 1/3) * 
                       Math.pow(emissionRate / (Math.PI * windSpeed), 1/3);
      effectiveHeight += Math.max(0, plumeRise);
    }
    
    return {
      sigma_y: initialSigmaY,
      sigma_z: initialSigmaZ,
      effective_height: effectiveHeight
    };
  }

  /**
   * Perform atmospheric dispersion modeling
   */
  async performDispersionModeling(sourceterm, weatherData, model, releaseData) {
    switch (model) {
      case this.models.GAUSSIAN_PLUME:
        return this.gaussianPlumeModel(sourceterm, weatherData, releaseData);
      
      case this.models.HEAVY_GAS:
        return this.heavyGasModel(sourceterm, weatherData, releaseData);
      
      case this.models.PUFF:
        return this.puffModel(sourceterm, weatherData, releaseData);
      
      case this.models.INSTANTANEOUS:
        return this.instantaneousModel(sourceterm, weatherData, releaseData);
      
      default:
        throw new Error(`Unknown ALOHA model: ${model}`);
    }
  }

  /**
   * Gaussian Plume Model - Standard ALOHA model for continuous releases
   */
  gaussianPlumeModel(sourceterm, weatherData, releaseData) {
    const windSpeed = Math.max(weatherData.wind_speed, 0.5);
    const windDirection = weatherData.wind_direction;
    const stability = this.getStabilityClass(weatherData);
    
    // Calculate concentrations at various downwind distances
    const distances = [100, 200, 500, 1000, 2000, 5000, 10000]; // meters
    const concentrations = [];
    const maxConcentration = { value: 0, distance: 0, x: 0, y: 0 };
    
    for (const distance of distances) {
      // Calculate dispersion coefficients
      const sigmaY = this.calculateSigmaY(distance, stability);
      const sigmaZ = this.calculateSigmaZ(distance, stability);
      
      // Gaussian plume equation
      const Q = sourceterm.emission_rate; // kg/s
      const H = sourceterm.effective_height; // m
      const u = windSpeed; // m/s
      
      // Concentration at centerline (y=0, z=0)
      const concentration = (Q / (2 * Math.PI * u * sigmaY * sigmaZ)) *
                           Math.exp(-0.5 * Math.pow(H / sigmaZ, 2));
      
      // Convert to mg/m³
      const concentrationMgM3 = concentration * 1000;
      
      concentrations.push({
        distance,
        concentration: concentrationMgM3,
        sigma_y: sigmaY,
        sigma_z: sigmaZ
      });
      
      if (concentrationMgM3 > maxConcentration.value) {
        maxConcentration.value = concentrationMgM3;
        maxConcentration.distance = distance;
        
        // Convert to geographic coordinates
        const coords = this.calculateCoordinatesFromDistanceAndBearing(
          releaseData.location.lat, releaseData.location.lng, distance, windDirection
        );
        maxConcentration.x = coords.lng;
        maxConcentration.y = coords.lat;
      }
    }
    
    return {
      model_type: 'gaussian_plume',
      concentrations,
      max_concentration: maxConcentration,
      stability_class: stability,
      wind_speed: windSpeed,
      wind_direction: windDirection,
      effective_height: sourceterm.effective_height,
      emission_rate: sourceterm.emission_rate
    };
  }

  /**
   * Heavy Gas Model for dense gas releases
   */
  heavyGasModel(sourceterm, weatherData, releaseData) {
    // Simplified heavy gas model based on ALOHA methodology
    const windSpeed = Math.max(weatherData.wind_speed, 0.5);
    const windDirection = weatherData.wind_direction;
    
    // Heavy gas spreads along ground with reduced vertical mixing
    const distances = [50, 100, 200, 500, 1000, 2000]; // Shorter range for heavy gas
    const concentrations = [];
    
    for (const distance of distances) {
      // Heavy gas dispersion is wider laterally but shallower vertically
      const sigmaY = this.calculateSigmaY(distance, 'F') * 1.5; // Wider spread
      const sigmaZ = this.calculateSigmaZ(distance, 'F') * 0.5; // Shallower depth
      
      const Q = sourceterm.emission_rate;
      const u = windSpeed;
      
      // Modified concentration for heavy gas
      const concentration = (Q / (Math.PI * u * sigmaY * sigmaZ)) *
                           Math.exp(-0.5 * Math.pow(0.5 / sigmaZ, 2)); // Ground level
      
      concentrations.push({
        distance,
        concentration: concentration * 1000, // mg/m³
        sigma_y: sigmaY,
        sigma_z: sigmaZ
      });
    }
    
    return {
      model_type: 'heavy_gas',
      concentrations,
      stability_class: 'F', // Heavy gas behaves as stable
      wind_speed: windSpeed,
      wind_direction: windDirection
    };
  }

  /**
   * Puff Model for short-duration releases
   */
  puffModel(sourceterm, weatherData, releaseData) {
    // Puff model treats release as moving Gaussian cloud
    const windSpeed = Math.max(weatherData.wind_speed, 0.5);
    const windDirection = weatherData.wind_direction;
    const stability = this.getStabilityClass(weatherData);
    
    const timeSteps = [300, 600, 1800, 3600]; // 5min, 10min, 30min, 1hr
    const concentrations = [];
    
    for (const time of timeSteps) {
      const distance = windSpeed * time; // Puff travel distance
      
      const sigmaY = this.calculateSigmaY(distance, stability);
      const sigmaZ = this.calculateSigmaZ(distance, stability);
      
      const Q = sourceterm.emission_rate * sourceterm.duration; // Total mass
      
      // Puff concentration equation
      const concentration = (Q / Math.pow(2 * Math.PI, 1.5) / (sigmaY * sigmaY * sigmaZ)) *
                           Math.exp(-0.5 * Math.pow(sourceterm.effective_height / sigmaZ, 2));
      
      concentrations.push({
        time,
        distance,
        concentration: concentration * 1000,
        sigma_y: sigmaY,
        sigma_z: sigmaZ
      });
    }
    
    return {
      model_type: 'puff',
      concentrations,
      stability_class: stability,
      wind_speed: windSpeed,
      wind_direction: windDirection
    };
  }

  /**
   * Instantaneous Model for spills and explosions
   */
  instantaneousModel(sourceterm, weatherData, releaseData) {
    // Similar to puff but with immediate release
    return this.puffModel({
      ...sourceterm,
      duration: 1 // Instantaneous
    }, weatherData, releaseData);
  }

  /**
   * Calculate atmospheric stability class from weather data
   */
  getStabilityClass(weatherData) {
    const windSpeed = weatherData.wind_speed;
    const cloudCover = weatherData.cloud_cover || 50; // percent
    const isDay = this.isDaytime(); // Simplified - should use solar angle
    
    // Pasquill-Gifford stability classification
    if (windSpeed < 2) {
      return isDay ? (cloudCover < 50 ? 'A' : 'B') : 'F';
    } else if (windSpeed < 3) {
      return isDay ? (cloudCover < 50 ? 'B' : 'C') : 'E';
    } else if (windSpeed < 5) {
      return isDay ? (cloudCover < 50 ? 'C' : 'D') : 'D';
    } else if (windSpeed < 6) {
      return 'D';
    } else {
      return isDay ? 'D' : 'D';
    }
  }

  /**
   * Calculate lateral dispersion coefficient (sigma_y)
   */
  calculateSigmaY(distance, stabilityClass) {
    const params = this.getDispersionParameters(stabilityClass);
    return params.a * Math.pow(distance, params.b);
  }

  /**
   * Calculate vertical dispersion coefficient (sigma_z)
   */
  calculateSigmaZ(distance, stabilityClass) {
    const params = this.getDispersionParameters(stabilityClass);
    return params.c * Math.pow(distance, params.d);
  }

  /**
   * Get dispersion parameters for Pasquill-Gifford stability classes
   */
  getDispersionParameters(stabilityClass) {
    const parameters = {
      'A': { a: 0.22, b: 0.894, c: 0.20, d: 0.941 },
      'B': { a: 0.16, b: 0.894, c: 0.12, d: 0.941 },
      'C': { a: 0.11, b: 0.894, c: 0.08, d: 0.941 },
      'D': { a: 0.08, b: 0.894, c: 0.06, d: 0.941 },
      'E': { a: 0.06, b: 0.894, c: 0.03, d: 0.941 },
      'F': { a: 0.04, b: 0.894, c: 0.016, d: 0.941 }
    };
    
    return parameters[stabilityClass] || parameters['D'];
  }

  /**
   * Simple day/night determination (should be enhanced with solar calculations)
   */
  isDaytime() {
    const hour = new Date().getHours();
    return hour >= 6 && hour <= 18;
  }

  /**
   * Calculate geographic coordinates from distance and bearing
   */
  calculateCoordinatesFromDistanceAndBearing(lat, lon, distance, bearing) {
    const R = 6371000; // Earth's radius in meters
    const bearingRad = (bearing + 180) % 360 * (Math.PI / 180); // Convert to downwind direction
    const latRad = lat * (Math.PI / 180);
    const lonRad = lon * (Math.PI / 180);
    
    const destLatRad = Math.asin(
      Math.sin(latRad) * Math.cos(distance / R) +
      Math.cos(latRad) * Math.sin(distance / R) * Math.cos(bearingRad)
    );
    
    const destLonRad = lonRad + Math.atan2(
      Math.sin(bearingRad) * Math.sin(distance / R) * Math.cos(latRad),
      Math.cos(distance / R) - Math.sin(latRad) * Math.sin(destLatRad)
    );
    
    return {
      lat: destLatRad * (180 / Math.PI),
      lng: destLonRad * (180 / Math.PI)
    };
  }

  /**
   * Generate concentration contours for visualization
   */
  generateConcentrationContours(dispersionResults, location) {
    const contours = [];
    const thresholds = [0.1, 1.0, 10.0, 100.0, 1000.0]; // mg/m³
    
    // Create contour polygons for each threshold
    for (const threshold of thresholds) {
      const contourPoints = this.calculateContourPoints(dispersionResults, threshold, location);
      
      if (contourPoints.length > 0) {
        contours.push({
          threshold,
          points: contourPoints,
          color: this.getContourColor(threshold),
          geometry: this.createContourPolygon(contourPoints)
        });
      }
    }
    
    return contours;
  }

  /**
   * Calculate contour points for a given concentration threshold
   */
  calculateContourPoints(dispersionResults, threshold, location) {
    const points = [];
    const { wind_direction, concentrations } = dispersionResults;
    
    // Find distances where concentration equals threshold
    for (let i = 0; i < concentrations.length - 1; i++) {
      const c1 = concentrations[i];
      const c2 = concentrations[i + 1];
      
      // Interpolate to find exact distance where concentration = threshold
      if ((c1.concentration >= threshold && c2.concentration <= threshold) ||
          (c1.concentration <= threshold && c2.concentration >= threshold)) {
        
        const ratio = (threshold - c1.concentration) / (c2.concentration - c1.concentration);
        const distance = c1.distance + ratio * (c2.distance - c1.distance);
        const sigmaY = c1.sigma_y + ratio * (c2.sigma_y - c1.sigma_y);
        
        // Create points along the plume width
        const crossWindAngles = [-90, -45, 0, 45, 90]; // degrees from wind direction
        
        for (const angle of crossWindAngles) {
          const bearing = (wind_direction + 180 + angle) % 360;
          const crossWindDistance = angle === 0 ? distance : distance + Math.abs(angle / 90) * sigmaY;
          
          const coords = this.calculateCoordinatesFromDistanceAndBearing(
            location.lat, location.lng, crossWindDistance, bearing
          );
          
          points.push([coords.lng, coords.lat]);
        }
      }
    }
    
    return points;
  }

  /**
   * Get color for concentration contour
   */
  getContourColor(threshold) {
    if (threshold <= 0.1) return '#00FF00'; // Green - safe
    if (threshold <= 1.0) return '#FFFF00'; // Yellow - caution
    if (threshold <= 10.0) return '#FFA500'; // Orange - warning
    if (threshold <= 100.0) return '#FF0000'; // Red - danger
    return '#800080'; // Purple - extreme danger
  }

  /**
   * Create GeoJSON polygon from contour points
   */
  createContourPolygon(points) {
    if (points.length < 3) return null;
    
    // Close the polygon
    const closedPoints = [...points, points[0]];
    
    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [closedPoints]
      },
      properties: {
        type: 'concentration_contour'
      }
    };
  }

  /**
   * Calculate impacts at receptor locations
   */
  async calculateReceptorImpacts(dispersionResults, location) {
    try {
      // Get all active receptors within reasonable distance
      const query = `
        SELECT id, name, receptor_type, height, sensitivity_level, population,
               ST_X(location) as longitude, ST_Y(location) as latitude,
               ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)) as distance_deg
        FROM receptors 
        WHERE active = true 
        AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326), 0.1)
        ORDER BY distance_deg
      `;
      
      const result = await DatabaseService.query(query, [location.lng, location.lat]);
      const receptors = result.rows;
      
      const impacts = [];
      
      for (const receptor of receptors) {
        // Calculate distance and bearing to receptor
        const distance = this.calculateDistance(
          location.lat, location.lng,
          receptor.latitude, receptor.longitude
        );
        
        const bearing = this.calculateBearing(
          location.lat, location.lng,
          receptor.latitude, receptor.longitude
        );
        
        // Calculate concentration at receptor location
        const concentration = this.interpolateConcentration(
          dispersionResults, distance, bearing
        );
        
        // Calculate health impact based on concentration and receptor type
        const healthImpact = this.calculateHealthImpact(
          concentration, receptor
        );
        
        impacts.push({
          receptor_id: receptor.id,
          receptor_name: receptor.name,
          receptor_type: receptor.receptor_type,
          distance,
          bearing,
          concentration,
          health_impact: healthImpact
        });
      }
      
      return impacts;
      
    } catch (error) {
      console.error('Error calculating receptor impacts:', error);
      return [];
    }
  }

  /**
   * Interpolate concentration at specific distance and bearing
   */
  interpolateConcentration(dispersionResults, distance, bearing) {
    const { concentrations, wind_direction } = dispersionResults;
    
    // Find surrounding concentration points
    let c1 = concentrations[0];
    let c2 = concentrations[concentrations.length - 1];
    
    for (let i = 0; i < concentrations.length - 1; i++) {
      if (distance >= concentrations[i].distance && distance <= concentrations[i + 1].distance) {
        c1 = concentrations[i];
        c2 = concentrations[i + 1];
        break;
      }
    }
    
    // Linear interpolation for distance
    const ratio = (distance - c1.distance) / (c2.distance - c1.distance);
    const baseConcentration = c1.concentration + ratio * (c2.concentration - c1.concentration);
    const sigmaY = c1.sigma_y + ratio * (c2.sigma_y - c1.sigma_y);
    
    // Adjust for cross-wind position
    const crossWindAngle = Math.abs(bearing - wind_direction);
    const crossWindDistance = distance * Math.sin(crossWindAngle * Math.PI / 180);
    
    // Gaussian distribution in cross-wind direction
    const crossWindFactor = Math.exp(-0.5 * Math.pow(crossWindDistance / sigmaY, 2));
    
    return baseConcentration * crossWindFactor;
  }

  /**
   * Calculate health impact based on concentration and receptor characteristics
   */
  calculateHealthImpact(concentration, receptor) {
    // Simplified health impact assessment
    const thresholds = {
      'school': { low: 0.1, medium: 1.0, high: 10.0 },
      'hospital': { low: 0.05, medium: 0.5, high: 5.0 },
      'residential': { low: 0.2, medium: 2.0, high: 20.0 },
      'industrial': { low: 1.0, medium: 10.0, high: 100.0 }
    };
    
    const receptorThresholds = thresholds[receptor.receptor_type] || thresholds['residential'];
    
    if (concentration < receptorThresholds.low) {
      return { level: 'safe', description: 'No significant health risk' };
    } else if (concentration < receptorThresholds.medium) {
      return { level: 'low', description: 'Minor health effects possible' };
    } else if (concentration < receptorThresholds.high) {
      return { level: 'medium', description: 'Moderate health effects likely' };
    } else {
      return { level: 'high', description: 'Serious health effects expected' };
    }
  }

  /**
   * Calculate distance between two points
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Calculate bearing from point 1 to point 2
   */
  calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }

  /**
   * Store calculation results in database
   */
  async storeCalculationResults(results) {
    try {
      const query = `
        INSERT INTO dispersion_calculations (
          release_event_id, calculation_time, max_concentration, affected_area,
          calculation_method, meteorological_conditions, model_parameters, receptor_impacts
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;
      
      const values = [
        results.releaseData.id,
        new Date(),
        results.dispersionResults.max_concentration?.value || 0,
        this.calculateAffectedArea(results.contours),
        results.model,
        JSON.stringify(results.weatherData),
        JSON.stringify({
          sourceterm: results.sourceterm,
          model_parameters: results.dispersionResults
        }),
        JSON.stringify(results.receptorImpacts)
      ];
      
      const result = await DatabaseService.query(query, values);
      return result.rows[0].id;
      
    } catch (error) {
      console.error('Error storing calculation results:', error);
      throw error;
    }
  }

  /**
   * Calculate total affected area from contours
   */
  calculateAffectedArea(contours) {
    if (!contours || contours.length === 0) return 0;
    
    // Return area of largest contour (simplified)
    const largestContour = contours.reduce((max, contour) => 
      contour.threshold > max.threshold ? contour : max, contours[0]);
    
    // Rough area calculation (should be more sophisticated)
    return largestContour.points.length * 1000; // Placeholder
  }
}

module.exports = ALOHAService;