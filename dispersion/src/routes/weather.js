const express = require('express');
const router = express.Router();
const WeatherService = require('../services/WeatherService');
const DatabaseService = require('../services/DatabaseService');

const weatherService = new WeatherService();

/**
 * GET /api/weather/current/:lat/:lon
 * Get current weather conditions for a specific location
 */
router.get('/current/:lat/:lon', async (req, res) => {
  try {
    const lat = parseFloat(req.params.lat);
    const lon = parseFloat(req.params.lon);

    // Validate coordinates
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({
        error: 'Invalid coordinates',
        message: 'Latitude must be between -90 and 90, longitude between -180 and 180'
      });
    }

    try {
      // Get current weather data
      const weatherData = await weatherService.getCurrentWeather(lat, lon);
      
      // Store in database
      await weatherService.storeWeatherData(lat, lon, weatherData);
      
      // Add to active locations for periodic updates
      weatherService.addActiveLocation(lat, lon);

      res.json({
        success: true,
        location: { lat, lon },
        weather: weatherData,
        timestamp: new Date().toISOString()
      });
    } catch (weatherError) {
      console.error('Weather API failed, using fallback data:', weatherError.message);
      
      // Provide fallback weather data
      const fallbackWeather = {
        timestamp: new Date(),
        temperature: 20,  // 20°C
        humidity: 50,     // 50%
        pressure: 1013.25, // Standard atmosphere
        wind_speed: 3,    // 3 m/s
        wind_direction: 270, // West wind
        wind_gust: null,
        visibility: 10000, // 10km
        conditions: 'Clear',
        dew_point: 10,
        heat_index: null,
        wind_chill: null,
        pressure_tendency: 'steady',
        stability_class: 'D', // Neutral stability
        mixing_height: 1000, // 1000m
        source: 'fallback'
      };

      res.json({
        success: true,
        location: { lat, lon },
        weather: fallbackWeather,
        timestamp: new Date().toISOString(),
        note: 'Using fallback weather data - live data unavailable'
      });
    }

  } catch (error) {
    console.error('Error getting current weather:', error);
    res.status(500).json({
      error: 'Weather data unavailable',
      message: error.message
    });
  }
});

/**
 * GET /api/weather/latest/:lat/:lon
 * Get latest weather data from database for a location
 */
router.get('/latest/:lat/:lon', async (req, res) => {
  try {
    const lat = parseFloat(req.params.lat);
    const lon = parseFloat(req.params.lon);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({
        error: 'Invalid coordinates'
      });
    }

    const weatherData = await weatherService.getLatestWeatherData(lat, lon);

    res.json({
      success: true,
      location: { lat, lon },
      weather: weatherData
    });

  } catch (error) {
    console.error('Error getting latest weather:', error);
    res.status(500).json({
      error: 'Failed to retrieve weather data',
      message: error.message
    });
  }
});

/**
 * GET /api/weather/history/:lat/:lon
 * Get historical weather data for a location
 */
router.get('/history/:lat/:lon', async (req, res) => {
  try {
    const lat = parseFloat(req.params.lat);
    const lon = parseFloat(req.params.lon);
    const hours = parseInt(req.query.hours) || 24;
    const limit = parseInt(req.query.limit) || 100;

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({
        error: 'Invalid coordinates'
      });
    }

    const query = `
      SELECT wd.*, ws.station_id, ws.name as station_name
      FROM weather_data wd
      JOIN weather_stations ws ON wd.station_id = ws.id
      WHERE ST_DWithin(ws.location, ST_SetSRID(ST_MakePoint($1, $2), 4326), 0.01)
        AND wd.timestamp > NOW() - INTERVAL '${hours} hours'
      ORDER BY wd.timestamp DESC
      LIMIT $3
    `;

    const result = await DatabaseService.query(query, [lon, lat, limit]);

    res.json({
      success: true,
      location: { lat, lon },
      history: result.rows,
      count: result.rows.length,
      timeRange: `${hours} hours`
    });

  } catch (error) {
    console.error('Error getting weather history:', error);
    res.status(500).json({
      error: 'Failed to retrieve weather history',
      message: error.message
    });
  }
});

/**
 * GET /api/weather/stations
 * Get all weather stations
 */
router.get('/stations', async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        station_id,
        name,
        ST_X(location) as longitude,
        ST_Y(location) as latitude,
        elevation,
        station_type,
        active,
        created_at
      FROM weather_stations
      WHERE active = true
      ORDER BY created_at DESC
    `;

    const result = await DatabaseService.query(query);

    res.json({
      success: true,
      stations: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Error getting weather stations:', error);
    res.status(500).json({
      error: 'Failed to retrieve weather stations',
      message: error.message
    });
  }
});

/**
 * POST /api/weather/stations
 * Create a new weather station
 */
router.post('/stations', async (req, res) => {
  try {
    const { station_id, name, latitude, longitude, elevation, station_type } = req.body;

    if (!station_id || !name || !latitude || !longitude) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['station_id', 'name', 'latitude', 'longitude']
      });
    }

    const query = `
      INSERT INTO weather_stations (station_id, name, location, elevation, station_type)
      VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6)
      RETURNING id, station_id, name, ST_X(location) as longitude, ST_Y(location) as latitude
    `;

    const values = [
      station_id,
      name,
      parseFloat(longitude),
      parseFloat(latitude),
      elevation || null,
      station_type || 'manual'
    ];

    const result = await DatabaseService.query(query, values);

    res.status(201).json({
      success: true,
      station: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating weather station:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        error: 'Station ID already exists'
      });
    }

    res.status(500).json({
      error: 'Failed to create weather station',
      message: error.message
    });
  }
});

/**
 * POST /api/weather/manual/:stationId
 * Manually input weather data for a station
 */
router.post('/manual/:stationId', async (req, res) => {
  try {
    const { stationId } = req.params;
    const {
      temperature,
      humidity,
      pressure,
      wind_speed,
      wind_direction,
      precipitation,
      cloud_cover,
      visibility
    } = req.body;

    // Get station information
    const stationQuery = `
      SELECT id FROM weather_stations WHERE station_id = $1 AND active = true
    `;
    
    const stationResult = await DatabaseService.query(stationQuery, [stationId]);
    
    if (stationResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Weather station not found'
      });
    }

    const station_id = stationResult.rows[0].id;

    // Calculate atmospheric stability and mixing height
    const weatherData = {
      temperature: parseFloat(temperature),
      humidity: parseFloat(humidity),
      pressure: parseFloat(pressure),
      wind_speed: parseFloat(wind_speed),
      wind_direction: parseFloat(wind_direction),
      precipitation: parseFloat(precipitation) || 0,
      cloud_cover: parseFloat(cloud_cover),
      visibility: parseFloat(visibility)
    };

    weatherData.atmospheric_stability = weatherService.calculateAtmosphericStability(weatherData);
    weatherData.mixing_height = weatherService.estimateMixingHeight(weatherData);

    // Insert weather data
    const insertQuery = `
      INSERT INTO weather_data (
        station_id, timestamp, temperature, humidity, pressure,
        wind_speed, wind_direction, precipitation, cloud_cover,
        visibility, atmospheric_stability, mixing_height, raw_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, timestamp
    `;

    const values = [
      station_id,
      new Date(),
      weatherData.temperature,
      weatherData.humidity,
      weatherData.pressure,
      weatherData.wind_speed,
      weatherData.wind_direction,
      weatherData.precipitation,
      weatherData.cloud_cover,
      weatherData.visibility,
      weatherData.atmospheric_stability,
      weatherData.mixing_height,
      JSON.stringify({ source: 'manual', ...weatherData })
    ];

    const result = await DatabaseService.query(insertQuery, values);

    res.status(201).json({
      success: true,
      weather_data: {
        id: result.rows[0].id,
        timestamp: result.rows[0].timestamp,
        ...weatherData
      }
    });

  } catch (error) {
    console.error('Error inserting manual weather data:', error);
    res.status(500).json({
      error: 'Failed to insert weather data',
      message: error.message
    });
  }
});

/**
 * DELETE /api/weather/active/:lat/:lon
 * Remove location from active weather monitoring
 */
router.delete('/active/:lat/:lon', async (req, res) => {
  try {
    const lat = parseFloat(req.params.lat);
    const lon = parseFloat(req.params.lon);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({
        error: 'Invalid coordinates'
      });
    }

    weatherService.removeActiveLocation(lat, lon);

    res.json({
      success: true,
      message: 'Location removed from active monitoring',
      location: { lat, lon }
    });

  } catch (error) {
    console.error('Error removing active location:', error);
    res.status(500).json({
      error: 'Failed to remove active location',
      message: error.message
    });
  }
});

/**
 * GET /api/weather/active
 * Get all active weather monitoring locations
 */
router.get('/active', (req, res) => {
  try {
    const activeLocations = Array.from(weatherService.activeLocations).map(locationKey => {
      const [lat, lon] = locationKey.split(',').map(Number);
      return { lat, lon };
    });

    res.json({
      success: true,
      active_locations: activeLocations,
      count: activeLocations.length,
      update_interval: weatherService.updateInterval
    });

  } catch (error) {
    console.error('Error getting active locations:', error);
    res.status(500).json({
      error: 'Failed to retrieve active locations',
      message: error.message
    });
  }
});

module.exports = router;