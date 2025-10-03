// API service for Chemical Dispersion Modeler

class ApiService {
    constructor() {
        this.baseURL = '/api';
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
    }

    /**
     * Make HTTP request
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: { ...this.defaultHeaders, ...options.headers },
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }

    /**
     * GET request
     */
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        
        return this.request(url, { method: 'GET' });
    }

    /**
     * POST request
     */
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT request
     */
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE request
     */
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // Weather API methods
    async getCurrentWeather(lat, lon) {
        return this.get(`/weather/current/${lat}/${lon}`);
    }

    async getLatestWeather(lat, lon) {
        return this.get(`/weather/latest/${lat}/${lon}`);
    }

    async getWeatherHistory(lat, lon, hours = 24) {
        return this.get(`/weather/history/${lat}/${lon}`, { hours });
    }

    async getWeatherStations() {
        return this.get('/weather/stations');
    }

    async createWeatherStation(stationData) {
        return this.post('/weather/stations', stationData);
    }

    async addManualWeatherData(stationId, weatherData) {
        return this.post(`/weather/manual/${stationId}`, weatherData);
    }

    // Chemical API methods
    async getChemicals(params = {}) {
        return this.get('/chemicals', params);
    }

    async getChemical(id) {
        return this.get(`/chemicals/${id}`);
    }

    async createChemical(chemicalData) {
        return this.post('/chemicals', chemicalData);
    }

    async updateChemical(id, chemicalData) {
        return this.put(`/chemicals/${id}`, chemicalData);
    }

    async deleteChemical(id) {
        return this.delete(`/chemicals/${id}`);
    }

    async searchChemicals(query, limit = 10) {
        return this.get('/chemicals/search/suggestions', { q: query, limit });
    }

    async bulkImportChemicals(chemicals) {
        return this.post('/chemicals/bulk', { chemicals });
    }

    async getVolatilityClasses() {
        return this.get('/chemicals/properties/volatility-classes');
    }

    async getPhysicalStates() {
        return this.get('/chemicals/properties/physical-states');
    }

    // Receptor API methods
    async getReceptors(params = {}) {
        return this.get('/receptors', params);
    }

    async createReceptor(receptorData) {
        return this.post('/receptors', receptorData);
    }

    async updateReceptor(id, receptorData) {
        return this.put(`/receptors/${id}`, receptorData);
    }

    async deleteReceptor(id) {
        return this.delete(`/receptors/${id}`);
    }

    async getReceptorTypes() {
        return this.get('/receptors/types');
    }

    async getSensitivityLevels() {
        return this.get('/receptors/sensitivity-levels');
    }

    // Dispersion API methods
    async createRelease(releaseData) {
        return this.post('/dispersion/release', releaseData);
    }

    async getReleases(params = {}) {
        return this.get('/dispersion/releases', params);
    }

    async getRelease(id) {
        return this.get(`/dispersion/releases/${id}`);
    }

    async getReleaseCalculations(id, params = {}) {
        return this.get(`/dispersion/releases/${id}/calculations`, params);
    }

    async getLatestCalculation(id) {
        return this.get(`/dispersion/releases/${id}/latest`);
    }

    async getReleaseImpacts(id, calculationId = null) {
        const params = calculationId ? { calculation_id: calculationId } : {};
        return this.get(`/dispersion/releases/${id}/impacts`, params);
    }

    async updateReleaseStatus(id, status) {
        return this.put(`/dispersion/releases/${id}/status`, { status });
    }

    async recalculateDispersion(id) {
        return this.post(`/dispersion/releases/${id}/recalculate`);
    }

    async getActiveReleases() {
        return this.get('/dispersion/active');
    }

    async getReleaseTypes() {
        return this.get('/dispersion/release-types');
    }

    // Receptor methods
    async createReceptor(receptorData) {
        return this.post('/receptors', receptorData);
    }

    async getReceptors() {
        return this.get('/receptors');
    }

    async getReceptor(id) {
        return this.get(`/receptors/${id}`);
    }

    async updateReceptor(id, receptorData) {
        return this.put(`/receptors/${id}`, receptorData);
    }

    async deleteReceptor(id) {
        return this.delete(`/receptors/${id}`);
    }

    async getActiveReceptors() {
        return this.get('/receptors?active=true');
    }

    // GIS API methods
    async uploadGISFile(file, importType, description = '') {
        const formData = new FormData();
        formData.append('gisFile', file);
        formData.append('import_type', importType);
        formData.append('description', description);

        return this.request('/gis/upload', {
            method: 'POST',
            body: formData,
            headers: {} // Don't set Content-Type for FormData
        });
    }

    async getGISImports(params = {}) {
        return this.get('/gis/imports', params);
    }

    async getImportStatus(id) {
        return this.get(`/gis/imports/${id}/status`);
    }

    async deleteImport(id) {
        return this.delete(`/gis/imports/${id}`);
    }

    async getBuildings(bbox, limit = 1000) {
        return this.get('/gis/buildings', { bbox, limit });
    }

    async getTopography(bbox, limit = 1000) {
        return this.get('/gis/topography', { bbox, limit });
    }

    async createBuilding(buildingData) {
        return this.post('/gis/buildings', buildingData);
    }

    async getSupportedFormats() {
        return this.get('/gis/supported-formats');
    }

    // Health check
    async healthCheck() {
        return this.get('/health');
    }
}

// Create global API instance
window.API = new ApiService();