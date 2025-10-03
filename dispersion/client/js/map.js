// Map management for Chemical Dispersion Modeler

class MapManager {
    constructor() {
        this.map = null;
        this.layers = {};
        this.markers = {};
        this.selectedLocation = null;
        this.drawMode = null;
        this.isInitialized = false;
        this.measurementMode = false;
        this.measurementPoints = [];
        this.measurementControl = null;
        this.receptorMode = false;
    }

    /**
     * Initialize the map
     */
    init() {
        // Create map centered on continental US
        this.map = L.map('map', {
            center: [39.8283, -98.5795],
            zoom: 5,
            zoomControl: true
        });

        // Add base layers
        this.addBaseLayers();

        // Initialize layer groups
        this.initializeLayers();

        // Set up event handlers
        this.setupEventHandlers();

        this.isInitialized = true;
        console.log('Map initialized successfully');
    }

    /**
     * Add base map layers
     */
    addBaseLayers() {
        // OpenStreetMap base layer
        const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        });

        // Satellite imagery layer
        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles © Esri',
            maxZoom: 18
        });

        // Terrain layer
        const terrainLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap',
            maxZoom: 17
        });

        // Add default layer
        osmLayer.addTo(this.map);

        // Create layer control
        const baseLayers = {
            "Street Map": osmLayer,
            "Satellite": satelliteLayer,
            "Terrain": terrainLayer
        };

        L.control.layers(baseLayers).addTo(this.map);
    }

    /**
     * Initialize layer groups
     */
    initializeLayers() {
        this.layers = {
            buildings: L.layerGroup().addTo(this.map),
            topography: L.layerGroup().addTo(this.map),
            receptors: L.layerGroup().addTo(this.map),
            releases: L.layerGroup().addTo(this.map),
            plumes: L.layerGroup().addTo(this.map),
            wind: L.layerGroup(),
            measurements: L.layerGroup()
        };
    }

    /**
     * Set up map event handlers
     */
    setupEventHandlers() {
        // Map click handler
        this.map.on('click', (e) => {
            this.handleMapClick(e);
        });

        // Map move handler for loading data
        this.map.on('moveend', () => {
            this.loadVisibleData();
        });

        // Map zoom handler
        this.map.on('zoomend', () => {
            this.updateLayerVisibility();
        });
    }

    /**
     * Handle map clicks
     */
    handleMapClick(e) {
        const { lat, lng } = e.latlng;
        
        console.log('Map clicked:', lat, lng, 'Draw mode:', this.drawMode);
        
        if (this.drawMode === 'release') {
            console.log('Handling as release location');
            this.selectReleaseLocation(lat, lng);
        } else if (this.drawMode === 'receptor') {
            console.log('Handling as receptor location');
            this.selectReceptorLocation(lat, lng);
        } else {
            console.log('No draw mode set, ignoring click');
        }
    }

    /**
     * Select release location
     */
    selectReleaseLocation(lat, lng) {
        console.log('Selecting release location:', lat, lng);
        
        this.selectedLocation = { lat, lng };
        
        console.log('Selected location set to:', this.selectedLocation);
        
        // Remove existing selection marker
        if (this.markers.selection) {
            this.map.removeLayer(this.markers.selection);
        }

        // Add new selection marker
        this.markers.selection = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'release-location-marker',
                html: '<i class="fas fa-plus-circle"></i>',
                iconSize: [30, 30]
            })
        }).addTo(this.map);

        // Update form if elements exist
        const selectedLat = document.getElementById('selectedLat');
        const selectedLon = document.getElementById('selectedLon');
        if (selectedLat) selectedLat.textContent = lat.toFixed(6);
        if (selectedLon) selectedLon.textContent = lng.toFixed(6);

        // Show release form
        this.showReleaseModal();
    }

    /**
     * Select receptor location
     */
    selectReceptorLocation(lat, lng) {
        console.log('Selecting receptor location:', lat, lng);
        
        // Update receptor form coordinates if elements exist
        const receptorLat = document.getElementById('receptorLat');
        const receptorLon = document.getElementById('receptorLon');
        if (receptorLat) receptorLat.value = lat.toFixed(6);
        if (receptorLon) receptorLon.value = lng.toFixed(6);
        
        // Call UI cleanup if it's in location selection mode
        if (window.UI && window.UI.isSelectingLocation) {
            window.UI.handleLocationSelected();
        }
    }

    /**
     * Show release modal
     */
    showReleaseModal() {
        const modal = document.getElementById('releaseModal');
        if (modal) {
            modal.classList.add('show');
        }
        this.setDrawMode(null);
    }

    /**
     * Set drawing mode
     */
    setDrawMode(mode) {
        console.log('Setting draw mode from', this.drawMode, 'to', mode);
        this.drawMode = mode;
        
        // Update cursor
        const mapContainer = document.getElementById('map');
        if (mode) {
            mapContainer.style.cursor = 'crosshair';
        } else {
            mapContainer.style.cursor = '';
        }
    }

    /**
     * Load visible data based on current map bounds
     */
    async loadVisibleData() {
        const bounds = this.map.getBounds();
        const bbox = [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth()
        ].join(',');

        try {
            // Load buildings if zoomed in enough
            if (this.map.getZoom() >= 14) {
                await this.loadBuildings(bbox);
            }

            // Load topography
            if (this.map.getZoom() >= 10) {
                await this.loadTopography(bbox);
            }

            // Load receptors
            await this.loadReceptors(bbox);

        } catch (error) {
            console.error('Error loading map data:', error);
        }
    }

    /**
     * Load buildings
     */
    async loadBuildings(bbox) {
        try {
            const response = await API.getBuildings(bbox, 500);
            this.displayBuildings(response.features);
        } catch (error) {
            console.error('Error loading buildings:', error);
        }
    }

    /**
     * Display buildings on map
     */
    displayBuildings(buildings) {
        this.layers.buildings.clearLayers();

        buildings.forEach(building => {
            const layer = L.geoJSON(building, {
                style: {
                    fillColor: '#8B4513',
                    weight: 1,
                    opacity: 0.8,
                    color: '#654321',
                    fillOpacity: 0.6
                },
                onEachFeature: (feature, layer) => {
                    const props = feature.properties;
                    const popupContent = `
                        <div class="building-popup">
                            <h4>Building</h4>
                            <p><strong>Type:</strong> ${props.building_type || 'Unknown'}</p>
                            <p><strong>Height:</strong> ${props.height ? props.height + ' m' : 'Unknown'}</p>
                            <p><strong>Stories:</strong> ${props.stories || 'Unknown'}</p>
                        </div>
                    `;
                    layer.bindPopup(popupContent);
                }
            });

            this.layers.buildings.addLayer(layer);
        });
    }

    /**
     * Load topography
     */
    async loadTopography(bbox) {
        try {
            const response = await API.getTopography(bbox, 200);
            this.displayTopography(response.features);
        } catch (error) {
            console.error('Error loading topography:', error);
        }
    }

    /**
     * Display topography on map
     */
    displayTopography(topography) {
        this.layers.topography.clearLayers();

        topography.forEach(topo => {
            const elevation = topo.properties.elevation || 0;
            const color = this.getElevationColor(elevation);

            const layer = L.geoJSON(topo, {
                style: {
                    fillColor: color,
                    weight: 1,
                    opacity: 0.3,
                    color: color,
                    fillOpacity: 0.2
                },
                onEachFeature: (feature, layer) => {
                    const props = feature.properties;
                    const popupContent = `
                        <div class="topography-popup">
                            <h4>Topography</h4>
                            <p><strong>Elevation:</strong> ${props.elevation ? props.elevation + ' m' : 'Unknown'}</p>
                            <p><strong>Slope:</strong> ${props.slope ? props.slope + '°' : 'Unknown'}</p>
                            <p><strong>Land Use:</strong> ${props.land_use || 'Unknown'}</p>
                        </div>
                    `;
                    layer.bindPopup(popupContent);
                }
            });

            this.layers.topography.addLayer(layer);
        });
    }

    /**
     * Get elevation color
     */
    getElevationColor(elevation) {
        if (elevation < 100) return '#0066cc';
        if (elevation < 500) return '#00aa00';
        if (elevation < 1000) return '#ffaa00';
        if (elevation < 2000) return '#ff6600';
        return '#cc0000';
    }

    /**
     * Load receptors
     */
    async loadReceptors(bbox) {
        try {
            const response = await API.getReceptors({ bbox, active: 'true' });
            this.displayReceptors(response.receptors);
        } catch (error) {
            console.error('Error loading receptors:', error);
        }
    }

    /**
     * Display receptors on map
     */
    displayReceptors(receptors) {
        this.layers.receptors.clearLayers();

        receptors.forEach(receptor => {
            const icon = this.getReceptorIcon(receptor.receptor_type);
            
            const marker = L.marker([receptor.latitude, receptor.longitude], {
                icon: L.divIcon({
                    className: 'receptor-marker',
                    html: `<i class="${icon}"></i>`,
                    iconSize: [24, 24]
                })
            });

            const popupContent = `
                <div class="receptor-popup">
                    <h4>${receptor.name}</h4>
                    <p><strong>Type:</strong> ${receptor.receptor_type}</p>
                    <p><strong>Population:</strong> ${receptor.population || 1}</p>
                    <p><strong>Sensitivity:</strong> ${receptor.sensitivity_level}</p>
                    <div class="popup-actions">
                        <button class="btn btn-sm receptor-edit-btn" data-receptor-id="${receptor.id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-sm receptor-delete-btn" data-receptor-id="${receptor.id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;

            marker.bindPopup(popupContent);
            this.layers.receptors.addLayer(marker);
        });
    }

    /**
     * Get receptor icon based on type
     */
    getReceptorIcon(type) {
        const icons = {
            'residential': 'fas fa-home',
            'commercial': 'fas fa-building',
            'industrial': 'fas fa-industry',
            'school': 'fas fa-school',
            'hospital': 'fas fa-hospital',
            'recreation': 'fas fa-tree',
            'sensitive': 'fas fa-exclamation-triangle',
            'environmental': 'fas fa-leaf',
            'agricultural': 'fas fa-tractor',
            'general': 'fas fa-users'
        };
        return icons[type] || 'fas fa-map-marker';
    }

    /**
     * Display dispersion plume
     */
    displayPlume(calculation) {
        console.log('Displaying plume with calculation:', calculation);
        
        // Clear existing plumes
        this.layers.plumes.clearLayers();

        if (!calculation.plume_geometry) {
            console.warn('No plume geometry found in calculation');
            return;
        }

        console.log('Plume geometry:', calculation.plume_geometry);
        console.log('Plume geometry type:', typeof calculation.plume_geometry);
        console.log('Plume geometry structure:', JSON.stringify(calculation.plume_geometry, null, 2));

        try {
          const plume = L.geoJSON(calculation.plume_geometry, {
            style: {
                fillColor: '#ff6600',
                weight: 2,
                opacity: 0.8,
                color: '#ff3300',
                fillOpacity: 0.3
            }
          });

          plume.bindPopup(`
              <div class="plume-popup">
                  <h4>Chemical Plume</h4>
                  <p><strong>Model:</strong> ${calculation.calculation_method || 'Unknown'} (ALOHA ${calculation.model_parameters?.aloha_version || '5.4.4'} compatible)</p>
                  <p><strong>Max Concentration:</strong> ${Utils.formatConcentration(calculation.max_concentration)}</p>
                  <p><strong>Affected Area:</strong> ${Utils.formatDistance(Math.sqrt(calculation.affected_area))} radius</p>
                  <p><strong>Wind Speed:</strong> ${calculation.model_parameters?.wind_speed || 'N/A'} m/s</p>
                  <p><strong>Stability Class:</strong> ${calculation.model_parameters?.stability_class || 'N/A'}</p>
                  <p><strong>Calculation Time:</strong> ${Utils.formatDate(calculation.calculation_time)}</p>
              </div>
          `);

          this.layers.plumes.addLayer(plume);

          console.log('Plume added to map, fitting bounds');
          
          // Fit map to plume bounds
          this.map.fitBounds(plume.getBounds(), { padding: [20, 20] });
          
          console.log('Plume display completed');
        } catch (error) {
          console.error('Error creating Leaflet GeoJSON:', error);
          console.error('Invalid geometry data:', calculation.plume_geometry);
        }
    }

    /**
     * Display release marker
     */
    displayRelease(release) {
        const marker = L.marker([release.latitude, release.longitude], {
            icon: L.divIcon({
                className: 'release-marker active',
                html: '<i class="fas fa-exclamation-circle"></i>',
                iconSize: [30, 30]
            })
        });

        const popupContent = `
            <div class="release-popup">
                <h4>Chemical Release</h4>
                <p><strong>Chemical:</strong> ${release.chemical_name}</p>
                <p><strong>Type:</strong> ${release.release_type}</p>
                <p><strong>Status:</strong> <span class="status-${release.status}">${release.status}</span></p>
                <p><strong>Started:</strong> ${Utils.formatDate(release.start_time)}</p>
                <div class="popup-actions">
                    <button class="btn btn-sm release-details-btn" data-release-id="${release.id}">
                        <i class="fas fa-eye"></i> Details
                    </button>
                    <button class="btn btn-sm release-stop-btn" data-release-id="${release.id}">
                        <i class="fas fa-stop"></i> Stop
                    </button>
                </div>
            </div>
        `;

        marker.bindPopup(popupContent);
        this.layers.releases.addLayer(marker);
    }

    /**
     * Update layer visibility based on zoom level
     */
    updateLayerVisibility() {
        const zoom = this.map.getZoom();
        
        // Hide/show buildings based on zoom
        if (zoom < 14) {
            this.map.removeLayer(this.layers.buildings);
        } else {
            this.map.addLayer(this.layers.buildings);
        }

        // Hide/show detailed topography
        if (zoom < 10) {
            this.map.removeLayer(this.layers.topography);
        } else {
            this.map.addLayer(this.layers.topography);
        }
    }

    /**
     * Toggle layer visibility
     */
    toggleLayer(layerName, visible) {
        const layer = this.layers[layerName];
        if (!layer) return;

        if (visible) {
            this.map.addLayer(layer);
        } else {
            this.map.removeLayer(layer);
        }
    }

    /**
     * Clear all layers
     */
    clearAllLayers() {
        Object.values(this.layers).forEach(layer => {
            layer.clearLayers();
        });
        
        Object.values(this.markers).forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.markers = {};
    }

    /**
     * Fit map to coordinates
     */
    fitToCoordinates(coordinates, options = {}) {
        const bounds = L.latLngBounds(coordinates);
        this.map.fitBounds(bounds, { padding: [20, 20], ...options });
    }

    /**
     * Get current map bounds as bbox string
     */
    getCurrentBounds() {
        const bounds = this.map.getBounds();
        return [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth()
        ].join(',');
    }

    /**
     * Refresh GIS layers after upload
     */
    async refreshGISLayers() {
        try {
            // Refresh buildings layer
            if (this.layers.buildings) {
                this.map.removeLayer(this.layers.buildings);
            }
            await this.loadBuildingsLayer();

            // Refresh topography layer
            if (this.layers.topography) {
                this.map.removeLayer(this.layers.topography);
            }
            await this.loadTopographyLayer();

            console.log('GIS layers refreshed');
        } catch (error) {
            console.error('Error refreshing GIS layers:', error);
        }
    }

    /**
     * Load buildings layer from API
     */
    async loadBuildingsLayer() {
        try {
            const response = await fetch('/api/gis/buildings');
            const data = await response.json();
            
            if (data.success && data.features.length > 0) {
                this.layers.buildings = L.geoJSON(data, {
                    style: {
                        color: '#ff7800',
                        weight: 2,
                        opacity: 0.8,
                        fillColor: '#ffaa40',
                        fillOpacity: 0.4
                    },
                    onEachFeature: (feature, layer) => {
                        if (feature.properties) {
                            const props = feature.properties;
                            let popupContent = '<h6>Building</h6>';
                            
                            Object.keys(props).forEach(key => {
                                if (props[key] !== null && props[key] !== undefined) {
                                    popupContent += `<strong>${key}:</strong> ${props[key]}<br>`;
                                }
                            });
                            
                            layer.bindPopup(popupContent);
                        }
                    }
                }).addTo(this.map);
            }
        } catch (error) {
            console.error('Error loading buildings layer:', error);
        }
    }

    /**
     * Load topography layer from API
     */
    async loadTopographyLayer() {
        try {
            const response = await fetch('/api/gis/topography');
            const data = await response.json();
            
            if (data.success && data.features.length > 0) {
                this.layers.topography = L.geoJSON(data, {
                    style: {
                        color: '#8B4513',
                        weight: 1,
                        opacity: 0.6,
                        fillColor: '#DEB887',
                        fillOpacity: 0.3
                    },
                    onEachFeature: (feature, layer) => {
                        if (feature.properties) {
                            const props = feature.properties;
                            let popupContent = '<h6>Topography</h6>';
                            
                            Object.keys(props).forEach(key => {
                                if (props[key] !== null && props[key] !== undefined) {
                                    popupContent += `<strong>${key}:</strong> ${props[key]}<br>`;
                                }
                            });
                            
                            layer.bindPopup(popupContent);
                        }
                    }
                }).addTo(this.map);
            }
        } catch (error) {
            console.error('Error loading topography layer:', error);
        }
    }

    /**
     * Update or create downwind corridor visualization
     */
    updateDownwindCorridor(weather) {
        if (!weather || !weather.wind_direction || !weather.wind_speed) {
            // Remove existing corridor if no wind data
            if (this.layers.downwindCorridor) {
                this.map.removeLayer(this.layers.downwindCorridor);
                delete this.layers.downwindCorridor;
            }
            return;
        }

        // Remove existing corridor
        if (this.layers.downwindCorridor) {
            this.map.removeLayer(this.layers.downwindCorridor);
        }

        // Create downwind corridor from map center
        const center = this.map.getCenter();
        const corridor = this.createDownwindCorridor(center, weather);
        
        this.layers.downwindCorridor = L.geoJSON(corridor, {
            style: {
                color: '#FF6B6B',
                weight: 2,
                opacity: 0.7,
                fillColor: '#FF6B6B',
                fillOpacity: 0.2,
                dashArray: '5, 5'
            }
        }).addTo(this.map);

        // Add wind arrow at center
        this.updateWindArrow(center, weather);
    }

    /**
     * Create downwind corridor geometry
     */
    createDownwindCorridor(center, weather) {
        const windDirection = weather.wind_direction;
        const windSpeed = weather.wind_speed;
        
        // Corridor parameters based on wind speed
        const corridorLength = Math.max(5000, windSpeed * 1000); // meters
        const corridorWidth = Math.max(1000, windSpeed * 200); // meters
        
        // Convert wind direction (meteorological) to mathematical bearing
        const bearing = (windDirection + 180) % 360; // Wind "to" direction
        
        // Calculate corridor points
        const startPoint = [center.lat, center.lng];
        const endPoint = this.calculateDestination(center.lat, center.lng, bearing, corridorLength);
        
        // Create corridor polygon (simplified as a rectangle)
        const perpBearing1 = (bearing + 90) % 360;
        const perpBearing2 = (bearing - 90) % 360;
        
        const halfWidth = corridorWidth / 2;
        
        const corner1 = this.calculateDestination(center.lat, center.lng, perpBearing1, halfWidth);
        const corner2 = this.calculateDestination(center.lat, center.lng, perpBearing2, halfWidth);
        const corner3 = this.calculateDestination(endPoint[0], endPoint[1], perpBearing2, halfWidth);
        const corner4 = this.calculateDestination(endPoint[0], endPoint[1], perpBearing1, halfWidth);
        
        return {
            type: "Feature",
            geometry: {
                type: "Polygon",
                coordinates: [[
                    [corner1[1], corner1[0]],
                    [corner2[1], corner2[0]], 
                    [corner3[1], corner3[0]],
                    [corner4[1], corner4[0]],
                    [corner1[1], corner1[0]]
                ]]
            },
            properties: {
                name: "Downwind Corridor",
                windDirection: windDirection,
                windSpeed: windSpeed,
                length: corridorLength,
                width: corridorWidth
            }
        };
    }

    /**
     * Calculate destination point from bearing and distance
     */
    calculateDestination(lat, lon, bearing, distance) {
        const R = 6371000; // Earth's radius in meters
        const bearingRad = bearing * (Math.PI / 180);
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
        
        return [destLatRad * (180 / Math.PI), destLonRad * (180 / Math.PI)];
    }

    /**
     * Update wind arrow visualization
     */
    updateWindArrow(center, weather) {
        // Remove existing wind arrow
        if (this.markers.windArrow) {
            this.map.removeLayer(this.markers.windArrow);
        }

        const windDirection = weather.wind_direction;
        const windSpeed = weather.wind_speed;
        
        // Create wind arrow icon
        const arrowIcon = L.divIcon({
            className: 'wind-arrow',
            html: `<div style="transform: rotate(${windDirection}deg); color: #FF6B6B; font-size: 24px;">
                     <i class="fas fa-long-arrow-alt-up"></i>
                   </div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        this.markers.windArrow = L.marker([center.lat, center.lng], {
            icon: arrowIcon,
            zIndexOffset: 1000
        }).bindTooltip(`Wind: ${windSpeed.toFixed(1)} m/s from ${windDirection.toFixed(0)}°`, {
            permanent: false,
            direction: 'top'
        }).addTo(this.map);
    }

    /**
     * Enhanced map click handler for weather-driven modeling
     */
    async handleMapClickForModeling(e) {
        const { lat, lng } = e.latlng;
        
        try {
            // Show loading indicator
            const loadingIndicator = this.showLoadingIndicator('Fetching weather data...');
            
            // Fetch weather data for clicked location
            const weatherResponse = await API.getCurrentWeather(lat, lng);
            const weather = weatherResponse.weather;
            
            // Update weather display
            if (window.UI && weather) {
                window.UI.updateWeatherDisplay(weather);
            }
            
            // Update downwind corridor for this location
            this.updateDownwindCorridor(weather);
            
            // Set up release location
            this.selectReleaseLocation(lat, lng);
            
            // Pre-populate weather data in release form
            this.prePopulateWeatherData(weather);
            
            loadingIndicator.remove();
            
        } catch (error) {
            console.error('Error fetching weather for modeling:', error);
            // Still allow modeling with default weather
            this.selectReleaseLocation(lat, lng);
        }
    }

    /**
     * Show loading indicator
     */
    showLoadingIndicator(message) {
        const indicator = L.marker([this.map.getCenter().lat, this.map.getCenter().lng], {
            icon: L.divIcon({
                className: 'loading-indicator',
                html: `<div class="spinner"></div><span>${message}</span>`,
                iconSize: [200, 50]
            }),
            zIndexOffset: 2000
        }).addTo(this.map);
        
        return indicator;
    }

    /**
     * Pre-populate weather data in release form
     */
    prePopulateWeatherData(weather) {
        // This will be used when the release form is shown
        this.lastWeatherData = weather;
    }

    /**
     * Enable click-to-model mode
     */
    enableClickToModel() {
        this.drawMode = 'release';
        this.map.getContainer().style.cursor = 'crosshair';
        
        // Override the click handler for weather-driven modeling
        this.map.off('click');
        this.map.on('click', (e) => {
            this.handleMapClickForModeling(e);
        });
    }

    /**
     * Disable click-to-model mode
     */
    disableClickToModel() {
        this.drawMode = null;
        this.map.getContainer().style.cursor = '';
        
        // Restore normal click handler
        this.map.off('click');
        this.map.on('click', (e) => {
            this.handleMapClick(e);
        });
    }

    /**
     * Toggle measurement tool
     */
    toggleMeasurementTool() {
        if (this.measurementMode) {
            this.disableMeasurementTool();
        } else {
            this.enableMeasurementTool();
        }
    }

    /**
     * Enable measurement tool
     */
    enableMeasurementTool() {
        this.measurementMode = true;
        this.measurementPoints = [];
        this.map.getContainer().style.cursor = 'crosshair';
        
        // Change click handler for measurement
        this.map.off('click');
        this.map.on('click', (e) => {
            this.addMeasurementPoint(e.latlng);
        });

        // Show measurement controls
        this.showMeasurementControls();
    }

    /**
     * Disable measurement tool
     */
    disableMeasurementTool() {
        this.measurementMode = false;
        this.measurementPoints = [];
        this.map.getContainer().style.cursor = '';
        
        // Clear measurement layers
        if (this.layers.measurements) {
            this.layers.measurements.clearLayers();
        }

        // Restore normal click handler
        this.map.off('click');
        this.map.on('click', (e) => {
            this.handleMapClick(e);
        });

        this.hideMeasurementControls();
    }

    /**
     * Add measurement point
     */
    addMeasurementPoint(latlng) {
        this.measurementPoints.push(latlng);

        // Add point marker
        const marker = L.circleMarker(latlng, {
            radius: 4,
            fillColor: '#ff7800',
            color: '#ff7800',
            weight: 2,
            fillOpacity: 0.8
        }).addTo(this.layers.measurements);

        // If we have more than one point, draw line and show distance
        if (this.measurementPoints.length > 1) {
            const line = L.polyline(this.measurementPoints, {
                color: '#ff7800',
                weight: 3,
                opacity: 0.8
            }).addTo(this.layers.measurements);

            // Calculate total distance
            const totalDistance = this.calculateDistance();
            
            // Show distance popup on the last point
            marker.bindPopup(`Distance: ${totalDistance.toFixed(2)} km`).openPopup();
        }

        // Show current point coordinates
        marker.bindTooltip(`${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`, {
            permanent: false,
            direction: 'top'
        });
    }

    /**
     * Calculate total distance of measurement
     */
    calculateDistance() {
        if (this.measurementPoints.length < 2) return 0;
        
        let totalDistance = 0;
        for (let i = 1; i < this.measurementPoints.length; i++) {
            const prev = this.measurementPoints[i - 1];
            const curr = this.measurementPoints[i];
            totalDistance += prev.distanceTo(curr) / 1000; // Convert to km
        }
        return totalDistance;
    }

    /**
     * Show measurement controls
     */
    showMeasurementControls() {
        // Create measurement control if it doesn't exist
        if (!this.measurementControl) {
            this.measurementControl = L.control({ position: 'topright' });
            this.measurementControl.onAdd = () => {
                const div = L.DomUtil.create('div', 'measurement-controls');
                div.innerHTML = `
                    <button class="measurement-btn clear-btn">
                        <i class="fas fa-trash"></i> Clear
                    </button>
                    <button class="measurement-btn done-btn">
                        <i class="fas fa-times"></i> Done
                    </button>
                `;
                
                // Add event listeners instead of inline onclick
                const clearBtn = div.querySelector('.clear-btn');
                const doneBtn = div.querySelector('.done-btn');
                
                if (clearBtn) {
                    clearBtn.addEventListener('click', () => {
                        this.clearMeasurement();
                    });
                }
                
                if (doneBtn) {
                    doneBtn.addEventListener('click', () => {
                        this.disableMeasurementTool();
                    });
                }
                
                return div;
            };
        }
        this.measurementControl.addTo(this.map);
    }

    /**
     * Hide measurement controls
     */
    hideMeasurementControls() {
        if (this.measurementControl) {
            this.map.removeControl(this.measurementControl);
        }
    }

    /**
     * Clear measurement
     */
    clearMeasurement() {
        this.measurementPoints = [];
        if (this.layers.measurements) {
            this.layers.measurements.clearLayers();
        }
    }

    /**
     * Enter receptor placement mode
     */
    enterReceptorMode() {
        this.receptorMode = true;
        this.map.getContainer().style.cursor = 'crosshair';
        
        // Change click handler for receptor placement
        this.map.off('click');
        this.map.on('click', (e) => {
            this.placeReceptor(e.latlng);
        });
    }

    /**
     * Place receptor at location
     */
    placeReceptor(latlng) {
        // Exit receptor mode
        this.receptorMode = false;
        this.map.getContainer().style.cursor = '';
        
        // Restore normal click handler
        this.map.off('click');
        this.map.on('click', (e) => {
            this.handleMapClick(e);
        });

        // Populate receptor form with coordinates
        document.getElementById('receptorLat').value = latlng.lat.toFixed(6);
        document.getElementById('receptorLon').value = latlng.lng.toFixed(6);
        
        // Show receptor modal
        document.getElementById('receptorModal').style.display = 'flex';
    }

    /**
     * Display receptors on map
     */
    displayReceptors(receptors) {
        if (!this.layers.receptors) return;
        
        // Clear existing receptors
        this.layers.receptors.clearLayers();

        // Ensure receptors is an array
        if (!Array.isArray(receptors) || receptors.length === 0) {
            return;
        }

        receptors.forEach(receptor => {
            // Ensure receptor has required coordinates
            if (!receptor.latitude || !receptor.longitude) {
                console.warn('Receptor missing coordinates:', receptor);
                return;
            }

            const marker = L.marker([receptor.latitude, receptor.longitude], {
                icon: L.divIcon({
                    className: 'receptor-marker',
                    html: `<i class="fas fa-users" style="color: ${this.getReceptorColor(receptor.sensitivity_level)}"></i>`,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                })
            });

            marker.bindPopup(`
                <div class="receptor-popup">
                    <h4>${receptor.name}</h4>
                    <p><strong>Type:</strong> ${receptor.receptor_type}</p>
                    <p><strong>Population:</strong> ${receptor.population || 'N/A'}</p>
                    <p><strong>Sensitivity:</strong> ${receptor.sensitivity_level}</p>
                    <p><strong>Height:</strong> ${receptor.height}m</p>
                    <div class="popup-actions">
                        <button class="btn btn-sm receptor-edit-btn" data-receptor-id="${receptor.id}">Edit</button>
                        <button class="btn btn-sm btn-danger receptor-delete-btn" data-receptor-id="${receptor.id}">Delete</button>
                    </div>
                </div>
            `);

            marker.addTo(this.layers.receptors);
        });
    }

    /**
     * Get receptor color based on sensitivity
     */
    getReceptorColor(sensitivity) {
        const colors = {
            'low': '#28a745',
            'medium': '#ffc107', 
            'high': '#fd7e14',
            'critical': '#dc3545'
        };
        return colors[sensitivity] || '#6c757d';
    }

    /**
     * Toggle layer visibility
     */
    toggleLayer(layerName, visible) {
        if (!this.layers[layerName]) {
            console.warn(`Layer ${layerName} not found`);
            return;
        }

        if (visible) {
            this.layers[layerName].addTo(this.map);
            
            // Load layer data if needed
            switch (layerName) {
                case 'buildings':
                    this.loadBuildingsLayer();
                    break;
                case 'topography':
                    this.loadTopographyLayer();
                    break;
                case 'receptors':
                    window.UI.loadReceptors();
                    break;
                case 'wind':
                    this.loadWindLayer();
                    break;
            }
        } else {
            this.map.removeLayer(this.layers[layerName]);
        }
    }

    /**
     * Load wind layer
     */
    loadWindLayer() {
        // This would connect to wind data service
        console.log('Loading wind layer...');
        // Implementation depends on wind data source
    }

    /**
     * Load visible data based on current map bounds
     */
    loadVisibleData() {
        const bounds = this.map.getBounds();
        // Load GIS data for visible area
        this.loadBuildingsForBounds(bounds);
        this.loadTopographyForBounds(bounds);
    }

    /**
     * Load buildings for specific bounds
     */
    async loadBuildingsForBounds(bounds) {
        try {
            // This would call the GIS API with bounds
            console.log('Loading buildings for bounds:', bounds);
        } catch (error) {
            console.error('Error loading buildings:', error);
        }
    }

    /**
     * Load topography for specific bounds
     */
    async loadTopographyForBounds(bounds) {
        try {
            // This would call the GIS API with bounds
            console.log('Loading topography for bounds:', bounds);
        } catch (error) {
            console.error('Error loading topography:', error);
        }
    }
}

// Create global map instance
window.MapManager = new MapManager();