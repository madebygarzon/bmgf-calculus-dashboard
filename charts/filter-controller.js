/**
 * Filter Controller for BMGF Calculus Dashboard
 * Manages filter state, events, and updates KPIs/charts based on selections
 */

(function() {
    'use strict';

    // Filter state - stored in localStorage for persistence across pages
    const STORAGE_KEY = 'bmgf_dashboard_filters';

    // Default filter state
    const defaultFilters = {
        course: 'All',
        state: 'All',
        sector: 'All',
        region: 'All',
        publisher: 'All',
        msiType: 'All',
        priceRange: 'All'
    };

    // Load filters from localStorage or use defaults
    function loadFilters() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                return { ...defaultFilters, ...JSON.parse(stored) };
            }
        } catch (e) {
            console.warn('Could not load filters from localStorage:', e);
        }
        return { ...defaultFilters };
    }

    // Save filters to localStorage
    function saveFilters(filters) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
        } catch (e) {
            console.warn('Could not save filters to localStorage:', e);
        }
    }

    // Current filter state
    let currentFilters = loadFilters();

    function hasActiveFilters() {
        return Object.values(currentFilters).some(value => value !== 'All');
    }

    function getBaseDashboardKpis() {
        if (!window.BMGF_DATA || !window.BMGF_DATA.kpis) {
            return null;
        }
        return window.BMGF_DATA.kpis;
    }

    // Region mapping for states
    const stateToRegion = {
        'Florida': 'Southeast', 'Georgia': 'Southeast', 'Alabama': 'Southeast',
        'Mississippi': 'Southeast', 'Tennessee': 'Southeast', 'South Carolina': 'Southeast',
        'North Carolina': 'Southeast', 'Kentucky': 'Southeast', 'Virginia': 'Southeast',
        'West Virginia': 'Southeast', 'Louisiana': 'Southeast', 'Arkansas': 'Southeast',
        'California': 'Far West', 'Oregon': 'Far West', 'Washington': 'Far West',
        'Nevada': 'Far West', 'Alaska': 'Far West', 'Hawaii': 'Far West',
        'New York': 'Mid East', 'New Jersey': 'Mid East', 'Pennsylvania': 'Mid East',
        'Delaware': 'Mid East', 'Maryland': 'Mid East', 'District of Columbia': 'Mid East',
        'Michigan': 'Great Lakes', 'Ohio': 'Great Lakes', 'Indiana': 'Great Lakes',
        'Illinois': 'Great Lakes', 'Wisconsin': 'Great Lakes',
        'Texas': 'Southwest', 'Arizona': 'Southwest', 'New Mexico': 'Southwest', 'Oklahoma': 'Southwest',
        'Colorado': 'Rocky Mountains', 'Utah': 'Rocky Mountains', 'Wyoming': 'Rocky Mountains',
        'Montana': 'Rocky Mountains', 'Idaho': 'Rocky Mountains',
        'Minnesota': 'Plains', 'Iowa': 'Plains', 'Missouri': 'Plains', 'Kansas': 'Plains',
        'Nebraska': 'Plains', 'South Dakota': 'Plains', 'North Dakota': 'Plains',
        'Massachusetts': 'New England', 'Connecticut': 'New England', 'Rhode Island': 'New England',
        'Maine': 'New England', 'New Hampshire': 'New England', 'Vermont': 'New England'
    };

    // Get filtered data from stateData
    function getFilteredData() {
        if (typeof stateData === 'undefined') {
            console.warn('stateData not available');
            return [];
        }

        const filtered = stateData.filter(item => {
            // Filter by state
            if (currentFilters.state !== 'All' && item.state !== currentFilters.state) {
                return false;
            }

            // Filter by region
            if (currentFilters.region !== 'All') {
                const itemRegion = stateToRegion[item.state] || '';
                if (!itemRegion.toLowerCase().includes(currentFilters.region.toLowerCase())) {
                    return false;
                }
            }

            // Filter by publisher (check if any of the top 3 publishers match)
            if (currentFilters.publisher !== 'All') {
                const pubLower = currentFilters.publisher.toLowerCase();
                const hasPub = (item.pub1 && item.pub1.toLowerCase().includes(pubLower)) ||
                               (item.pub2 && item.pub2.toLowerCase().includes(pubLower)) ||
                               (item.pub3 && item.pub3.toLowerCase().includes(pubLower));
                if (!hasPub) {
                    return false;
                }
            }

            return true;
        });

        // Course filter projection over aggregated state data.
        // We cannot split institution count by course here, but we can align enrollment metrics.
        if (currentFilters.course === 'Calc I') {
            return filtered.map(item => ({
                ...item,
                total: item.calc_i || 0,
                calc_ii: 0
            }));
        }

        if (currentFilters.course === 'Calc II') {
            return filtered.map(item => ({
                ...item,
                total: item.calc_ii || 0,
                calc_i: 0
            }));
        }

        return filtered;
    }

    // Calculate KPIs from filtered data
    function calculateKPIs(filteredData) {
        const usingDashboardBaseKpis = !hasActiveFilters() &&
            window.BMGF_DATA &&
            window.BMGF_DATA.kpis;

        if (usingDashboardBaseKpis) {
            const k = window.BMGF_DATA.kpis;
            const totalEnrollment = Number(k.total_enrollment) || 0;
            return {
                totalInstitutions: Number(k.total_institutions) || 0,
                totalEnrollment: totalEnrollment,
                totalCalcI: Number(k.calc1_enrollment) || 0,
                totalCalcII: Number(k.calc2_enrollment) || 0,
                totalFTE: Math.round(totalEnrollment * 5.9)
            };
        }

        if (!filteredData || filteredData.length === 0) {
            return {
                totalInstitutions: 0,
                totalEnrollment: 0,
                totalCalcI: 0,
                totalCalcII: 0,
                totalFTE: 0
            };
        }

        const totals = filteredData.reduce((acc, item) => {
            acc.institutions += item.institutions || 0;
            acc.calcI += item.calc_i || 0;
            acc.calcII += item.calc_ii || 0;
            acc.total += item.total || 0;
            return acc;
        }, { institutions: 0, calcI: 0, calcII: 0, total: 0 });

        return {
            totalInstitutions: totals.institutions,
            totalEnrollment: totals.total,
            totalCalcI: totals.calcI,
            totalCalcII: totals.calcII,
            totalFTE: Math.round(totals.total * 5.9) // Approximate FTE multiplier
        };
    }

    // Format number for display
    function formatNumber(num) {
        return Number(num || 0).toLocaleString();
    }

    // Update KPI display elements
    function updateKPIDisplay(kpis) {
        const baseKpis = getBaseDashboardKpis();

        // Update institutions
        const instEl = document.getElementById('kpi-institutions');
        if (instEl) {
            const value = baseKpis ? baseKpis.total_institutions : kpis.totalInstitutions;
            instEl.textContent = formatNumber(value);
        }

        // Update total enrollment / calculus enrollment
        const calcEl = document.getElementById('kpi-calculus');
        if (calcEl) {
            const value = baseKpis ? baseKpis.total_enrollment : kpis.totalEnrollment;
            calcEl.textContent = formatNumber(value);
        }

        // Update FTE
        const fteEl = document.getElementById('kpi-fte');
        if (fteEl) {
            fteEl.textContent = formatNumber(kpis.totalFTE);
        }

        // Update regions (count unique regions in filtered data)
        const regionsEl = document.getElementById('kpi-regions');
        if (regionsEl) {
            const filteredData = getFilteredData();
            const uniqueRegions = new Set(filteredData.map(item => stateToRegion[item.state]).filter(Boolean));
            regionsEl.textContent = uniqueRegions.size;
        }
    }

    // Notify iframes about filter changes
    function notifyIframes() {
        const filteredData = getFilteredData();
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            try {
                iframe.contentWindow.postMessage({
                    type: 'BMGF_FILTER_UPDATE',
                    filters: currentFilters,
                    filteredData: filteredData
                }, '*');
            } catch (e) {
                console.warn('Could not post message to iframe:', e);
            }
        });
    }

    // Apply filters and update UI
    function applyFilters() {
        const filteredData = getFilteredData();
        const kpis = calculateKPIs(filteredData);

        updateKPIDisplay(kpis);
        saveFilters(currentFilters);
        notifyIframes();

        // Dispatch custom event for other components
        window.dispatchEvent(new CustomEvent('bmgf:filtersChanged', {
            detail: { filters: currentFilters, data: filteredData, kpis: kpis }
        }));
    }

    // Get filter name from label text
    function getFilterNameFromLabel(labelText) {
        const mapping = {
            'course name': 'course',
            'course': 'course',
            'state': 'state',
            'sector': 'sector',
            'region': 'region',
            'publisher': 'publisher',
            'msi type': 'msiType',
            'price range': 'priceRange'
        };
        return mapping[labelText.toLowerCase()] || null;
    }

    // Initialize filter select elements
    function initializeFilters() {
        const filterGroups = document.querySelectorAll('.filter-group');

        filterGroups.forEach(group => {
            const label = group.querySelector('.filter-label');
            const select = group.querySelector('.filter-select');

            if (!label || !select) return;

            const filterName = getFilterNameFromLabel(label.textContent.trim());
            if (!filterName) return;

            // Set initial value from saved state
            if (currentFilters[filterName] && currentFilters[filterName] !== 'All') {
                const options = select.querySelectorAll('option');
                options.forEach(opt => {
                    if (opt.textContent === currentFilters[filterName] || opt.value === currentFilters[filterName]) {
                        select.value = opt.value;
                    }
                });
            }

            // Add change listener
            select.addEventListener('change', function() {
                currentFilters[filterName] = this.value;
                applyFilters();

                // Update select styling based on selection
                if (this.value !== 'All') {
                    this.classList.add('active');
                } else {
                    this.classList.remove('active');
                }
            });

            // Set initial styling
            if (select.value !== 'All') {
                select.classList.add('active');
            }
        });
    }

    // Initialize Clear All button
    function initializeClearButton() {
        const clearBtn = document.querySelector('.btn-clear');
        if (!clearBtn) return;

        clearBtn.addEventListener('click', function() {
            // Reset all filters to defaults
            currentFilters = { ...defaultFilters };

            // Reset all select elements
            const selects = document.querySelectorAll('.filter-select');
            selects.forEach(select => {
                select.value = 'All';
                select.classList.remove('active');
            });

            applyFilters();

            // Add visual feedback for clear action
            clearBtn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                clearBtn.style.transform = '';
            }, 150);
        });
    }

    // Initialize period buttons (if present)
    function initializePeriodButtons() {
        const periodButtons = document.querySelectorAll('.btn-period');

        periodButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                // Remove active from all buttons
                periodButtons.forEach(b => {
                    b.classList.remove('active');
                    b.classList.add('inactive');
                });

                // Add active to clicked button
                this.classList.remove('inactive');
                this.classList.add('active');

                // Dispatch event for period change
                window.dispatchEvent(new CustomEvent('bmgf:periodChanged', {
                    detail: { period: this.textContent.trim() }
                }));
            });
        });
    }

    // Initialize institution checkboxes (if present)
    function initializeInstitutionList() {
        const institutionList = document.querySelector('.institution-list');
        if (!institutionList) return;

        const allCheckbox = institutionList.querySelector('.institution-item:first-child input[type="checkbox"]');
        const otherCheckboxes = institutionList.querySelectorAll('.institution-item:not(:first-child) input[type="checkbox"]');

        if (allCheckbox) {
            allCheckbox.addEventListener('change', function() {
                if (this.checked) {
                    // Uncheck all others when "All" is checked
                    otherCheckboxes.forEach(cb => cb.checked = false);
                }
                applyFilters();
            });
        }

        otherCheckboxes.forEach(cb => {
            cb.addEventListener('change', function() {
                if (this.checked && allCheckbox) {
                    // Uncheck "All" when individual is checked
                    allCheckbox.checked = false;
                }

                // If no individual is checked, check "All"
                const anyChecked = Array.from(otherCheckboxes).some(c => c.checked);
                if (!anyChecked && allCheckbox) {
                    allCheckbox.checked = true;
                }

                applyFilters();
            });
        });
    }

    // Initialize search input functionality
    function initializeSearchInput() {
        const searchInput = document.getElementById('institution-search');
        if (!searchInput) return;

        const institutionList = document.querySelector('.institution-list');
        if (!institutionList) return;

        const items = institutionList.querySelectorAll('.institution-item');

        // Debounce function for performance
        let debounceTimer;
        function debounce(func, delay) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(func, delay);
        }

        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();

            debounce(() => {
                let firstMatch = null;

                items.forEach((item, index) => {
                    // Skip the "(All)" option
                    if (index === 0) {
                        item.style.display = '';
                        item.style.backgroundColor = '';
                        return;
                    }

                    const text = item.textContent.toLowerCase();

                    if (searchTerm === '') {
                        // Show all items when search is empty
                        item.style.display = '';
                        item.style.backgroundColor = '';
                    } else if (text.includes(searchTerm)) {
                        // Show and highlight matching items
                        item.style.display = '';
                        item.style.backgroundColor = '#D3DEF6';
                        if (!firstMatch) {
                            firstMatch = item;
                        }
                    } else {
                        // Hide non-matching items
                        item.style.display = 'none';
                        item.style.backgroundColor = '';
                    }
                });

                // Scroll to first match
                if (firstMatch) {
                    firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 150);
        });

        // Clear highlights when input loses focus and is empty
        searchInput.addEventListener('blur', function() {
            if (this.value.trim() === '') {
                items.forEach(item => {
                    item.style.display = '';
                    item.style.backgroundColor = '';
                });
            }
        });
    }

    // Main initialization
    function init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initAll);
        } else {
            initAll();
        }
    }

    function initAll() {
        initializeFilters();
        initializeClearButton();
        initializePeriodButtons();
        initializeInstitutionList();
        initializeSearchInput();

        // Apply initial filters
        applyFilters();

        console.log('BMGF Filter Controller initialized');
    }

    // Listen for filter requests from iframes
    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'BMGF_REQUEST_FILTERS') {
            // Send current filters to the requesting iframe
            if (event.source) {
                try {
                    event.source.postMessage({
                        type: 'BMGF_FILTER_UPDATE',
                        filters: currentFilters,
                        filteredData: getFilteredData()
                    }, '*');
                } catch (e) {
                    console.warn('Could not respond to filter request:', e);
                }
            }
        }
    });

    // Expose API for external use
    window.BMGFFilters = {
        getFilters: () => ({ ...currentFilters }),
        setFilter: (name, value) => {
            if (name in currentFilters) {
                currentFilters[name] = value;
                applyFilters();
            }
        },
        clearFilters: () => {
            currentFilters = { ...defaultFilters };
            applyFilters();
        },
        getFilteredData: getFilteredData,
        applyFilters: applyFilters
    };

    // Start initialization
    init();

})();
