const express = require('express');
const router = express.Router();
const DatabaseService = require('../services/DatabaseService');

/**
 * GET /api/receptors
 * Get all receptors with optional filtering
 */
router.get('/', async (req, res) => {
  try {
    const { 
      receptor_type, 
      active = 'true', 
      bbox,
      limit = 100, 
      offset = 0 
    } = req.query;

    let query = `
      SELECT 
        id, name, receptor_type, height, sensitivity_level, population,
        ST_X(location) as longitude, ST_Y(location) as latitude,
        properties, active, created_at
      FROM receptors
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;

    // Add active filter
    if (active !== 'all') {
      paramCount++;
      query += ` AND active = $${paramCount}`;
      params.push(active === 'true');
    }

    // Add receptor type filter
    if (receptor_type) {
      paramCount++;
      query += ` AND receptor_type = $${paramCount}`;
      params.push(receptor_type);
    }

    // Add bounding box filter
    if (bbox) {
      const bounds = bbox.split(',').map(Number);
      if (bounds.length === 4) {
        paramCount++;
        query += ` AND ST_Intersects(location, ST_MakeEnvelope($${paramCount}, $${paramCount+1}, $${paramCount+2}, $${paramCount+3}, 4326))`;
        params.push(...bounds);
        paramCount += 3;
      }
    }

    query += ` ORDER BY created_at DESC`;
    
    // Add pagination
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));
    
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(parseInt(offset));

    const result = await DatabaseService.query(query, params);

    res.json({
      success: true,
      receptors: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Error getting receptors:', error);
    res.status(500).json({
      error: 'Failed to retrieve receptors',
      message: error.message
    });
  }
});

/**
 * POST /api/receptors
 * Create a new receptor
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      latitude,
      longitude,
      receptor_type,
      height,
      sensitivity_level,
      population,
      properties
    } = req.body;

    if (!name || !latitude || !longitude) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'latitude', 'longitude']
      });
    }

    const query = `
      INSERT INTO receptors (name, location, receptor_type, height, sensitivity_level, population, properties)
      VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5, $6, $7, $8)
      RETURNING id, name, receptor_type, ST_X(location) as longitude, ST_Y(location) as latitude
    `;

    const values = [
      name,
      parseFloat(longitude),
      parseFloat(latitude),
      receptor_type || 'general',
      height || 1.5, // Default breathing height
      sensitivity_level || 'medium',
      population || 1,
      properties ? JSON.stringify(properties) : null
    ];

    const result = await DatabaseService.query(query, values);

    res.status(201).json({
      success: true,
      receptor: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating receptor:', error);
    res.status(500).json({
      error: 'Failed to create receptor',
      message: error.message
    });
  }
});

/**
 * PUT /api/receptors/:id
 * Update a receptor
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      latitude,
      longitude,
      receptor_type,
      height,
      sensitivity_level,
      population,
      properties,
      active
    } = req.body;

    let query = `UPDATE receptors SET updated_at = CURRENT_TIMESTAMP`;
    const values = [id];
    let paramCount = 1;

    // Build dynamic update query
    if (name) {
      paramCount++;
      query += `, name = $${paramCount}`;
      values.push(name);
    }

    if (latitude && longitude) {
      paramCount += 2;
      query += `, location = ST_SetSRID(ST_MakePoint($${paramCount-1}, $${paramCount}), 4326)`;
      values.push(parseFloat(longitude), parseFloat(latitude));
    }

    if (receptor_type) {
      paramCount++;
      query += `, receptor_type = $${paramCount}`;
      values.push(receptor_type);
    }

    if (height !== undefined) {
      paramCount++;
      query += `, height = $${paramCount}`;
      values.push(height);
    }

    if (sensitivity_level) {
      paramCount++;
      query += `, sensitivity_level = $${paramCount}`;
      values.push(sensitivity_level);
    }

    if (population !== undefined) {
      paramCount++;
      query += `, population = $${paramCount}`;
      values.push(population);
    }

    if (properties) {
      paramCount++;
      query += `, properties = $${paramCount}`;
      values.push(JSON.stringify(properties));
    }

    if (active !== undefined) {
      paramCount++;
      query += `, active = $${paramCount}`;
      values.push(active);
    }

    query += ` WHERE id = $1 RETURNING id, name, receptor_type`;

    const result = await DatabaseService.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Receptor not found'
      });
    }

    res.json({
      success: true,
      receptor: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating receptor:', error);
    res.status(500).json({
      error: 'Failed to update receptor',
      message: error.message
    });
  }
});

/**
 * DELETE /api/receptors/:id
 * Delete a receptor
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = 'DELETE FROM receptors WHERE id = $1 RETURNING id, name';
    const result = await DatabaseService.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Receptor not found'
      });
    }

    res.json({
      success: true,
      message: 'Receptor deleted successfully',
      receptor: result.rows[0]
    });

  } catch (error) {
    console.error('Error deleting receptor:', error);
    res.status(500).json({
      error: 'Failed to delete receptor',
      message: error.message
    });
  }
});

/**
 * GET /api/receptors/types
 * Get available receptor types
 */
router.get('/types', (req, res) => {
  res.json({
    success: true,
    receptor_types: [
      { value: 'residential', label: 'Residential Area', description: 'Housing and residential zones' },
      { value: 'commercial', label: 'Commercial Area', description: 'Business and commercial zones' },
      { value: 'industrial', label: 'Industrial Area', description: 'Industrial facilities' },
      { value: 'school', label: 'Educational Institution', description: 'Schools and universities' },
      { value: 'hospital', label: 'Healthcare Facility', description: 'Hospitals and medical centers' },
      { value: 'recreation', label: 'Recreational Area', description: 'Parks and recreational facilities' },
      { value: 'sensitive', label: 'Sensitive Population', description: 'Areas with vulnerable populations' },
      { value: 'environmental', label: 'Environmental Receptor', description: 'Ecological sensitive areas' },
      { value: 'agricultural', label: 'Agricultural Area', description: 'Farms and agricultural land' },
      { value: 'general', label: 'General Population', description: 'General population area' }
    ]
  });
});

/**
 * GET /api/receptors/sensitivity-levels
 * Get available sensitivity levels
 */
router.get('/sensitivity-levels', (req, res) => {
  res.json({
    success: true,
    sensitivity_levels: [
      { value: 'low', label: 'Low Sensitivity', description: 'General adult population' },
      { value: 'medium', label: 'Medium Sensitivity', description: 'Mixed population' },
      { value: 'high', label: 'High Sensitivity', description: 'Children, elderly, or sensitive individuals' },
      { value: 'critical', label: 'Critical Sensitivity', description: 'Extremely vulnerable populations' }
    ]
  });
});

module.exports = router;