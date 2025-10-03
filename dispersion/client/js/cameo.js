/**
 * CAMEO Chemicals integration for chemical search and selection
 * Provides interface to NOAA CAMEO Chemicals database
 */

class CameoChemicals {
  constructor() {
    this.selectedChemical = null;
    this.searchResults = [];
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadRecommendations();
  }

  bindEvents() {
    // Open CAMEO search modal
    document.getElementById('searchCameoBtn').addEventListener('click', () => {
      this.openSearchModal();
    });

    // Search input handling
    const searchInput = document.getElementById('cameoSearchInput');
    const searchBtn = document.getElementById('cameoSearchSubmit');

    searchBtn.addEventListener('click', () => {
      this.performSearch();
    });

    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.performSearch();
      }
    });

    // Select chemical button
    document.getElementById('selectCameoChemical').addEventListener('click', () => {
      this.selectChemical();
    });

    // Recommendation scenario buttons
    document.querySelectorAll('[data-scenario]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.loadScenarioRecommendations(e.target.dataset.scenario);
      });
    });

    // Modal close handling
    document.querySelector('#cameoSearchModal .modal-close').addEventListener('click', () => {
      this.closeSearchModal();
    });
  }

  openSearchModal() {
    document.getElementById('cameoSearchModal').classList.add('active');
    document.getElementById('cameoSearchInput').focus();
    
    // Show recommendations by default
    document.getElementById('cameoRecommendations').classList.remove('hidden');
  }

  closeSearchModal() {
    document.getElementById('cameoSearchModal').classList.remove('active');
    this.clearSearch();
  }

  clearSearch() {
    document.getElementById('cameoSearchInput').value = '';
    document.getElementById('cameoSearchResults').classList.add('hidden');
    document.getElementById('cameoChemicalDetails').classList.add('hidden');
    document.getElementById('selectCameoChemical').disabled = true;
    this.selectedChemical = null;
  }

  async performSearch() {
    const query = document.getElementById('cameoSearchInput').value.trim();
    
    if (!query) {
      showToast('Please enter a search term', 'warning');
      return;
    }

    showLoading('Searching CAMEO Chemicals database...');

    try {
      const response = await fetch(`/api/chemicals/cameo/search?q=${encodeURIComponent(query)}&limit=10`);
      const data = await response.json();

      hideLoading();

      if (data.success) {
        this.displaySearchResults(data.chemicals);
      } else {
        showToast(`Search failed: ${data.message}`, 'error');
      }
    } catch (error) {
      hideLoading();
      console.error('Search error:', error);
      showToast('Search failed. Please try again.', 'error');
    }
  }

  displaySearchResults(results) {
    this.searchResults = results;
    const resultsContainer = document.getElementById('cameoResultsList');
    const searchResultsDiv = document.getElementById('cameoSearchResults');

    if (results.length === 0) {
      resultsContainer.innerHTML = '<p class="no-results">No chemicals found matching your search.</p>';
      searchResultsDiv.classList.remove('hidden');
      return;
    }

    resultsContainer.innerHTML = results.map(chemical => `
      <div class="result-item" data-cameo-id="${chemical.cameo_id}">
        <div class="result-header">
          <h5>${chemical.name}</h5>
          <span class="cas-number">${chemical.cas_number || 'No CAS'}</span>
        </div>
        <div class="result-details">
          <span class="formula">${chemical.formula || ''}</span>
          <span class="physical-state">${chemical.physical_state || ''}</span>
          <span class="hazard-class">${chemical.hazard_class || ''}</span>
        </div>
        <button class="btn btn-sm btn-outline select-result-btn" data-cameo-id="${chemical.cameo_id}">
          Select
        </button>
      </div>
    `).join('');

    // Bind click events to result items
    resultsContainer.querySelectorAll('.select-result-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cameoId = e.target.dataset.cameoId;
        this.selectFromResults(cameoId);
      });
    });

    searchResultsDiv.classList.remove('hidden');
  }

  async selectFromResults(cameoId) {
    showLoading('Loading chemical properties...');

    try {
      const response = await fetch(`/api/chemicals/cameo/${cameoId}`);
      const data = await response.json();

      hideLoading();

      if (data.success) {
        this.selectedChemical = data.chemical;
        this.displayChemicalDetails(data.chemical);
        
        // Validate chemical for dispersion modeling
        await this.validateChemical(data.chemical);
      } else {
        showToast(`Failed to load chemical: ${data.message}`, 'error');
      }
    } catch (error) {
      hideLoading();
      console.error('Chemical load error:', error);
      showToast('Failed to load chemical properties.', 'error');
    }
  }

  displayChemicalDetails(chemical) {
    // Basic information
    document.getElementById('cameoChemName').textContent = chemical.name || '-';
    document.getElementById('cameoCasNumber').textContent = chemical.cas_number || '-';
    document.getElementById('cameoFormula').textContent = chemical.formula || '-';
    document.getElementById('cameoMolWeight').textContent = chemical.molecular_weight || '-';
    document.getElementById('cameoPhysicalState').textContent = chemical.physical_state || '-';

    // Physical properties
    document.getElementById('cameoBoilingPoint').textContent = chemical.boiling_point || '-';
    document.getElementById('cameoVaporPressure').textContent = chemical.vapor_pressure || '-';
    document.getElementById('cameoDensity').textContent = chemical.density || '-';
    document.getElementById('cameoVolatilityClass').textContent = chemical.volatility_class || '-';

    // Safety properties
    document.getElementById('cameoIdlh').textContent = chemical.idlh || '-';
    document.getElementById('cameoTwa').textContent = chemical.twa || '-';
    document.getElementById('cameoHazardClass').textContent = chemical.hazard_classification || '-';
    document.getElementById('cameoHeavyGas').textContent = chemical.is_heavy_gas ? 'Yes' : 'No';

    // Data quality
    const qualityScore = chemical.quality_score || 0;
    document.getElementById('cameoQualityScore').textContent = `${(qualityScore * 100).toFixed(0)}%`;
    document.getElementById('cameoDataSource').textContent = chemical.data_source || 'CAMEO Chemicals';

    // Show details section
    document.getElementById('cameoChemicalDetails').classList.remove('hidden');
    document.getElementById('selectCameoChemical').disabled = false;
  }

  async validateChemical(chemical) {
    try {
      const response = await fetch('/api/chemicals/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chemical_id: chemical.cameo_id
        })
      });

      const data = await response.json();

      if (data.success) {
        const validation = data.validation;
        document.getElementById('cameoDispersionReady').textContent = validation.dispersion_ready ? 'Yes' : 'No';
        
        // Update quality indicator based on validation
        const qualityElement = document.getElementById('cameoQualityScore');
        const quality = validation.quality_score || 0;
        qualityElement.textContent = `${(quality * 100).toFixed(0)}%`;
        
        if (quality >= 0.8) {
          qualityElement.className = 'quality-high';
        } else if (quality >= 0.6) {
          qualityElement.className = 'quality-medium';
        } else {
          qualityElement.className = 'quality-low';
        }

        // Show warnings for missing data
        if (validation.missing_required.length > 0) {
          const warnings = validation.missing_required.map(item => item.field).join(', ');
          showToast(`Warning: Missing required data for accurate modeling: ${warnings}`, 'warning');
        }
      }
    } catch (error) {
      console.error('Validation error:', error);
      // Non-critical error, continue without validation
    }
  }

  selectChemical() {
    if (!this.selectedChemical) {
      showToast('No chemical selected', 'warning');
      return;
    }

    // Add chemical to the local database and selection dropdown
    this.addChemicalToSelection(this.selectedChemical);
    
    // Close modal
    this.closeSearchModal();
    
    showToast(`Selected ${this.selectedChemical.name} from CAMEO database`, 'success');
  }

  async addChemicalToSelection(chemical) {
    try {
      // Add to local chemicals database via API
      const response = await fetch('/api/chemicals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cameo_id: chemical.cameo_id,
          name: chemical.name,
          cas_number: chemical.cas_number,
          formula: chemical.formula,
          molecular_weight: chemical.molecular_weight,
          density: chemical.density,
          vapor_pressure: chemical.vapor_pressure,
          boiling_point: chemical.boiling_point,
          melting_point: chemical.melting_point,
          physical_state: chemical.physical_state,
          volatility_class: chemical.volatility_class,
          toxicity_data: {
            twa: chemical.twa,
            stel: chemical.stel,
            idlh: chemical.idlh,
            lc50: chemical.lc50
          },
          safety_data: {
            flash_point: chemical.flash_point,
            explosive_limits: chemical.explosive_limits,
            hazard_classification: chemical.hazard_classification,
            quality_score: chemical.quality_score
          }
        })
      });

      const data = await response.json();

      if (data.success) {
        // Add to chemical select dropdown
        const select = document.getElementById('chemicalSelect');
        const option = new Option(`${chemical.name} (CAMEO)`, data.chemical.id);
        select.add(option);
        select.value = data.chemical.id;

        // Trigger change event to update form
        select.dispatchEvent(new Event('change'));
      }
    } catch (error) {
      console.error('Error adding chemical:', error);
      showToast('Failed to add chemical to database', 'error');
    }
  }

  async loadScenarioRecommendations(scenario) {
    showLoading('Loading recommendations...');

    try {
      const response = await fetch(`/api/chemicals/recommendations/${scenario}?hazard_level=medium`);
      const data = await response.json();

      hideLoading();

      if (data.success) {
        this.displayRecommendations(data.recommendations, scenario);
      } else {
        showToast(`Failed to load recommendations: ${data.message}`, 'error');
      }
    } catch (error) {
      hideLoading();
      console.error('Recommendations error:', error);
      showToast('Failed to load recommendations.', 'error');
    }
  }

  displayRecommendations(recommendations, scenario) {
    const container = document.getElementById('recommendationsList');
    
    if (recommendations.length === 0) {
      container.innerHTML = `<p class="no-recommendations">No recommendations available for ${scenario}.</p>`;
      return;
    }

    container.innerHTML = `
      <h5>Common chemicals for ${scenario.replace('_', ' ')} scenarios:</h5>
      <div class="recommendations-grid">
        ${recommendations.map(chemical => `
          <div class="recommendation-item" data-cameo-id="${chemical.cameo_id}">
            <div class="rec-header">
              <strong>${chemical.name}</strong>
              <span class="rec-formula">${chemical.formula || ''}</span>
            </div>
            <div class="rec-properties">
              <span class="rec-state">${chemical.physical_state || ''}</span>
              <span class="rec-hazard">${chemical.hazard_classification || ''}</span>
            </div>
            <button class="btn btn-sm btn-primary select-rec-btn" data-cameo-id="${chemical.cameo_id}">
              Select
            </button>
          </div>
        `).join('')}
      </div>
    `;

    // Bind click events
    container.querySelectorAll('.select-rec-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cameoId = e.target.dataset.cameoId;
        this.selectFromResults(cameoId);
      });
    });
  }

  loadRecommendations() {
    // Show recommendations section by default
    document.getElementById('cameoRecommendations').classList.remove('hidden');
  }
}

// Initialize CAMEO functionality when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('searchCameoBtn')) {
    window.cameoChemicals = new CameoChemicals();
  }
});