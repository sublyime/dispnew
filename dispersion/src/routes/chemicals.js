const express = require('express');
const router = express.Router();
const DatabaseService = require('../services/DatabaseService');
const CameoChemicalsService = require('../services/CameoChemicalsService');

// Initialize CAMEO service
const cameoService = new CameoChemicalsService();

/**
 * GET /api/chemicals
 * Get all chemicals with optional filtering
 */
router.get('/', async (req, res) => {
  try {
    const { 
      search, 
      physical_state, 
      volatility_class, 
      limit = 100, 
      offset = 0 
    } = req.query;

    let query = `
      SELECT 
        id, name, cas_number, molecular_weight, density, vapor_pressure,
        boiling_point, melting_point, solubility, henry_constant,
        diffusion_coefficient, volatility_class, physical_state,
        toxicity_data, safety_data, created_at, updated_at
      FROM chemicals
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;

    // Add search filter
    if (search) {
      paramCount++;
      query += ` AND (name ILIKE $${paramCount} OR cas_number ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Add physical state filter
    if (physical_state) {
      paramCount++;
      query += ` AND physical_state = $${paramCount}`;
      params.push(physical_state);
    }

    // Add volatility class filter
    if (volatility_class) {
      paramCount++;
      query += ` AND volatility_class = $${paramCount}`;
      params.push(volatility_class);
    }

    query += ` ORDER BY name`;
    
    // Add pagination
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));
    
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(parseInt(offset));

    const result = await DatabaseService.query(query, params);

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) FROM chemicals WHERE 1=1`;
    const countParams = [];
    let countParamCount = 0;

    if (search) {
      countParamCount++;
      countQuery += ` AND (name ILIKE $${countParamCount} OR cas_number ILIKE $${countParamCount})`;
      countParams.push(`%${search}%`);
    }

    if (physical_state) {
      countParamCount++;
      countQuery += ` AND physical_state = $${countParamCount}`;
      countParams.push(physical_state);
    }

    if (volatility_class) {
      countParamCount++;
      countQuery += ` AND volatility_class = $${countParamCount}`;
      countParams.push(volatility_class);
    }

    const countResult = await DatabaseService.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      chemicals: result.rows,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error getting chemicals:', error);
    res.status(500).json({
      error: 'Failed to retrieve chemicals',
      message: error.message
    });
  }
});

/**
 * GET /api/chemicals/:id
 * Get a specific chemical by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        id, name, cas_number, molecular_weight, density, vapor_pressure,
        boiling_point, melting_point, solubility, henry_constant,
        diffusion_coefficient, volatility_class, physical_state,
        toxicity_data, safety_data, created_at, updated_at
      FROM chemicals
      WHERE id = $1
    `;

    const result = await DatabaseService.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Chemical not found'
      });
    }

    res.json({
      success: true,
      chemical: result.rows[0]
    });

  } catch (error) {
    console.error('Error getting chemical:', error);
    res.status(500).json({
      error: 'Failed to retrieve chemical',
      message: error.message
    });
  }
});

/**
 * POST /api/chemicals
 * Create a new chemical
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      cas_number,
      molecular_weight,
      density,
      vapor_pressure,
      boiling_point,
      melting_point,
      solubility,
      henry_constant,
      diffusion_coefficient,
      volatility_class,
      physical_state,
      toxicity_data,
      safety_data
    } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'Chemical name is required'
      });
    }

    const query = `
      INSERT INTO chemicals (
        name, cas_number, molecular_weight, density, vapor_pressure,
        boiling_point, melting_point, solubility, henry_constant,
        diffusion_coefficient, volatility_class, physical_state,
        toxicity_data, safety_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, name, cas_number, created_at
    `;

    const values = [
      name,
      cas_number || null,
      molecular_weight || null,
      density || null,
      vapor_pressure || null,
      boiling_point || null,
      melting_point || null,
      solubility || null,
      henry_constant || null,
      diffusion_coefficient || null,
      volatility_class || null,
      physical_state || null,
      toxicity_data ? JSON.stringify(toxicity_data) : null,
      safety_data ? JSON.stringify(safety_data) : null
    ];

    const result = await DatabaseService.query(query, values);

    res.status(201).json({
      success: true,
      chemical: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating chemical:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        error: 'Chemical with this name already exists'
      });
    }

    res.status(500).json({
      error: 'Failed to create chemical',
      message: error.message
    });
  }
});

/**
 * PUT /api/chemicals/:id
 * Update a chemical
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      cas_number,
      molecular_weight,
      density,
      vapor_pressure,
      boiling_point,
      melting_point,
      solubility,
      henry_constant,
      diffusion_coefficient,
      volatility_class,
      physical_state,
      toxicity_data,
      safety_data
    } = req.body;

    const query = `
      UPDATE chemicals SET
        name = COALESCE($2, name),
        cas_number = COALESCE($3, cas_number),
        molecular_weight = COALESCE($4, molecular_weight),
        density = COALESCE($5, density),
        vapor_pressure = COALESCE($6, vapor_pressure),
        boiling_point = COALESCE($7, boiling_point),
        melting_point = COALESCE($8, melting_point),
        solubility = COALESCE($9, solubility),
        henry_constant = COALESCE($10, henry_constant),
        diffusion_coefficient = COALESCE($11, diffusion_coefficient),
        volatility_class = COALESCE($12, volatility_class),
        physical_state = COALESCE($13, physical_state),
        toxicity_data = COALESCE($14, toxicity_data),
        safety_data = COALESCE($15, safety_data),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, name, cas_number, updated_at
    `;

    const values = [
      id,
      name,
      cas_number,
      molecular_weight,
      density,
      vapor_pressure,
      boiling_point,
      melting_point,
      solubility,
      henry_constant,
      diffusion_coefficient,
      volatility_class,
      physical_state,
      toxicity_data ? JSON.stringify(toxicity_data) : null,
      safety_data ? JSON.stringify(safety_data) : null
    ];

    const result = await DatabaseService.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Chemical not found'
      });
    }

    res.json({
      success: true,
      chemical: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating chemical:', error);
    res.status(500).json({
      error: 'Failed to update chemical',
      message: error.message
    });
  }
});

/**
 * DELETE /api/chemicals/:id
 * Delete a chemical
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if chemical is used in any release events
    const usageCheck = await DatabaseService.query(
      'SELECT COUNT(*) FROM release_events WHERE chemical_id = $1',
      [id]
    );

    if (parseInt(usageCheck.rows[0].count) > 0) {
      return res.status(409).json({
        error: 'Cannot delete chemical',
        message: 'Chemical is referenced in existing release events'
      });
    }

    const query = 'DELETE FROM chemicals WHERE id = $1 RETURNING id, name';
    const result = await DatabaseService.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Chemical not found'
      });
    }

    res.json({
      success: true,
      message: 'Chemical deleted successfully',
      chemical: result.rows[0]
    });

  } catch (error) {
    console.error('Error deleting chemical:', error);
    res.status(500).json({
      error: 'Failed to delete chemical',
      message: error.message
    });
  }
});

/**
 * GET /api/chemicals/search/suggestions
 * Get chemical name suggestions for autocomplete
 */
router.get('/search/suggestions', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.json({
        success: true,
        suggestions: []
      });
    }

    const query = `
      SELECT id, name, cas_number, physical_state
      FROM chemicals
      WHERE name ILIKE $1 OR cas_number ILIKE $1
      ORDER BY 
        CASE WHEN name ILIKE $2 THEN 1 ELSE 2 END,
        LENGTH(name)
      LIMIT $3
    `;

    const result = await DatabaseService.query(query, [
      `%${q}%`,
      `${q}%`,
      parseInt(limit)
    ]);

    res.json({
      success: true,
      suggestions: result.rows
    });

  } catch (error) {
    console.error('Error getting chemical suggestions:', error);
    res.status(500).json({
      error: 'Failed to get suggestions',
      message: error.message
    });
  }
});

/**
 * POST /api/chemicals/bulk
 * Bulk import chemicals from a list
 */
router.post('/bulk', async (req, res) => {
  try {
    const { chemicals } = req.body;

    if (!Array.isArray(chemicals) || chemicals.length === 0) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Expected an array of chemicals'
      });
    }

    const results = {
      success: [],
      errors: [],
      total: chemicals.length
    };

    // Process each chemical in a transaction
    await DatabaseService.transaction(async (client) => {
      for (let i = 0; i < chemicals.length; i++) {
        const chemical = chemicals[i];
        
        try {
          if (!chemical.name) {
            results.errors.push({
              index: i,
              chemical: chemical,
              error: 'Chemical name is required'
            });
            continue;
          }

          const query = `
            INSERT INTO chemicals (
              name, cas_number, molecular_weight, density, vapor_pressure,
              boiling_point, melting_point, solubility, henry_constant,
              diffusion_coefficient, volatility_class, physical_state,
              toxicity_data, safety_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (name) DO UPDATE SET
              cas_number = EXCLUDED.cas_number,
              molecular_weight = EXCLUDED.molecular_weight,
              density = EXCLUDED.density,
              vapor_pressure = EXCLUDED.vapor_pressure,
              boiling_point = EXCLUDED.boiling_point,
              melting_point = EXCLUDED.melting_point,
              solubility = EXCLUDED.solubility,
              henry_constant = EXCLUDED.henry_constant,
              diffusion_coefficient = EXCLUDED.diffusion_coefficient,
              volatility_class = EXCLUDED.volatility_class,
              physical_state = EXCLUDED.physical_state,
              toxicity_data = EXCLUDED.toxicity_data,
              safety_data = EXCLUDED.safety_data,
              updated_at = CURRENT_TIMESTAMP
            RETURNING id, name
          `;

          const values = [
            chemical.name,
            chemical.cas_number || null,
            chemical.molecular_weight || null,
            chemical.density || null,
            chemical.vapor_pressure || null,
            chemical.boiling_point || null,
            chemical.melting_point || null,
            chemical.solubility || null,
            chemical.henry_constant || null,
            chemical.diffusion_coefficient || null,
            chemical.volatility_class || null,
            chemical.physical_state || null,
            chemical.toxicity_data ? JSON.stringify(chemical.toxicity_data) : null,
            chemical.safety_data ? JSON.stringify(chemical.safety_data) : null
          ];

          const result = await client.query(query, values);
          results.success.push({
            index: i,
            chemical: result.rows[0]
          });

        } catch (error) {
          results.errors.push({
            index: i,
            chemical: chemical,
            error: error.message
          });
        }
      }
    });

    res.status(207).json({
      success: true,
      results: results,
      summary: {
        total: results.total,
        successful: results.success.length,
        failed: results.errors.length
      }
    });

  } catch (error) {
    console.error('Error bulk importing chemicals:', error);
    res.status(500).json({
      error: 'Failed to import chemicals',
      message: error.message
    });
  }
});

/**
 * GET /api/chemicals/properties/volatility-classes
 * Get available volatility classes
 */
router.get('/properties/volatility-classes', (req, res) => {
  res.json({
    success: true,
    volatility_classes: [
      { value: 'low', label: 'Low Volatility', description: 'Vapor pressure < 0.1 mmHg at 20°C' },
      { value: 'medium', label: 'Medium Volatility', description: 'Vapor pressure 0.1-10 mmHg at 20°C' },
      { value: 'high', label: 'High Volatility', description: 'Vapor pressure > 10 mmHg at 20°C' }
    ]
  });
});

/**
 * GET /api/chemicals/properties/physical-states
 * Get available physical states
 */
router.get('/properties/physical-states', (req, res) => {
  res.json({
    success: true,
    physical_states: [
      { value: 'gas', label: 'Gas' },
      { value: 'liquid', label: 'Liquid' },
      { value: 'solid', label: 'Solid' },
      { value: 'plasma', label: 'Plasma' }
    ]
  });
});

/**
 * GET /api/chemicals/cameo/search
 * Search chemicals in CAMEO database
 */
router.get('/cameo/search', async (req, res) => {
  try {
    const { q: query, limit = 20 } = req.query;
    
    if (!query) {
      return res.status(400).json({
        error: 'Search query is required',
        message: 'Please provide a search query (q parameter)'
      });
    }

    const results = await cameoService.searchChemicals(query, parseInt(limit));
    
    res.json({
      success: true,
      query,
      count: results.length,
      chemicals: results
    });

  } catch (error) {
    console.error('CAMEO search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
});

/**
 * GET /api/chemicals/cameo/:identifier
 * Get detailed chemical properties from CAMEO by identifier
 */
router.get('/cameo/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    const properties = await cameoService.getChemicalProperties(identifier);
    
    if (!properties) {
      return res.status(404).json({
        error: 'Chemical not found in CAMEO database',
        message: `No chemical found with identifier: ${identifier}`
      });
    }

    res.json({
      success: true,
      chemical: properties
    });

  } catch (error) {
    console.error('CAMEO properties error:', error);
    res.status(500).json({
      error: 'Failed to get chemical properties from CAMEO',
      message: error.message
    });
  }
});

/**
 * GET /api/chemicals/recommendations/:scenario
 * Get chemical recommendations for specific release scenarios
 */
router.get('/recommendations/:scenario', async (req, res) => {
  try {
    const { scenario } = req.params;
    const { hazard_level = 'medium' } = req.query;
    
    const recommendations = await cameoService.getRecommendationsForScenario(
      scenario, 
      hazard_level
    );
    
    res.json({
      success: true,
      scenario,
      hazard_level,
      count: recommendations.length,
      recommendations
    });

  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({
      error: 'Failed to get recommendations',
      message: error.message
    });
  }
});

/**
 * POST /api/chemicals/validate
 * Validate chemical data completeness for dispersion modeling
 */
router.post('/validate', async (req, res) => {
  try {
    const { chemical_id } = req.body;
    
    if (!chemical_id) {
      return res.status(400).json({
        error: 'Chemical ID is required',
        message: 'Please provide a chemical_id in the request body'
      });
    }

    const properties = await cameoService.getChemicalProperties(chemical_id);
    
    if (!properties) {
      return res.status(404).json({
        error: 'Chemical not found',
        message: `No chemical found with ID: ${chemical_id}`
      });
    }

    // Validate data completeness for dispersion modeling
    const validation = validateChemicalForDispersion(properties);
    
    res.json({
      success: true,
      chemical: properties,
      validation
    });

  } catch (error) {
    console.error('Chemical validation error:', error);
    res.status(500).json({
      error: 'Validation failed',
      message: error.message
    });
  }
});

/**
 * Validate chemical data completeness for dispersion modeling
 */
function validateChemicalForDispersion(properties) {
  const requiredFields = {
    'molecular_weight': 'Required for heavy gas determination',
    'vapor_pressure': 'Required for evaporation rate calculations',
    'boiling_point': 'Required for phase change calculations',
    'density': 'Required for heavy gas modeling',
    'physical_state': 'Required for source term modeling'
  };

  const optionalFields = {
    'heat_of_vaporization': 'Improves evaporation rate accuracy',
    'critical_temperature': 'Improves equation of state calculations',
    'critical_pressure': 'Improves equation of state calculations',
    'solubility_water': 'Required for wet deposition modeling',
    'henry_constant': 'Required for air-water partitioning'
  };

  const safetyFields = {
    'idlh': 'Required for threat zone calculations',
    'twa': 'Required for occupational exposure assessment',
    'lc50': 'Required for toxicity modeling'
  };

  const validation = {
    is_complete: true,
    missing_required: [],
    missing_optional: [],
    missing_safety: [],
    quality_score: properties.quality_score || 0,
    dispersion_ready: false
  };

  // Check required fields
  Object.keys(requiredFields).forEach(field => {
    if (!properties[field] || properties[field] === null) {
      validation.missing_required.push({
        field,
        description: requiredFields[field]
      });
      validation.is_complete = false;
    }
  });

  // Check optional fields
  Object.keys(optionalFields).forEach(field => {
    if (!properties[field] || properties[field] === null) {
      validation.missing_optional.push({
        field,
        description: optionalFields[field]
      });
    }
  });

  // Check safety fields
  Object.keys(safetyFields).forEach(field => {
    if (!properties[field] || properties[field] === null) {
      validation.missing_safety.push({
        field,
        description: safetyFields[field]
      });
    }
  });

  // Determine if ready for dispersion modeling
  validation.dispersion_ready = validation.missing_required.length === 0;

  return validation;
}

module.exports = router;