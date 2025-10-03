// Main application initialization

class App {
    constructor() {
        this.isInitialized = false;
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log('Starting Chemical Dispersion Modeler...');

            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }

            // Initialize components in order
            await this.initializeComponents();

            // Start real-time updates
            this.startPeriodicUpdates();

            this.isInitialized = true;
            console.log('Application initialized successfully');

        } catch (error) {
            console.error('Error initializing application:', error);
            this.handleInitializationError(error);
        }
    }

    /**
     * Initialize application components
     */
    async initializeComponents() {
        // Initialize map first
        if (window.MapManager) {
            window.MapManager.init();
        } else {
            throw new Error('MapManager not found');
        }

        // Initialize UI
        if (window.UI) {
            window.UI.init();
        } else {
            throw new Error('UI not found');
        }

        // Initialize WebSocket connection
        if (window.WebSocketManager) {
            window.WebSocketManager.init();
        } else {
            console.warn('WebSocket manager not found - real-time updates disabled');
        }

        // Load initial data
        await this.loadInitialData();
    }

    /**
     * Load initial application data
     */
    async loadInitialData() {
        try {
            // Load current weather
            await this.loadCurrentWeather();

            // Load existing receptors
            await this.loadReceptors();

            // Check for active releases
            await this.loadActiveReleases();

        } catch (error) {
            console.error('Error loading initial data:', error);
            if (window.UI) {
                window.UI.showToast('Error loading initial data', 'warning');
            }
        }
    }

    /**
     * Load current weather data
     */
    async loadCurrentWeather() {
        try {
            // Get center point of map for weather
            const center = window.MapManager.map.getCenter();
            const weather = await API.getCurrentWeather(center.lat, center.lng);
            
            if (weather && window.UI) {
                window.UI.updateWeatherDisplay(weather);
            }
        } catch (error) {
            console.error('Error loading weather:', error);
        }
    }

    /**
     * Load existing receptors
     */
    async loadReceptors() {
        try {
            const bounds = window.MapManager.getCurrentBounds();
            await window.MapManager.loadReceptors(bounds);
        } catch (error) {
            console.error('Error loading receptors:', error);
        }
    }

    /**
     * Load active releases
     */
    async loadActiveReleases() {
        try {
            const response = await API.getActiveReleases();
            
            if (response.releases && response.releases.length > 0) {
                response.releases.forEach(release => {
                    window.MapManager.displayRelease(release);
                    
                    // Set current release if only one active
                    if (response.releases.length === 1 && window.UI) {
                        window.UI.currentRelease = release;
                    }
                });

                // Load dispersion calculations for active releases
                await this.loadActiveDispersions();
            }
        } catch (error) {
            console.error('Error loading active releases:', error);
        }
    }

    /**
     * Load active dispersion calculations
     */
    async loadActiveDispersions() {
        try {
            const response = await API.getActiveDispersions();
            
            if (response.calculations && response.calculations.length > 0) {
                response.calculations.forEach(calculation => {
                    window.MapManager.displayPlume(calculation);
                    
                    if (calculation.receptor_impacts && window.UI) {
                        window.UI.updateReceptorImpacts(calculation.receptor_impacts);
                    }
                });
            }
        } catch (error) {
            console.error('Error loading active dispersions:', error);
        }
    }

    /**
     * Start periodic updates (every 30 seconds as specified)
     */
    startPeriodicUpdates() {
        // Update weather and recalculate dispersions every 30 seconds
        setInterval(async () => {
            try {
                await this.performPeriodicUpdate();
            } catch (error) {
                console.error('Error in periodic update:', error);
            }
        }, 30000); // 30 seconds

        console.log('Periodic updates started (30 second interval)');
    }

    /**
     * Perform periodic update
     */
    async performPeriodicUpdate() {
        // Only update if we have an active release
        if (!window.UI || !window.UI.currentRelease) {
            return;
        }

        console.log('Performing periodic update...');

        try {
            // Get current map center for weather update
            const center = window.MapManager.map.getCenter();
            const weather = await API.getCurrentWeather(center.lat, center.lng);
            
            if (weather && window.UI) {
                window.UI.updateWeatherDisplay(weather);
            }

            // Recalculate dispersion with new weather
            if (window.UI.currentRelease) {
                const calculation = await API.calculateDispersion(window.UI.currentRelease.id);
                
                if (calculation.plume_geometry) {
                    window.MapManager.displayPlume(calculation);
                }
                
                if (calculation.receptor_impacts) {
                    window.UI.updateReceptorImpacts(calculation.receptor_impacts);
                }
            }

        } catch (error) {
            console.error('Error in periodic update:', error);
        }
    }

    /**
     * Handle initialization errors
     */
    handleInitializationError(error) {
        const errorMessage = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #fff;
                padding: 20px;
                border: 2px solid #f44336;
                border-radius: 8px;
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                z-index: 10000;
                max-width: 400px;
                text-align: center;
            ">
                <h3 style="color: #f44336; margin-top: 0;">
                    <i class="fas fa-exclamation-triangle"></i>
                    Application Error
                </h3>
                <p>Failed to initialize the Chemical Dispersion Modeler:</p>
                <p style="color: #666; font-family: monospace; font-size: 12px;">
                    ${error.message}
                </p>
                <p>Please refresh the page and try again.</p>
                <button onclick="window.location.reload()" style="
                    background: #f44336;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                ">
                    Refresh Page
                </button>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', errorMessage);
    }

    /**
     * Get application status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            components: {
                map: window.MapManager ? window.MapManager.isInitialized : false,
                ui: window.UI ? window.UI.isInitialized : false,
                websocket: window.WebSocketManager ? window.WebSocketManager.getStatus() : null
            }
        };
    }

    /**
     * Graceful shutdown
     */
    shutdown() {
        console.log('Shutting down application...');

        if (window.WebSocketManager) {
            window.WebSocketManager.disconnect();
        }

        this.isInitialized = false;
        console.log('Application shutdown complete');
    }
}

// Create and initialize the application
window.App = new App();

// Auto-initialize when script loads
window.App.init();

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.App) {
        window.App.shutdown();
    }
});

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    if (window.UI && window.UI.isInitialized) {
        window.UI.showToast('An unexpected error occurred', 'error');
    }
});

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    if (window.UI && window.UI.isInitialized) {
        window.UI.showToast('An unexpected error occurred', 'error');
    }
});