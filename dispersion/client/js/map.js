// Map management for Chemical Dispersion Modeler

class MapManager {
    constructor() {
        this.map = null;
        this.layers = {};
        this.markers = {};
        this.selectedLocation = null;
        this.drawMode = null;
        this.isInitialized = false;
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
        
        if (this.drawMode === 'release') {
            this.selectReleaseLocation(lat, lng);
        } else if (this.drawMode === 'receptor') {
            this.selectReceptorLocation(lat, lng);
        }
    }

    /**
     * Select release location
     */
    selectReleaseLocation(lat, lng) {
        this.selectedLocation = { lat, lng };
        
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
        // Update receptor form coordinates if elements exist
        const receptorLat = document.getElementById('receptorLat');
        const receptorLon = document.getElementById('receptorLon');
        if (receptorLat) receptorLat.value = lat.toFixed(6);
        if (receptorLon) receptorLon.value = lng.toFixed(6);
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
        // Clear existing plumes
        this.layers.plumes.clearLayers();

        if (!calculation.plume_geometry) return;

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

        // Fit map to plume bounds
        this.map.fitBounds(plume.getBounds(), { padding: [20, 20] });
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
}

// Create global map instance
window.MapManager = new MapManager();