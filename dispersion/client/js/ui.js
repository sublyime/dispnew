// User Interface management for Chemical Dispersion Modeler

class UIManager {
    constructor() {
        this.currentRelease = null;
        this.isInitialized = false;
    }

    /**
     * Initialize UI components
     */
    init() {
        this.setupEventListeners();
        this.setupModals();
        this.loadChemicals();
        this.isInitialized = true;
        console.log('UI initialized successfully');
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Release button
        document.getElementById('newReleaseBtn').addEventListener('click', () => {
            this.startReleaseMode();
        });

        // Receptor button
        document.getElementById('newReceptorBtn').addEventListener('click', () => {
            this.startReceptorMode();
        });

        // Release form submission
        document.getElementById('releaseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createRelease();
        });

        // Receptor form submission
        document.getElementById('receptorForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createReceptor();
        });

        // Close modal buttons
        document.querySelectorAll('.close').forEach(button => {
            button.addEventListener('click', (e) => {
                this.closeModal(e.target.closest('.modal'));
            });
        });

        // Close modals on outside click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target);
            }
        });

        // Layer toggle checkboxes
        document.querySelectorAll('.layer-toggle').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const layerName = e.target.dataset.layer;
                window.MapManager.toggleLayer(layerName, e.target.checked);
            });
        });

        // Clear all button
        document.getElementById('clearAllBtn').addEventListener('click', () => {
            this.clearAll();
        });
    }

    /**
     * Setup modal behavior
     */
    setupModals() {
        // Ensure modals are hidden on load
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('show');
        });
    }

    /**
     * Start release mode
     */
    startReleaseMode() {
        window.MapManager.setDrawMode('release');
        this.showToast('Click on the map to select release location', 'info');
    }

    /**
     * Start receptor mode
     */
    startReceptorMode() {
        window.MapManager.setDrawMode('receptor');
        this.showReceptorModal();
    }

    /**
     * Show release modal
     */
    showReleaseModal() {
        document.getElementById('releaseModal').classList.add('show');
    }

    /**
     * Show receptor modal
     */
    showReceptorModal() {
        document.getElementById('receptorModal').classList.add('show');
    }

    /**
     * Close modal
     */
    closeModal(modal) {
        modal.classList.remove('show');
        window.MapManager.setDrawMode(null);
    }

    /**
     * Load chemicals for dropdown
     */
    async loadChemicals() {
        try {
            const response = await API.getChemicals();
            const select = document.getElementById('chemicalSelect');
            
            // Clear existing options except first
            select.innerHTML = '<option value="">Select a chemical...</option>';
            
            response.chemicals.forEach(chemical => {
                const option = document.createElement('option');
                option.value = chemical.id;
                option.textContent = `${chemical.name} (${chemical.cas_number})`;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading chemicals:', error);
            this.showToast('Error loading chemicals', 'error');
        }
    }

    /**
     * Create new release
     */
    async createRelease() {
        try {
            const formData = new FormData(document.getElementById('releaseForm'));
            const location = window.MapManager.selectedLocation;
            
            if (!location) {
                this.showToast('Please select a location on the map', 'error');
                return;
            }

            const releaseData = {
                chemical_id: parseInt(formData.get('chemical_id')),
                latitude: location.lat,
                longitude: location.lng,
                release_type: formData.get('release_type'),
                release_rate: parseFloat(formData.get('release_rate')),
                duration: parseFloat(formData.get('duration')) || null,
                start_time: new Date().toISOString(),
                status: 'active'
            };

            const response = await API.createRelease(releaseData);
            this.currentRelease = response.release;

            // Display on map
            window.MapManager.displayRelease(response.release);

            // Start dispersion calculation
            await this.startDispersionCalculation(response.release.id);

            this.closeModal(document.getElementById('releaseModal'));
            this.showToast('Release created successfully', 'success');

        } catch (error) {
            console.error('Error creating release:', error);
            this.showToast('Error creating release', 'error');
        }
    }

    /**
     * Create new receptor
     */
    async createReceptor() {
        try {
            const formData = new FormData(document.getElementById('receptorForm'));
            
            const receptorData = {
                name: formData.get('name'),
                latitude: parseFloat(formData.get('latitude')),
                longitude: parseFloat(formData.get('longitude')),
                receptor_type: formData.get('receptor_type'),
                population: parseInt(formData.get('population')) || 1,
                sensitivity_level: formData.get('sensitivity_level'),
                active: true
            };

            const response = await API.createReceptor(receptorData);

            this.closeModal(document.getElementById('receptorModal'));
            this.showToast('Receptor created successfully', 'success');

            // Reload receptors on map
            await window.MapManager.loadReceptors(window.MapManager.getCurrentBounds());

        } catch (error) {
            console.error('Error creating receptor:', error);
            this.showToast('Error creating receptor', 'error');
        }
    }

    /**
     * Start dispersion calculation
     */
    async startDispersionCalculation(releaseId) {
        try {
            const calculation = await API.calculateDispersion(releaseId);
            
            if (calculation.plume_geometry) {
                window.MapManager.displayPlume(calculation);
                this.updateReceptorImpacts(calculation.receptor_impacts);
            }

        } catch (error) {
            console.error('Error calculating dispersion:', error);
            this.showToast('Error calculating dispersion', 'error');
        }
    }

    /**
     * Update receptor impacts display
     */
    updateReceptorImpacts(impacts) {
        const container = document.getElementById('receptorImpacts');
        
        if (!impacts || impacts.length === 0) {
            container.innerHTML = '<p>No receptor impacts calculated</p>';
            return;
        }

        const html = impacts.map(impact => `
            <div class="impact-item">
                <h4>${impact.receptor_name}</h4>
                <p><strong>Concentration:</strong> ${Utils.formatConcentration(impact.concentration)}</p>
                <p><strong>Risk Level:</strong> <span class="risk-${impact.risk_level}">${impact.risk_level}</span></p>
                <p><strong>Time to Peak:</strong> ${Utils.formatDuration(impact.time_to_peak)}</p>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    /**
     * Clear all data
     */
    async clearAll() {
        if (confirm('Are you sure you want to clear all data? This will remove all releases and reset the map.')) {
            window.MapManager.clearAllLayers();
            this.currentRelease = null;
            document.getElementById('receptorImpacts').innerHTML = '';
            this.showToast('Map cleared', 'info');
        }
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        document.body.appendChild(toast);

        // Show with animation
        setTimeout(() => toast.classList.add('show'), 100);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }

    /**
     * Edit receptor
     */
    editReceptor(receptorId) {
        // Implement receptor editing
        console.log('Edit receptor:', receptorId);
    }

    /**
     * Delete receptor
     */
    async deleteReceptor(receptorId) {
        if (confirm('Are you sure you want to delete this receptor?')) {
            try {
                await API.deleteReceptor(receptorId);
                await window.MapManager.loadReceptors(window.MapManager.getCurrentBounds());
                this.showToast('Receptor deleted', 'success');
            } catch (error) {
                console.error('Error deleting receptor:', error);
                this.showToast('Error deleting receptor', 'error');
            }
        }
    }

    /**
     * View release details
     */
    viewReleaseDetails(releaseId) {
        // Implement release details view
        console.log('View release details:', releaseId);
    }

    /**
     * Stop release
     */
    async stopRelease(releaseId) {
        if (confirm('Are you sure you want to stop this release?')) {
            try {
                await API.updateRelease(releaseId, { status: 'stopped' });
                this.showToast('Release stopped', 'success');
            } catch (error) {
                console.error('Error stopping release:', error);
                this.showToast('Error stopping release', 'error');
            }
        }
    }

    /**
     * Update weather display
     */
    updateWeatherDisplay(weather) {
        const container = document.getElementById('weatherInfo');
        
        if (!weather) {
            container.innerHTML = '<p>No weather data available</p>';
            return;
        }

        container.innerHTML = `
            <div class="weather-item">
                <strong>Temperature:</strong> ${weather.temperature}°C
            </div>
            <div class="weather-item">
                <strong>Wind Speed:</strong> ${weather.wind_speed} m/s
            </div>
            <div class="weather-item">
                <strong>Wind Direction:</strong> ${weather.wind_direction}°
            </div>
            <div class="weather-item">
                <strong>Stability Class:</strong> ${weather.stability_class}
            </div>
            <div class="weather-item">
                <strong>Updated:</strong> ${Utils.formatDate(weather.observation_time)}
            </div>
        `;
    }
}

// Create global UI instance
window.UI = new UIManager();