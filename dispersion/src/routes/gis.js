const express = require('express');
const router = express.Router();
const multer = require('multer');
const DatabaseService = require('../services/DatabaseService');
const GISService = require('../services/GISService');

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/x-shapefile',
      'application/zip',
      'application/vnd.google-earth.kml+xml',
      'application/vnd.google-earth.kmz',
      'image/tiff',
      'application/geo+json',
      'text/plain'
    ];
    
    const allowedExtensions = ['.shp', '.zip', '.kml', '.kmz', '.tif', '.tiff', '.geojson', '.json'];
    
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Supported formats: Shapefile, KML/KMZ, GeoTIFF, GeoJSON'));
    }
  }
});

/**
 * POST /api/gis/upload
 * Upload and process GIS files
 */
router.post('/upload', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        error: 'No files uploaded'
      });
    }

    const { dataType } = req.body;
    
    if (!dataType || !['buildings', 'topography', 'boundaries'].includes(dataType)) {
      return res.status(400).json({
        error: 'Invalid dataType. Must be one of: buildings, topography, boundaries'
      });
    }

    // Process the uploaded files
    const gisService = new GISService();
    let totalFeatures = 0;
    const processedFiles = [];

    for (const file of req.files) {
      try {
        const processingResult = await gisService.processGISFile(file, dataType, `Uploaded via web interface - ${file.originalname}`);
        totalFeatures += processingResult.featuresCount || 0;
        processedFiles.push({
          filename: file.originalname,
          status: 'success',
          features: processingResult.featuresCount || 0
        });
      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        processedFiles.push({
          filename: file.originalname,
          status: 'error',
          error: fileError.message
        });
      }
    }

    res.json({
      success: true,
      message: `Processed ${req.files.length} files`,
      featuresCount: totalFeatures,
      processedFiles: processedFiles,
      dataType: dataType
    });

  } catch (error) {
    console.error('Error uploading GIS files:', error);
    res.status(500).json({
      error: 'Failed to upload GIS files',
      message: error.message
    });
  }
});

/**
 * GET /api/gis/imports
 * Get GIS import history
 */
router.get('/imports', async (req, res) => {
  try {
    const { status, import_type, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        id, filename, file_type, import_type, geometry_type,
        features_count, projection, status, error_message,
        metadata, created_at
      FROM gis_imports
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    if (import_type) {
      paramCount++;
      query += ` AND import_type = $${paramCount}`;
      params.push(import_type);
    }

    query += ` ORDER BY created_at DESC`;
    
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));
    
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(parseInt(offset));

    const result = await DatabaseService.query(query, params);

    res.json({
      success: true,
      imports: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Error getting GIS imports:', error);
    res.status(500).json({
      error: 'Failed to retrieve GIS imports',
      message: error.message
    });
  }
});

/**
 * GET /api/gis/imports/:id/status
 * Get import status for a specific import
 */
router.get('/imports/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        id, filename, file_type, import_type, status,
        features_count, error_message, created_at
      FROM gis_imports
      WHERE id = $1
    `;

    const result = await DatabaseService.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Import not found'
      });
    }

    res.json({
      success: true,
      import_status: result.rows[0]
    });

  } catch (error) {
    console.error('Error getting import status:', error);
    res.status(500).json({
      error: 'Failed to get import status',
      message: error.message
    });
  }
});

/**
 * GET /api/gis/buildings
 * Get buildings within a bounding box
 */
router.get('/buildings', async (req, res) => {
  try {
    const { bbox, limit = 1000 } = req.query;

    if (!bbox) {
      return res.status(400).json({
        error: 'Bounding box (bbox) parameter is required'
      });
    }

    const bounds = bbox.split(',').map(Number);
    if (bounds.length !== 4) {
      return res.status(400).json({
        error: 'Invalid bounding box format. Expected: minLon,minLat,maxLon,maxLat'
      });
    }

    const query = `
      SELECT 
        id, 
        ST_AsGeoJSON(geometry) as geometry,
        height, building_type, stories, roof_type, material,
        occupancy, properties, created_at
      FROM buildings
      WHERE ST_Intersects(geometry, ST_MakeEnvelope($1, $2, $3, $4, 4326))
      LIMIT $5
    `;

    const result = await DatabaseService.query(query, [...bounds, parseInt(limit)]);

    // Convert to GeoJSON format
    const features = result.rows.map(row => ({
      type: 'Feature',
      id: row.id,
      geometry: JSON.parse(row.geometry),
      properties: {
        height: row.height,
        building_type: row.building_type,
        stories: row.stories,
        roof_type: row.roof_type,
        material: row.material,
        occupancy: row.occupancy,
        created_at: row.created_at,
        ...row.properties
      }
    }));

    res.json({
      success: true,
      type: 'FeatureCollection',
      features: features,
      count: features.length
    });

  } catch (error) {
    console.error('Error getting buildings:', error);
    res.status(500).json({
      error: 'Failed to retrieve buildings',
      message: error.message
    });
  }
});

/**
 * GET /api/gis/topography
 * Get topography data within a bounding box
 */
router.get('/topography', async (req, res) => {
  try {
    const { bbox, limit = 1000 } = req.query;

    if (!bbox) {
      return res.status(400).json({
        error: 'Bounding box (bbox) parameter is required'
      });
    }

    const bounds = bbox.split(',').map(Number);
    if (bounds.length !== 4) {
      return res.status(400).json({
        error: 'Invalid bounding box format. Expected: minLon,minLat,maxLon,maxLat'
      });
    }

    const query = `
      SELECT 
        id,
        ST_AsGeoJSON(geometry) as geometry,
        elevation, slope, aspect, land_use, roughness_length,
        properties, created_at
      FROM topography
      WHERE ST_Intersects(geometry, ST_MakeEnvelope($1, $2, $3, $4, 4326))
      LIMIT $5
    `;

    const result = await DatabaseService.query(query, [...bounds, parseInt(limit)]);

    // Convert to GeoJSON format
    const features = result.rows.map(row => ({
      type: 'Feature',
      id: row.id,
      geometry: JSON.parse(row.geometry),
      properties: {
        elevation: row.elevation,
        slope: row.slope,
        aspect: row.aspect,
        land_use: row.land_use,
        roughness_length: row.roughness_length,
        created_at: row.created_at,
        ...row.properties
      }
    }));

    res.json({
      success: true,
      type: 'FeatureCollection',
      features: features,
      count: features.length
    });

  } catch (error) {
    console.error('Error getting topography:', error);
    res.status(500).json({
      error: 'Failed to retrieve topography',
      message: error.message
    });
  }
});

/**
 * POST /api/gis/buildings
 * Create a new building
 */
router.post('/buildings', async (req, res) => {
  try {
    const {
      geometry,
      height,
      building_type,
      stories,
      roof_type,
      material,
      occupancy,
      properties
    } = req.body;

    if (!geometry || !geometry.coordinates) {
      return res.status(400).json({
        error: 'Valid geometry is required'
      });
    }

    const query = `
      INSERT INTO buildings (
        geometry, height, building_type, stories, 
        roof_type, material, occupancy, properties
      )
      VALUES (
        ST_GeomFromGeoJSON($1), $2, $3, $4, $5, $6, $7, $8
      )
      RETURNING id, height, building_type, created_at
    `;

    const values = [
      JSON.stringify(geometry),
      height || null,
      building_type || 'unknown',
      stories || null,
      roof_type || null,
      material || null,
      occupancy || null,
      properties ? JSON.stringify(properties) : null
    ];

    const result = await DatabaseService.query(query, values);

    res.status(201).json({
      success: true,
      building: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating building:', error);
    res.status(500).json({
      error: 'Failed to create building',
      message: error.message
    });
  }
});

/**
 * DELETE /api/gis/imports/:id
 * Delete an import and its associated data
 */
router.delete('/imports/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await DatabaseService.transaction(async (client) => {
      // Get import info first
      const importResult = await client.query(
        'SELECT import_type FROM gis_imports WHERE id = $1',
        [id]
      );

      if (importResult.rows.length === 0) {
        throw new Error('Import not found');
      }

      const importType = importResult.rows[0].import_type;

      // Delete associated data based on import type
      if (importType === 'buildings') {
        await client.query(
          'DELETE FROM buildings WHERE id IN (SELECT unnest(string_to_array(metadata->>\'feature_ids\', \',\'))::int) FROM gis_imports WHERE id = $1)',
          [id]
        );
      } else if (importType === 'topography') {
        await client.query(
          'DELETE FROM topography WHERE id IN (SELECT unnest(string_to_array(metadata->>\'feature_ids\', \',\'))::int) FROM gis_imports WHERE id = $1)',
          [id]
        );
      }

      // Delete the import record
      await client.query('DELETE FROM gis_imports WHERE id = $1', [id]);
    });

    res.json({
      success: true,
      message: 'Import and associated data deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting import:', error);
    res.status(500).json({
      error: 'Failed to delete import',
      message: error.message
    });
  }
});

/**
 * GET /api/gis/supported-formats
 * Get list of supported GIS file formats
 */
router.get('/supported-formats', (req, res) => {
  res.json({
    success: true,
    supported_formats: [
      {
        format: 'Shapefile',
        extensions: ['.shp', '.zip'],
        description: 'ESRI Shapefile format, upload as ZIP containing .shp, .shx, .dbf files',
        supports: ['buildings', 'topography', 'boundaries']
      },
      {
        format: 'KML/KMZ',
        extensions: ['.kml', '.kmz'],
        description: 'Google Earth format for geographic data',
        supports: ['buildings', 'boundaries']
      },
      {
        format: 'GeoJSON',
        extensions: ['.geojson', '.json'],
        description: 'JSON-based geographic data format',
        supports: ['buildings', 'topography', 'boundaries']
      },
      {
        format: 'GeoTIFF',
        extensions: ['.tif', '.tiff'],
        description: 'Raster format for elevation and imagery data',
        supports: ['topography']
      }
    ]
  });
});

module.exports = router;