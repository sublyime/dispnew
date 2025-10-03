const axios = require('axios');
const DatabaseService = require('./DatabaseService');

class WeatherService {
  constructor() {
    this.baseURL = process.env.WEATHER_GOV_API_BASE || 'https://api.weather.gov';
    this.updateInterval = parseInt(process.env.WEATHER_UPDATE_INTERVAL) || 30000; // 30 seconds
    this.intervalId = null;
    this.activeLocations = new Set();
  }

  /**
   * Start periodic weather updates for all active locations
   */
  startPeriodicUpdates() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(async () => {
      await this.updateAllActiveLocations();
    }, this.updateInterval);

    console.log(`Weather service started with ${this.updateInterval}ms update interval`);
  }

  /**
   * Stop periodic weather updates
   */
  stopPeriodicUpdates() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Weather service stopped');
    }
  }

  /**
   * Get current weather for a specific location
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {Object} Weather data
   */
  async getCurrentWeather(lat, lon) {
    try {
      // First, get the grid point data
      const gridResponse = await axios.get(
        `${this.baseURL}/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
        {
          headers: {
            'User-Agent': 'Chemical Dispersion Modeler (contact@example.com)'
          },
          timeout: 10000
        }
      );

      const { forecastOffice, gridX, gridY } = gridResponse.data.properties;

      // Get the current conditions
      const observationsResponse = await axios.get(
        `${this.baseURL}/gridpoints/${forecastOffice}/${gridX},${gridY}/observations`,
        {
          headers: {
            'User-Agent': 'Chemical Dispersion Modeler (contact@example.com)'
          },
          timeout: 10000
        }
      );

      const latestObservation = observationsResponse.data.features[0];
      
      if (!latestObservation) {
        throw new Error('No weather observations available for this location');
      }

      const props = latestObservation.properties;
      
      // Parse weather data
      const weatherData = {
        timestamp: new Date(props.timestamp),
        temperature: this.parseTemperature(props.temperature),
        humidity: this.parseValue(props.relativeHumidity),
        pressure: this.parseValue(props.barometricPressure),
        wind_speed: this.parseValue(props.windSpeed),
        wind_direction: this.parseValue(props.windDirection),
        visibility: this.parseValue(props.visibility),
        cloud_cover: this.parseCloudCover(props.cloudLayers),
        weather_description: props.textDescription,
        raw_data: props
      };

      // Calculate atmospheric stability
      weatherData.atmospheric_stability = this.calculateAtmosphericStability(weatherData);
      
      // Estimate mixing height (simplified calculation)
      weatherData.mixing_height = this.estimateMixingHeight(weatherData);

      return weatherData;

    } catch (error) {
      console.error('Error fetching weather data:', error);
      
      // Return default/estimated weather if API fails
      return this.getDefaultWeatherData(lat, lon);
    }
  }

  /**
   * Store weather data in database
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {Object} weatherData - Weather data object
   */
  async storeWeatherData(lat, lon, weatherData) {
    try {
      // First, ensure we have a weather station record
      const stationId = await this.ensureWeatherStation(lat, lon);
      
      // Insert weather data
      const insertQuery = `
        INSERT INTO weather_data (
          station_id, timestamp, temperature, humidity, pressure,
          wind_speed, wind_direction, precipitation, cloud_cover,
          visibility, atmospheric_stability, mixing_height, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `;

      const values = [
        stationId,
        weatherData.timestamp,
        weatherData.temperature,
        weatherData.humidity,
        weatherData.pressure,
        weatherData.wind_speed,
        weatherData.wind_direction,
        weatherData.precipitation || 0,
        weatherData.cloud_cover,
        weatherData.visibility,
        weatherData.atmospheric_stability,
        weatherData.mixing_height,
        JSON.stringify(weatherData.raw_data)
      ];

      const result = await DatabaseService.query(insertQuery, values);
      return result.rows[0].id;

    } catch (error) {
      console.error('Error storing weather data:', error);
      throw error;
    }
  }

  /**
   * Ensure weather station exists for the location
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {number} Station ID
   */
  async ensureWeatherStation(lat, lon) {
    try {
      const stationId = `POINT_${lat.toFixed(4)}_${lon.toFixed(4)}`;
      
      // Check if station exists
      const checkQuery = `
        SELECT id FROM weather_stations WHERE station_id = $1
      `;
      
      let result = await DatabaseService.query(checkQuery, [stationId]);
      
      if (result.rows.length === 0) {
        // Create new station
        const insertQuery = `
          INSERT INTO weather_stations (station_id, name, location, station_type)
          VALUES ($1, $2, ST_GeomFromText('POINT($3 $4)', 4326), 'api')
          RETURNING id
        `;
        
        const stationName = `Weather Point ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        result = await DatabaseService.query(insertQuery, [stationId, stationName, lon, lat]);
      }
      
      return result.rows[0].id;

    } catch (error) {
      console.error('Error ensuring weather station:', error);
      throw error;
    }
  }

  /**
   * Add location for periodic weather updates
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   */
  addActiveLocation(lat, lon) {
    const locationKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    this.activeLocations.add(locationKey);
    console.log(`Added active weather location: ${locationKey}`);
  }

  /**
   * Remove location from periodic updates
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   */
  removeActiveLocation(lat, lon) {
    const locationKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    this.activeLocations.delete(locationKey);
    console.log(`Removed active weather location: ${locationKey}`);
  }

  /**
   * Update weather for all active locations
   */
  async updateAllActiveLocations() {
    const promises = Array.from(this.activeLocations).map(async (locationKey) => {
      const [lat, lon] = locationKey.split(',').map(Number);
      try {
        const weatherData = await this.getCurrentWeather(lat, lon);
        await this.storeWeatherData(lat, lon, weatherData);
      } catch (error) {
        console.error(`Error updating weather for ${locationKey}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Get latest weather data from database
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {Object} Latest weather data
   */
  async getLatestWeatherData(lat, lon) {
    try {
      const query = `
        SELECT wd.*, ws.station_id, ws.name as station_name
        FROM weather_data wd
        JOIN weather_stations ws ON wd.station_id = ws.id
        WHERE ST_DWithin(ws.location, ST_GeomFromText('POINT($1 $2)', 4326), 0.01)
        ORDER BY wd.timestamp DESC
        LIMIT 1
      `;

      const result = await DatabaseService.query(query, [lon, lat]);
      
      if (result.rows.length === 0) {
        // No data found, fetch new data
        const weatherData = await this.getCurrentWeather(lat, lon);
        await this.storeWeatherData(lat, lon, weatherData);
        return weatherData;
      }

      return result.rows[0];

    } catch (error) {
      console.error('Error getting latest weather data:', error);
      throw error;
    }
  }

  // Helper methods
  parseTemperature(tempValue) {
    if (!tempValue || !tempValue.value) return null;
    // Convert from Celsius to Celsius (API returns Celsius)
    return parseFloat(tempValue.value);
  }

  parseValue(valueObj) {
    if (!valueObj || valueObj.value === null) return null;
    return parseFloat(valueObj.value);
  }

  parseCloudCover(cloudLayers) {
    if (!cloudLayers || cloudLayers.length === 0) return 0;
    
    // Calculate total cloud cover
    let totalCover = 0;
    cloudLayers.forEach(layer => {
      if (layer.amount && layer.amount.value) {
        totalCover += parseFloat(layer.amount.value);
      }
    });
    
    return Math.min(totalCover, 100);
  }

  calculateAtmosphericStability(weatherData) {
    // Simplified Pasquill stability class calculation
    const windSpeed = weatherData.wind_speed || 0;
    const cloudCover = weatherData.cloud_cover || 0;
    
    // This is a simplified calculation - in reality, this would need
    // more sophisticated meteorological algorithms
    if (windSpeed < 2) {
      return cloudCover > 50 ? 'F' : 'G'; // Very stable to extremely stable
    } else if (windSpeed < 3) {
      return cloudCover > 50 ? 'E' : 'F'; // Stable to very stable
    } else if (windSpeed < 5) {
      return cloudCover > 50 ? 'D' : 'E'; // Neutral to stable
    } else if (windSpeed < 6) {
      return 'D'; // Neutral
    } else {
      return cloudCover < 50 ? 'B' : 'C'; // Unstable to slightly unstable
    }
  }

  estimateMixingHeight(weatherData) {
    // Simplified mixing height estimation based on stability and wind speed
    const stability = weatherData.atmospheric_stability;
    const windSpeed = weatherData.wind_speed || 1;
    
    const baseHeight = {
      'A': 1500, // Very unstable
      'B': 1200, // Unstable
      'C': 800,  // Slightly unstable
      'D': 600,  // Neutral
      'E': 400,  // Stable
      'F': 200,  // Very stable
      'G': 100   // Extremely stable
    };
    
    return (baseHeight[stability] || 600) * Math.max(0.5, windSpeed / 5);
  }

  getDefaultWeatherData(lat, lon) {
    // Return reasonable default values when API is unavailable
    return {
      timestamp: new Date(),
      temperature: 20, // 20°C
      humidity: 60,    // 60%
      pressure: 1013.25, // Standard atmospheric pressure
      wind_speed: 3,   // 3 m/s
      wind_direction: 270, // West
      visibility: 10000,   // 10 km
      cloud_cover: 50,     // 50%
      atmospheric_stability: 'D', // Neutral
      mixing_height: 600,         // 600 m
      weather_description: 'Default conditions (API unavailable)',
      raw_data: { source: 'default' }
    };
  }
}

module.exports = WeatherService;