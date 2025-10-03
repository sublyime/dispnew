// Utility functions for the Chemical Dispersion Modeler

/**
 * Format date to readable string
 */
function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
}

/**
 * Format number with appropriate units
 */
function formatNumber(number, decimals = 2) {
    if (number === null || number === undefined) return 'N/A';
    return parseFloat(number).toFixed(decimals);
}

/**
 * Format concentration with units
 */
function formatConcentration(concentration) {
    if (concentration === null || concentration === undefined) return 'N/A';
    
    const value = parseFloat(concentration);
    if (value >= 1000000) {
        return (value / 1000000).toFixed(2) + ' mg/m³';
    } else if (value >= 1000) {
        return (value / 1000).toFixed(2) + ' mg/m³';
    } else {
        return value.toFixed(2) + ' μg/m³';
    }
}

/**
 * Format distance with appropriate units
 */
function formatDistance(meters) {
    if (meters === null || meters === undefined) return 'N/A';
    
    const value = parseFloat(meters);
    if (value >= 1000) {
        return (value / 1000).toFixed(2) + ' km';
    } else {
        return value.toFixed(0) + ' m';
    }
}

/**
 * Format wind direction
 */
function formatWindDirection(degrees) {
    if (degrees === null || degrees === undefined) return 'N/A';
    
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index] + ' (' + Math.round(degrees) + '°)';
}

/**
 * Get health impact color
 */
function getHealthImpactColor(level) {
    const colors = {
        'negligible': '#ccffcc',
        'minimal': '#66ff66',
        'low': '#ffcc00',
        'moderate': '#ff6600',
        'high': '#ff3300',
        'severe': '#ff0000',
        'critical': '#990000'
    };
    return colors[level] || '#999999';
}

/**
 * Get concentration color based on value
 */
function getConcentrationColor(concentration) {
    const value = parseFloat(concentration) || 0;
    
    if (value >= 100000) return '#ff0000'; // Severe
    if (value >= 10000) return '#ff6600';  // High
    if (value >= 1000) return '#ffcc00';   // Moderate
    if (value >= 100) return '#66ff66';    // Low
    if (value >= 10) return '#ccffcc';     // Minimal
    return '#ffffff';                       // Negligible
}

/**
 * Debounce function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Show loading overlay
 */
function showLoading(message = 'Processing...') {
    const overlay = document.getElementById('loadingOverlay');
    const messageEl = document.getElementById('loadingMessage');
    messageEl.textContent = message;
    overlay.classList.remove('hidden');
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('hidden');
}

/**
 * Show toast notification
 */
function showToast(title, message, type = 'info', duration = 5000) {
    const container = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    toast.innerHTML = `
        <div class="toast-header">
            <span class="toast-title">${title}</span>
            <button class="toast-close">&times;</button>
        </div>
        <div class="toast-body">${message}</div>
    `;
    
    container.appendChild(toast);
    
    // Show toast
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Auto remove
    const autoRemove = setTimeout(() => removeToast(toast), duration);
    
    // Manual close
    toast.querySelector('.toast-close').addEventListener('click', () => {
        clearTimeout(autoRemove);
        removeToast(toast);
    });
}

/**
 * Remove toast notification
 */
function removeToast(toast) {
    toast.classList.remove('show');
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300);
}

/**
 * Validate coordinates
 */
function validateCoordinates(lat, lon) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    
    if (isNaN(latitude) || isNaN(longitude)) {
        return { valid: false, error: 'Invalid coordinate format' };
    }
    
    if (latitude < -90 || latitude > 90) {
        return { valid: false, error: 'Latitude must be between -90 and 90' };
    }
    
    if (longitude < -180 || longitude > 180) {
        return { valid: false, error: 'Longitude must be between -180 and 180' };
    }
    
    return { valid: true, lat: latitude, lon: longitude };
}

/**
 * Calculate distance between two points
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Deep clone object
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if point is inside polygon
 */
function pointInPolygon(point, polygon) {
    const x = point[0], y = point[1];
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    
    return inside;
}

/**
 * Export utilities to global scope
 */
window.Utils = {
    formatDate,
    formatNumber,
    formatConcentration,
    formatDistance,
    formatWindDirection,
    getHealthImpactColor,
    getConcentrationColor,
    debounce,
    showLoading,
    hideLoading,
    showToast,
    removeToast,
    validateCoordinates,
    calculateDistance,
    generateId,
    deepClone,
    formatFileSize,
    pointInPolygon
};