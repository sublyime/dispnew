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
        this.initGISUpload();
        this.isInitialized = true;
        console.log('UI initialized successfully');
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Release button
        const newReleaseBtn = document.getElementById('newReleaseBtn');
        if (newReleaseBtn) {
            newReleaseBtn.addEventListener('click', () => {
                this.startReleaseMode();
            });
        }

        // Receptor button
        const newReceptorBtn = document.getElementById('newReceptorBtn');
        if (newReceptorBtn) {
            newReceptorBtn.addEventListener('click', () => {
                this.startReceptorMode();
            });
        }

        // Release form submission
        const releaseForm = document.getElementById('releaseForm');
        if (releaseForm) {
            releaseForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createRelease();
            });
        }

        // Receptor form submission
        const receptorForm = document.getElementById('receptorForm');
        if (receptorForm) {
            receptorForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createReceptor();
            });
        }

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
        const clearAllBtn = document.getElementById('clearAllBtn');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.clearAll();
            });
        }

        // Global event delegation for dynamically created popup buttons
        document.addEventListener('click', (e) => {
            // Receptor edit buttons
            if (e.target.closest('.receptor-edit-btn')) {
                const receptorId = e.target.closest('.receptor-edit-btn').dataset.receptorId;
                this.editReceptor(parseInt(receptorId));
            }
            
            // Receptor delete buttons
            if (e.target.closest('.receptor-delete-btn')) {
                const receptorId = e.target.closest('.receptor-delete-btn').dataset.receptorId;
                this.deleteReceptor(parseInt(receptorId));
            }
            
            // Release details buttons
            if (e.target.closest('.release-details-btn')) {
                const releaseId = e.target.closest('.release-details-btn').dataset.releaseId;
                this.viewReleaseDetails(parseInt(releaseId));
            }
            
            // Release stop buttons
            if (e.target.closest('.release-stop-btn')) {
                const releaseId = e.target.closest('.release-stop-btn').dataset.releaseId;
                this.stopRelease(parseInt(releaseId));
            }
            
            // Reload button in error dialog
            if (e.target.closest('.reload-btn')) {
                window.location.reload();
            }
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
        const modal = document.getElementById('receptorModal');
        if (modal) {
            modal.classList.add('show');
        }
    }

    /**
     * Close modal
     */
    closeModal(modal) {
        if (modal) {
            modal.classList.remove('show');
        }
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
            const location = window.MapManager.selectedLocation;
            
            if (!location) {
                this.showToast('Please select a location on the map', 'error');
                return;
            }

            // Get form values directly by ID since form elements don't have name attributes
            const chemicalSelect = document.getElementById('chemicalSelect');
            const releaseTypeSelect = document.getElementById('releaseType');
            const releaseRateInput = document.getElementById('releaseRate');
            const totalMassInput = document.getElementById('totalMass');
            const releaseHeightInput = document.getElementById('releaseHeight');
            const temperatureInput = document.getElementById('temperature');
            const durationInput = document.getElementById('duration');

            // Validate required fields
            if (!chemicalSelect.value) {
                this.showToast('Please select a chemical', 'error');
                return;
            }
            
            if (!releaseTypeSelect.value) {
                this.showToast('Please select a release type', 'error');
                return;
            }

            const releaseData = {
                chemical_id: parseInt(chemicalSelect.value),
                latitude: location.lat,
                longitude: location.lng,
                release_type: releaseTypeSelect.value,
                release_rate: releaseRateInput.value ? parseFloat(releaseRateInput.value) : null,
                total_mass: totalMassInput.value ? parseFloat(totalMassInput.value) : null,
                release_height: releaseHeightInput.value ? parseFloat(releaseHeightInput.value) : 1.0,
                temperature: temperatureInput.value ? parseFloat(temperatureInput.value) : null,
                duration: durationInput.value ? parseFloat(durationInput.value) : null,
                created_by: 'user'
            };

            const response = await API.createRelease(releaseData);
            this.currentRelease = response.release_event;

            // Display on map
            window.MapManager.displayRelease(response.release_event);

            // Close modal immediately after successful creation
            this.closeModal('releaseModal');
            this.showToast('Release created successfully', 'success');

            // Start dispersion calculation (run async in background)
            this.startDispersionCalculation(response.release_event.id).catch(error => {
                console.error('Error in background dispersion calculation:', error);
                this.showToast('Error in dispersion calculation, but release was created', 'warning');
            });

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

            this.closeModal('receptorModal');
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
            console.log('Starting dispersion calculation for release:', releaseId);
            
            // Wait a moment for the dispersion calculation to complete
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Get the latest calculation for this release
            const response = await API.getLatestCalculation(releaseId);
            
            console.log('Received API response:', response);
            
            // Extract calculation from response
            const calculation = response.calculation || response;
            
            console.log('Extracted calculation:', calculation);
            
            if (calculation && calculation.plume_geometry) {
                console.log('Displaying plume and updating UI...');
                window.MapManager.displayPlume(calculation);
                if (calculation.receptor_impacts) {
                    this.updateReceptorImpacts(calculation.receptor_impacts);
                }
                // Update model information display
                this.updateModelInformation(calculation);
                this.showToast('Dispersion calculation completed', 'success');
            } else {
                console.warn('No dispersion calculation found for release', releaseId);
                this.showToast('Dispersion calculation in progress...', 'info');
            }

        } catch (error) {
            console.error('Error getting dispersion calculation:', error);
            this.showToast('Error retrieving dispersion calculation', 'error');
        }
    }

    /**
     * Update receptor impacts display
     */
    updateReceptorImpacts(impacts) {
        const container = document.getElementById('receptorImpacts');
        
        // Check if container exists before trying to update it
        if (!container) {
            console.warn('receptorImpacts element not found in HTML');
            return;
        }
        
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
     * Update model information display
     */
    updateModelInformation(calculation) {
        const container = document.getElementById('modelData');
        const timestamp = document.getElementById('modelTimestamp');

        if (!calculation || !calculation.model_parameters) {
            container.innerHTML = '<p class="no-data">No dispersion calculation</p>';
            timestamp.textContent = '';
            return;
        }

        const params = calculation.model_parameters;
        const html = `
            <div class="model-info">
                <div class="info-item">
                    <strong>Model Type:</strong>
                    <span class="model-type">${calculation.calculation_method || 'Unknown'}</span>
                </div>
                <div class="info-item">
                    <strong>ALOHA Version:</strong>
                    <span>${params.aloha_version || '5.4.4'} Compatible</span>
                </div>
                <div class="info-item">
                    <strong>Stability Class:</strong>
                    <span class="stability-${params.stability_class?.toLowerCase()}">${params.stability_class || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <strong>Wind Speed:</strong>
                    <span>${params.wind_speed || 'N/A'} m/s</span>
                </div>
                <div class="info-item">
                    <strong>Emission Rate:</strong>
                    <span>${params.emission_rate || 'N/A'} kg/s</span>
                </div>
                <div class="info-item">
                    <strong>Density Ratio:</strong>
                    <span>${params.density_ratio ? params.density_ratio.toFixed(2) : 'N/A'}</span>
                </div>
                <div class="info-item">
                    <strong>Max Concentration:</strong>
                    <span>${Utils.formatConcentration(calculation.max_concentration)}</span>
                </div>
            </div>
        `;

        container.innerHTML = html;
        timestamp.textContent = calculation.calculation_time ? 
            `Updated: ${Utils.formatDate(calculation.calculation_time)}` : '';
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
                await API.updateReleaseStatus(releaseId, 'stopped');
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
        const container = document.getElementById('weatherData');
        
        if (!container) {
            console.warn('Weather display container not found');
            return;
        }
        
        if (!weather) {
            container.innerHTML = '<p class="no-data">No weather data available</p>';
            return;
        }

        // Calculate wind direction text
        const windDirectionText = this.getWindDirectionText(weather.wind_direction);
        
        container.innerHTML = `
            <div class="weather-item">
                <strong>Temperature:</strong> ${weather.temperature ? weather.temperature.toFixed(1) : 'N/A'}°C
            </div>
            <div class="weather-item">
                <strong>Wind Speed:</strong> ${weather.wind_speed ? weather.wind_speed.toFixed(1) : 'N/A'} m/s
            </div>
            <div class="weather-item">
                <strong>Wind Direction:</strong> ${weather.wind_direction ? weather.wind_direction.toFixed(0) : 'N/A'}° (${windDirectionText})
            </div>
            <div class="weather-item">
                <strong>Humidity:</strong> ${weather.humidity ? weather.humidity.toFixed(0) : 'N/A'}%
            </div>
            <div class="weather-item">
                <strong>Pressure:</strong> ${weather.pressure ? weather.pressure.toFixed(1) : 'N/A'} hPa
            </div>
            <div class="weather-item">
                <strong>Stability Class:</strong> ${weather.atmospheric_stability || 'N/A'}
            </div>
            <div class="weather-item">
                <strong>Mixing Height:</strong> ${weather.mixing_height ? weather.mixing_height.toFixed(0) : 'N/A'} m
            </div>
            <div class="weather-item">
                <strong>Updated:</strong> ${Utils.formatDate(weather.timestamp)}
            </div>
        `;

        // Update weather timestamp in header
        const timestampElement = document.getElementById('weatherTimestamp');
        if (timestampElement) {
            timestampElement.textContent = `Last updated: ${Utils.formatTime(weather.timestamp)}`;
        }

        // Store current weather for dispersion modeling
        this.currentWeather = weather;

        // Update any visible downwind corridors
        if (window.MapManager && window.MapManager.updateDownwindCorridor) {
            window.MapManager.updateDownwindCorridor(weather);
        }
    }

    /**
     * Convert wind direction degrees to compass direction
     */
    getWindDirectionText(degrees) {
        if (!degrees && degrees !== 0) return 'N/A';
        
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                           'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round(degrees / 22.5) % 16;
        return directions[index];
    }

    /**
     * Initialize GIS upload functionality
     */
    initGISUpload() {
        const uploadBtn = document.getElementById('uploadGISBtn');
        const modal = document.getElementById('gisUploadModal');
        const fileInput = document.getElementById('gisFileInput');
        const fileSelectLink = document.getElementById('gisFileSelectLink');
        const uploadArea = document.getElementById('gisFileUploadArea');
        const fileList = document.getElementById('gisFileList');
        const uploadButton = document.getElementById('gisUploadButton');
        
        if (!uploadBtn || !modal) {
            console.warn('GIS upload elements not found');
            return;
        }

        // Show modal when upload button is clicked
        uploadBtn.addEventListener('click', () => {
            modal.style.display = 'block';
            modal.classList.add('show');
            document.body.classList.add('modal-open');
        });

        // File selection
        fileSelectLink.addEventListener('click', (e) => {
            e.preventDefault();
            fileInput.click();
        });

        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const files = Array.from(e.dataTransfer.files);
            this.handleFileSelection(files);
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.handleFileSelection(files);
        });

        // Upload button
        uploadButton.addEventListener('click', () => {
            this.uploadGISFiles();
        });

        // Modal close buttons
        const closeButtons = modal.querySelectorAll('[data-dismiss="modal"], .close');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.closeModal('gisUploadModal');
            });
        });

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal('gisUploadModal');
            }
        });
    }

    /**
     * Handle file selection for GIS upload
     */
    handleFileSelection(files) {
        const fileList = document.getElementById('gisFileList');
        const uploadButton = document.getElementById('gisUploadButton');
        
        if (files.length === 0) {
            fileList.classList.add('hidden');
            uploadButton.disabled = true;
            return;
        }

        // Validate file types
        const validExtensions = ['.shp', '.dbf', '.shx', '.prj', '.kml', '.kmz', '.geojson', '.json', '.tif', '.tiff'];
        const validFiles = files.filter(file => {
            const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
            return validExtensions.includes(ext);
        });

        if (validFiles.length === 0) {
            this.showToast('No valid GIS files selected', 'error');
            return;
        }

        // Display selected files
        fileList.classList.remove('hidden');
        fileList.innerHTML = validFiles.map(file => `
            <div class="file-item" data-filename="${file.name}">
                <div class="file-info">
                    <i class="fas fa-file file-icon"></i>
                    <div class="file-details">
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${this.formatFileSize(file.size)}</div>
                    </div>
                </div>
                <button class="file-remove" onclick="UI.removeFile('${file.name}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        // Store files for upload
        this.selectedFiles = validFiles;
        uploadButton.disabled = false;
    }

    /**
     * Remove a file from selection
     */
    removeFile(filename) {
        if (!this.selectedFiles) return;
        
        this.selectedFiles = this.selectedFiles.filter(file => file.name !== filename);
        this.handleFileSelection(this.selectedFiles);
    }

    /**
     * Upload GIS files
     */
    async uploadGISFiles() {
        if (!this.selectedFiles || this.selectedFiles.length === 0) {
            this.showToast('No files selected', 'error');
            return;
        }

        const dataType = document.querySelector('input[name="gisDataType"]:checked').value;
        const progressSection = document.getElementById('gisUploadProgress');
        const progressBar = progressSection.querySelector('.progress-bar');
        const statusText = document.getElementById('gisUploadStatus');
        const uploadButton = document.getElementById('gisUploadButton');

        try {
            // Show progress
            progressSection.classList.remove('hidden');
            uploadButton.disabled = true;
            statusText.textContent = 'Preparing upload...';

            const formData = new FormData();
            this.selectedFiles.forEach(file => {
                formData.append('files', file);
            });
            formData.append('dataType', dataType);

            // Create XMLHttpRequest for progress tracking
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    progressBar.style.width = percentComplete + '%';
                    progressBar.setAttribute('aria-valuenow', percentComplete);
                    statusText.textContent = `Uploading... ${Math.round(percentComplete)}%`;
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        this.showToast(`Successfully uploaded ${response.featuresCount} features`, 'success');
                        this.closeModal('gisUploadModal');
                        
                        // Refresh map layers if available
                        if (window.mapManager) {
                            window.mapManager.refreshGISLayers();
                        }
                    } else {
                        throw new Error(response.error || 'Upload failed');
                    }
                } else {
                    throw new Error(`Upload failed with status ${xhr.status}`);
                }
            });

            xhr.addEventListener('error', () => {
                throw new Error('Network error during upload');
            });

            xhr.open('POST', '/api/gis/upload');
            xhr.send(formData);

        } catch (error) {
            console.error('Error uploading GIS files:', error);
            this.showToast('Error uploading GIS files: ' + error.message, 'error');
        } finally {
            uploadButton.disabled = false;
            setTimeout(() => {
                progressSection.classList.add('hidden');
                progressBar.style.width = '0%';
                statusText.textContent = 'Preparing upload...';
            }, 2000);
        }
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Close modal using vanilla JavaScript
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('show');
            document.body.classList.remove('modal-open');
            
            // Reset form if it's the GIS upload modal
            if (modalId === 'gisUploadModal') {
                this.resetGISUploadForm();
            }
        }
    }

    /**
     * Reset GIS upload form
     */
    resetGISUploadForm() {
        const fileInput = document.getElementById('gisFileInput');
        const fileList = document.getElementById('gisFileList');
        const uploadButton = document.getElementById('gisUploadButton');
        const progressSection = document.getElementById('gisUploadProgress');
        
        if (fileInput) fileInput.value = '';
        if (fileList) fileList.classList.add('hidden');
        if (uploadButton) uploadButton.disabled = true;
        if (progressSection) progressSection.classList.add('hidden');
        
        this.selectedFiles = [];
    }
}

// Create global UI instance
window.UI = new UIManager();