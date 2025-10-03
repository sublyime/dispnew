const fs = require('fs');
const path = require('path');
const DatabaseService = require('./DatabaseService');

class GISService {
  constructor() {
    this.uploadDir = 'uploads';
    this.supportedFormats = ['.shp', '.zip', '.kml', '.kmz', '.tif', '.tiff', '.geojson', '.json'];
  }

  /**
   * Process uploaded GIS file
   */
  async processGISFile(file, importType, description) {
    try {
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      if (!this.supportedFormats.includes(fileExtension)) {
        throw new Error(`Unsupported file format: ${fileExtension}`);
      }

      // Create import record
      const importId = await this.createImportRecord(file, importType, description);

      // Process file based on type
      let processingResult;
      
      try {
        switch (fileExtension) {
          case '.geojson':
          case '.json':
            processingResult = await this.processGeoJSON(file, importType, importId);
            break;
          case '.kml':
            processingResult = await this.processKML(file, importType, importId);
            break;
          case '.shp':
          case '.zip':
            processingResult = await this.processShapefile(file, importType, importId);
            break;
          case '.tif':
          case '.tiff':
            processingResult = await this.processGeoTIFF(file, importType, importId);
            break;
          default:
            throw new Error(`Processing not implemented for ${fileExtension}`);
        }

        // Update import status
        await this.updateImportStatus(importId, 'completed', processingResult);

        return {
          importId,
          status: 'completed',
          featuresCount: processingResult.featuresCount
        };

      } catch (processingError) {
        // Update import status with error
        await this.updateImportStatus(importId, 'failed', null, processingError.message);
        throw processingError;
      }

    } catch (error) {
      console.error('Error processing GIS file:', error);
      throw error;
    }
  }

  /**
   * Create import record in database
   */
  async createImportRecord(file, importType, description) {
    try {
      const query = `
        INSERT INTO gis_imports (
          filename, file_type, import_type, status, metadata
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `;

      const fileType = path.extname(file.originalname).toLowerCase().substring(1);
      const metadata = {
        original_filename: file.originalname,
        file_size: file.size,
        mime_type: file.mimetype,
        description: description || null
      };

      const result = await DatabaseService.query(query, [
        file.originalname,
        fileType,
        importType,
        'processing',
        JSON.stringify(metadata)
      ]);

      return result.rows[0].id;

    } catch (error) {
      console.error('Error creating import record:', error);
      throw error;
    }
  }

  /**
   * Update import status
   */
  async updateImportStatus(importId, status, result = null, errorMessage = null) {
    try {
      const query = `
        UPDATE gis_imports 
        SET status = $1, features_count = $2, error_message = $3,
            metadata = COALESCE(metadata, '{}') || $4
        WHERE id = $5
      `;

      const additionalMetadata = result ? {
        processing_completed: new Date().toISOString(),
        geometry_type: result.geometryType,
        projection: result.projection,
        feature_ids: result.featureIds
      } : {};

      await DatabaseService.query(query, [
        status,
        result ? result.featuresCount : null,
        errorMessage,
        JSON.stringify(additionalMetadata),
        importId
      ]);

    } catch (error) {
      console.error('Error updating import status:', error);
      throw error;
    }
  }

  /**
   * Process GeoJSON file
   */
  async processGeoJSON(file, importType, importId) {
    try {
      const fileContent = fs.readFileSync(file.path, 'utf8');
      const geoData = JSON.parse(fileContent);

      if (!geoData.type || geoData.type !== 'FeatureCollection') {
        throw new Error('Invalid GeoJSON format - must be a FeatureCollection');
      }

      const features = geoData.features || [];
      const featureIds = [];

      for (const feature of features) {
        if (!feature.geometry || !feature.geometry.coordinates) {
          continue;
        }

        let featureId;
        if (importType === 'buildings') {
          featureId = await this.insertBuilding(feature);
        } else if (importType === 'topography') {
          featureId = await this.insertTopography(feature);
        }
        
        if (featureId) {
          featureIds.push(featureId);
        }
      }

      // Clean up uploaded file
      fs.unlinkSync(file.path);

      return {
        featuresCount: featureIds.length,
        geometryType: this.detectGeometryType(features),
        projection: 'EPSG:4326', // GeoJSON is always WGS84
        featureIds: featureIds
      };

    } catch (error) {
      // Clean up uploaded file on error
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  }

  /**
   * Process KML file (simplified - would need full KML parser in production)
   */
  async processKML(file, importType, importId) {
    try {
      // This is a placeholder - in production, you'd use a proper KML parser
      // For now, we'll just create a basic import record
      
      // Clean up uploaded file
      fs.unlinkSync(file.path);

      return {
        featuresCount: 0,
        geometryType: 'mixed',
        projection: 'EPSG:4326',
        featureIds: []
      };

    } catch (error) {
      // Clean up uploaded file on error
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  }

  /**
   * Process Shapefile (simplified - would need GDAL/OGR in production)
   */
  async processShapefile(file, importType, importId) {
    try {
      // This is a placeholder - in production, you'd use GDAL/OGR
      // For now, we'll just create a basic import record
      
      // Clean up uploaded file
      fs.unlinkSync(file.path);

      return {
        featuresCount: 0,
        geometryType: 'mixed',
        projection: 'unknown',
        featureIds: []
      };

    } catch (error) {
      // Clean up uploaded file on error
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  }

  /**
   * Process GeoTIFF (simplified - would need GDAL in production)
   */
  async processGeoTIFF(file, importType, importId) {
    try {
      // This is a placeholder - in production, you'd use GDAL
      // For now, we'll just create a basic import record
      
      // Clean up uploaded file
      fs.unlinkSync(file.path);

      return {
        featuresCount: 0,
        geometryType: 'raster',
        projection: 'unknown',
        featureIds: []
      };

    } catch (error) {
      // Clean up uploaded file on error
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  }

  /**
   * Insert building feature into database
   */
  async insertBuilding(feature) {
    try {
      const { geometry, properties } = feature;
      
      // Only process polygon geometries for buildings
      if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
        return null;
      }

      const query = `
        INSERT INTO buildings (
          geometry, height, building_type, stories, material, properties
        ) VALUES (
          ST_GeomFromGeoJSON($1), $2, $3, $4, $5, $6
        ) RETURNING id
      `;

      const values = [
        JSON.stringify(geometry),
        properties.height || properties.HEIGHT || null,
        properties.building_type || properties.TYPE || 'unknown',
        properties.stories || properties.STORIES || null,
        properties.material || properties.MATERIAL || null,
        JSON.stringify(properties)
      ];

      const result = await DatabaseService.query(query, values);
      return result.rows[0].id;

    } catch (error) {
      console.error('Error inserting building:', error);
      return null;
    }
  }

  /**
   * Insert topography feature into database
   */
  async insertTopography(feature) {
    try {
      const { geometry, properties } = feature;

      const query = `
        INSERT INTO topography (
          geometry, elevation, slope, aspect, land_use, properties
        ) VALUES (
          ST_GeomFromGeoJSON($1), $2, $3, $4, $5, $6
        ) RETURNING id
      `;

      const values = [
        JSON.stringify(geometry),
        properties.elevation || properties.ELEVATION || properties.elev || null,
        properties.slope || properties.SLOPE || null,
        properties.aspect || properties.ASPECT || null,
        properties.land_use || properties.LANDUSE || properties.TYPE || null,
        JSON.stringify(properties)
      ];

      const result = await DatabaseService.query(query, values);
      return result.rows[0].id;

    } catch (error) {
      console.error('Error inserting topography:', error);
      return null;
    }
  }

  /**
   * Detect dominant geometry type in features
   */
  detectGeometryType(features) {
    const types = features.map(f => f.geometry?.type).filter(Boolean);
    const typeCounts = {};
    
    types.forEach(type => {
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    // Return most common type
    const mostCommon = Object.keys(typeCounts).reduce((a, b) => 
      typeCounts[a] > typeCounts[b] ? a : b
    );

    return mostCommon || 'mixed';
  }
}

module.exports = GISService;