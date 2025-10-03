const express = require('express');
const router = express.Router();
const DatabaseService = require('../services/DatabaseService');
const DispersionService = require('../services/DispersionService');

// We'll need to get the WebSocket server instance from the main app
// For now, we'll create a placeholder that will be set by the main server
let dispersionService = null;

// Function to set the dispersion service instance
router.setDispersionService = (service) => {
  dispersionService = service;
};

/**
 * GET /api/dispersion/active
 * Get all active dispersion calculations
 */
router.get('/active', async (req, res) => {
  try {
    const query = `
      SELECT dc.*, re.chemical_id, c.name as chemical_name
      FROM dispersion_calculations dc
      JOIN release_events re ON dc.release_event_id = re.id
      JOIN chemicals c ON re.chemical_id = c.id
      WHERE re.status = 'active'
      ORDER BY dc.calculation_time DESC
    `;
    
    const result = await DatabaseService.query(query);
    res.json({ calculations: result.rows });
  } catch (error) {
    console.error('Error getting active dispersions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/dispersion/release
 * Create a new chemical release event and start dispersion modeling
 */
router.post('/release', async (req, res) => {
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
    } = req.body;

    // Validate required fields
    if (!latitude || !longitude || !chemical_id || !release_type) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['latitude', 'longitude', 'chemical_id', 'release_type']
      });
    }

    // Validate coordinates
    if (isNaN(latitude) || isNaN(longitude) || 
        latitude < -90 || latitude > 90 || 
        longitude < -180 || longitude > 180) {
      return res.status(400).json({
        error: 'Invalid coordinates'
      });
    }

    if (!dispersionService) {
      return res.status(500).json({
        error: 'Dispersion service not available'
      });
    }

    // Create release event and start modeling
    const result = await dispersionService.createReleaseEvent({
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      chemical_id: parseInt(chemical_id),
      release_type,
      release_rate: release_rate ? parseFloat(release_rate) : null,
      total_mass: total_mass ? parseFloat(total_mass) : null,
      release_height: release_height ? parseFloat(release_height) : 1.0,
      temperature: temperature ? parseFloat(temperature) : null,
      duration: duration ? parseFloat(duration) : null,
      created_by: created_by || 'api_user'
    });

    res.status(201).json({
      success: true,
      release_event: result
    });

  } catch (error) {
    console.error('Error creating release event:', error);
    res.status(500).json({
      error: 'Failed to create release event',
      message: error.message
    });
  }
});

/**
 * GET /api/dispersion/releases
 * Get list of release events
 */
router.get('/releases', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0, bbox, start_date, end_date } = req.query;

    let query = `
      SELECT 
        re.id, re.release_type, re.release_rate, re.total_mass,
        re.release_height, re.temperature, re.duration,
        re.start_time, re.end_time, re.status, re.created_by, re.created_at,
        ST_X(re.location) as longitude, ST_Y(re.location) as latitude,
        c.name as chemical_name, c.cas_number, c.physical_state,
        re.weather_conditions,
        COUNT(dc.id) as calculation_count,
        MAX(dc.calculation_time) as last_calculation
      FROM release_events re
      JOIN chemicals c ON re.chemical_id = c.id
      LEFT JOIN dispersion_calculations dc ON re.id = dc.release_event_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;

    // Add status filter
    if (status) {
      paramCount++;
      query += ` AND re.status = $${paramCount}`;
      params.push(status);
    }

    // Add date range filter
    if (start_date) {
      paramCount++;
      query += ` AND re.start_time >= $${paramCount}`;
      params.push(start_date);
    }

    if (end_date) {
      paramCount++;
      query += ` AND re.start_time <= $${paramCount}`;
      params.push(end_date);
    }

    // Add bounding box filter
    if (bbox) {
      const bounds = bbox.split(',').map(Number);
      if (bounds.length === 4) {
        paramCount++;
        query += ` AND ST_Intersects(re.location, ST_MakeEnvelope($${paramCount}, $${paramCount+1}, $${paramCount+2}, $${paramCount+3}, 4326))`;
        params.push(...bounds);
        paramCount += 3;
      }
    }

    query += ` GROUP BY re.id, c.name, c.cas_number, c.physical_state`;
    query += ` ORDER BY re.created_at DESC`;
    query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await DatabaseService.query(query, params);
    
    // Parse weather conditions
    const releases = result.rows.map(row => ({
      ...row,
      weather_conditions: typeof row.weather_conditions === 'string' 
        ? JSON.parse(row.weather_conditions) 
        : row.weather_conditions
    }));

    res.json({
      success: true,
      releases,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: releases.length
      }
    });

  } catch (error) {
    console.error('Error getting release events:', error);
    res.status(500).json({ 
      error: 'Failed to get release events',
      message: error.message 
    });
  }
});

/**
 * GET /api/dispersion/releases/:id/calculations
 * Get all dispersion calculations for a specific release
 */
router.get('/releases/:id/calculations', async (req, res) => {
  try {
    const releaseId = parseInt(req.params.id);
    
    const query = `
      SELECT 
        dc.*,
        re.weather_conditions,
        c.name as chemical_name
      FROM dispersion_calculations dc
      JOIN release_events re ON dc.release_event_id = re.id
      JOIN chemicals c ON re.chemical_id = c.id
      WHERE dc.release_event_id = $1
      ORDER BY dc.calculation_time DESC
    `;
    
    const result = await DatabaseService.query(query, [releaseId]);
    
    const calculations = result.rows.map(row => ({
      ...row,
      meteorological_conditions: typeof row.meteorological_conditions === 'string'
        ? JSON.parse(row.meteorological_conditions)
        : row.meteorological_conditions,
      model_parameters: typeof row.model_parameters === 'string'
        ? JSON.parse(row.model_parameters)
        : row.model_parameters,
      receptor_impacts: typeof row.receptor_impacts === 'string'
        ? JSON.parse(row.receptor_impacts)
        : row.receptor_impacts
    }));

    res.json({
      success: true,
      calculations
    });

  } catch (error) {
    console.error('Error getting release calculations:', error);
    res.status(500).json({ 
      error: 'Failed to get release calculations',
      message: error.message 
    });
  }
});

/**
 * GET /api/dispersion/releases/:id
 * Get specific release event details
 */
router.get('/releases/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        re.id, re.release_type, re.release_rate, re.total_mass,
        re.release_height, re.temperature, re.duration,
        re.start_time, re.end_time, re.status, re.created_by, re.created_at,
        ST_X(re.location) as longitude, ST_Y(re.location) as latitude,
        c.name as chemical_name, c.cas_number, c.physical_state,
        c.molecular_weight, c.density, c.vapor_pressure,
        re.weather_conditions
      FROM release_events re
      JOIN chemicals c ON re.chemical_id = c.id
      WHERE re.id = $1
    `;

    const result = await DatabaseService.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Release event not found'
      });
    }

    res.json({
      success: true,
      release: result.rows[0]
    });

  } catch (error) {
    console.error('Error getting release event:', error);
    res.status(500).json({
      error: 'Failed to retrieve release event',
      message: error.message
    });
  }
});

/**
 * GET /api/dispersion/releases/:id/calculations
 * Get dispersion calculations for a release event
 */
router.get('/releases/:id/calculations', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const query = `
      SELECT 
        id, calculation_time, 
        ST_AsGeoJSON(plume_geometry) as plume_geometry,
        max_concentration, affected_area, calculation_method,
        meteorological_conditions, model_parameters, receptor_impacts
      FROM dispersion_calculations
      WHERE release_event_id = $1
      ORDER BY calculation_time DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await DatabaseService.query(query, [id, parseInt(limit), parseInt(offset)]);

    // Parse JSON fields
    const calculations = result.rows.map(row => ({
      ...row,
      plume_geometry: JSON.parse(row.plume_geometry),
      meteorological_conditions: row.meteorological_conditions,
      model_parameters: row.model_parameters,
      receptor_impacts: row.receptor_impacts
    }));

    res.json({
      success: true,
      calculations: calculations,
      count: calculations.length
    });

  } catch (error) {
    console.error('Error getting dispersion calculations:', error);
    res.status(500).json({
      error: 'Failed to retrieve calculations',
      message: error.message
    });
  }
});

/**
 * GET /api/dispersion/releases/:id/latest
 * Get latest dispersion calculation for a release event
 */
router.get('/releases/:id/latest', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        id, calculation_time, 
        ST_AsGeoJSON(plume_geometry) as plume_geometry,
        max_concentration, affected_area, calculation_method,
        meteorological_conditions, model_parameters, receptor_impacts
      FROM dispersion_calculations
      WHERE release_event_id = $1
      ORDER BY calculation_time DESC
      LIMIT 1
    `;

    const result = await DatabaseService.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No calculations found for this release event'
      });
    }

    const calculation = {
      ...result.rows[0],
      plume_geometry: JSON.parse(result.rows[0].plume_geometry),
      meteorological_conditions: result.rows[0].meteorological_conditions,
      model_parameters: result.rows[0].model_parameters,
      receptor_impacts: result.rows[0].receptor_impacts
    };

    res.json({
      success: true,
      calculation: calculation
    });

  } catch (error) {
    console.error('Error getting latest calculation:', error);
    res.status(500).json({
      error: 'Failed to retrieve latest calculation',
      message: error.message
    });
  }
});

/**
 * GET /api/dispersion/releases/:id/impacts
 * Get receptor impacts for a release event
 */
router.get('/releases/:id/impacts', async (req, res) => {
  try {
    const { id } = req.params;
    const { calculation_id } = req.query;

    let query = `
      SELECT 
        ri.id, ri.concentration, ri.dose, ri.exposure_time,
        ri.health_impact_level, ri.calculated_at,
        r.id as receptor_id, r.name as receptor_name, r.receptor_type,
        r.sensitivity_level, r.population,
        ST_X(r.location) as longitude, ST_Y(r.location) as latitude,
        dc.calculation_time
      FROM receptor_impacts ri
      JOIN receptors r ON ri.receptor_id = r.id
      JOIN dispersion_calculations dc ON ri.dispersion_calculation_id = dc.id
      WHERE dc.release_event_id = $1
    `;

    const params = [id];

    if (calculation_id) {
      query += ` AND ri.dispersion_calculation_id = $2`;
      params.push(calculation_id);
    }

    query += ` ORDER BY ri.concentration DESC`;

    const result = await DatabaseService.query(query, params);

    res.json({
      success: true,
      impacts: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Error getting receptor impacts:', error);
    res.status(500).json({
      error: 'Failed to retrieve receptor impacts',
      message: error.message
    });
  }
});

/**
 * PUT /api/dispersion/releases/:id/status
 * Update release event status
 */
router.put('/releases/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'paused', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be one of: active, paused, completed, cancelled'
      });
    }

    const updateData = { status };
    
    // Set end time for completed or cancelled releases
    if (status === 'completed' || status === 'cancelled') {
      updateData.end_time = new Date();
    }

    const query = `
      UPDATE release_events 
      SET status = $1, end_time = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, status, end_time
    `;

    const result = await DatabaseService.query(query, [
      status,
      updateData.end_time || null,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Release event not found'
      });
    }

    // Stop monitoring if completed or cancelled
    if ((status === 'completed' || status === 'cancelled') && dispersionService) {
      dispersionService.stopReleaseMonitoring(parseInt(id));
    }

    res.json({
      success: true,
      release: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating release status:', error);
    res.status(500).json({
      error: 'Failed to update release status',
      message: error.message
    });
  }
});

/**
 * POST /api/dispersion/releases/:id/recalculate
 * Force recalculation of dispersion for a release event
 */
router.post('/releases/:id/recalculate', async (req, res) => {
  try {
    const { id } = req.params;

    if (!dispersionService) {
      return res.status(500).json({
        error: 'Dispersion service not available'
      });
    }

    // Get release event details
    const releaseQuery = `
      SELECT 
        re.*, c.*,
        ST_X(re.location) as longitude, ST_Y(re.location) as latitude
      FROM release_events re
      JOIN chemicals c ON re.chemical_id = c.id
      WHERE re.id = $1 AND re.status = 'active'
    `;

    const releaseResult = await DatabaseService.query(releaseQuery, [id]);

    if (releaseResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Active release event not found'
      });
    }

    const releaseEvent = releaseResult.rows[0];

    // Get latest weather data
    const WeatherService = require('../services/WeatherService');
    const weatherService = new WeatherService();
    const weatherData = await weatherService.getLatestWeatherData(
      releaseEvent.latitude,
      releaseEvent.longitude
    );

    // Perform new calculation
    const calculation = await dispersionService.calculateDispersion(
      parseInt(id),
      weatherData,
      releaseEvent
    );

    res.json({
      success: true,
      message: 'Recalculation completed',
      calculation: calculation
    });

  } catch (error) {
    console.error('Error recalculating dispersion:', error);
    res.status(500).json({
      error: 'Failed to recalculate dispersion',
      message: error.message
    });
  }
});

/**
 * GET /api/dispersion/active
 * Get all active dispersion calculations
 */
router.get('/active', (req, res) => {
  try {
    if (!dispersionService) {
      return res.status(500).json({
        error: 'Dispersion service not available'
      });
    }

    const activeCalculations = Array.from(dispersionService.activeCalculations.keys());

    res.json({
      success: true,
      active_releases: activeCalculations,
      count: activeCalculations.length,
      update_interval: dispersionService.updateInterval
    });

  } catch (error) {
    console.error('Error getting active calculations:', error);
    res.status(500).json({
      error: 'Failed to get active calculations',
      message: error.message
    });
  }
});

/**
 * GET /api/dispersion/release-types
 * Get available release types
 */
router.get('/release-types', (req, res) => {
  res.json({
    success: true,
    release_types: [
      { 
        value: 'instantaneous', 
        label: 'Instantaneous Release', 
        description: 'Single point release of chemical' 
      },
      { 
        value: 'continuous', 
        label: 'Continuous Release', 
        description: 'Ongoing release at steady rate' 
      },
      { 
        value: 'fire', 
        label: 'Fire/Explosion', 
        description: 'Release due to fire or explosion' 
      },
      { 
        value: 'spill', 
        label: 'Liquid Spill', 
        description: 'Liquid chemical spill on ground' 
      },
      { 
        value: 'leak', 
        label: 'Equipment Leak', 
        description: 'Leak from equipment or pipeline' 
      },
      { 
        value: 'evaporation', 
        label: 'Evaporation', 
        description: 'Evaporation from liquid pool' 
      }
    ]
  });
});

module.exports = router;