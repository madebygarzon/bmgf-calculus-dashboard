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
        period: 'Fall 2025',
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

    // Complete state/jurisdiction dictionary used by the "State" filter.
    const STATE_CODE_MAP = Object.freeze({
        'Alabama': 'AL',
        'Alaska': 'AK',
        'Arizona': 'AZ',
        'Arkansas': 'AR',
        'California': 'CA',
        'Colorado': 'CO',
        'Connecticut': 'CT',
        'Delaware': 'DE',
        'District of Columbia': 'DC',
        'Florida': 'FL',
        'Georgia': 'GA',
        'Guam': 'GU',
        'Hawaii': 'HI',
        'Idaho': 'ID',
        'Illinois': 'IL',
        'Indiana': 'IN',
        'Iowa': 'IA',
        'Kansas': 'KS',
        'Kentucky': 'KY',
        'Louisiana': 'LA',
        'Maine': 'ME',
        'Maryland': 'MD',
        'Massachusetts': 'MA',
        'Michigan': 'MI',
        'Minnesota': 'MN',
        'Mississippi': 'MS',
        'Missouri': 'MO',
        'Montana': 'MT',
        'Nebraska': 'NE',
        'Nevada': 'NV',
        'New Hampshire': 'NH',
        'New Jersey': 'NJ',
        'New Mexico': 'NM',
        'New York': 'NY',
        'North Carolina': 'NC',
        'North Dakota': 'ND',
        'Ohio': 'OH',
        'Oklahoma': 'OK',
        'Oregon': 'OR',
        'Pennsylvania': 'PA',
        'Puerto Rico': 'PR',
        'Rhode Island': 'RI',
        'South Carolina': 'SC',
        'South Dakota': 'SD',
        'Tennessee': 'TN',
        'Texas': 'TX',
        'Utah': 'UT',
        'Vermont': 'VT',
        'Virginia': 'VA',
        'Washington': 'WA',
        'West Virginia': 'WV',
        'Wisconsin': 'WI',
        'Wyoming': 'WY'
    });

    const STATE_NAME_BY_CODE = Object.freeze(
        Object.fromEntries(Object.entries(STATE_CODE_MAP).map(([name, code]) => [code, name]))
    );

    // Expose dictionaries for cross-chart reuse.
    window.BMGF_STATE_CODE_MAP = STATE_CODE_MAP;
    window.BMGF_STATE_NAME_BY_CODE = STATE_NAME_BY_CODE;

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
        'Maine': 'New England', 'New Hampshire': 'New England', 'Vermont': 'New England',
        'Puerto Rico': 'Outlying', 'Guam': 'Outlying'
    };

    function getDashboardFilters() {
        return (window.BMGF_DATA && window.BMGF_DATA.filters && typeof window.BMGF_DATA.filters === 'object')
            ? window.BMGF_DATA.filters
            : {};
    }

    function uniqueCleanStrings(values) {
        const set = new Set();
        (Array.isArray(values) ? values : []).forEach(value => {
            if (value === undefined || value === null) return;
            const clean = String(value).trim();
            if (!clean || clean.toLowerCase() === 'all') return;
            set.add(clean);
        });
        return Array.from(set);
    }

    function normalizeCourseValue(value) {
        const raw = String(value || '').trim().toLowerCase();
        if (!raw) return '';
        if (raw === 'calc i' || raw === 'calculus i' || raw === 'calc_i') return 'Calc I';
        if (raw === 'calc ii' || raw === 'calculus ii' || raw === 'calc_ii') return 'Calc II';
        if (raw.includes('calc') && raw.includes('ii') && !raw.includes('iii')) return 'Calc II';
        if (raw.includes('calc') && raw.includes('i')) return 'Calc I';
        return '';
    }

    function normalizeRegionValue(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const base = raw.replace(/\s*\(.*\)\s*$/, '');
        const lower = base.toLowerCase();
        if (lower.includes('other u.s.') || lower.includes('outlying')) return 'Outlying';
        return base;
    }

    function getOptionsForFilter(filterName) {
        const dashboardFilters = getDashboardFilters();

        if (filterName === 'state') {
            return Object.keys(STATE_CODE_MAP)
                .sort((a, b) => a.localeCompare(b))
                .map(stateName => ({
                    value: stateName,
                    label: stateName + ' (' + STATE_CODE_MAP[stateName] + ')'
                }));
        }

        if (filterName === 'course') {
            const normalized = uniqueCleanStrings(dashboardFilters.courses)
                .map(normalizeCourseValue)
                .filter(Boolean);
            const uniqueCourses = Array.from(new Set(normalized));
            const ordered = ['Calc I', 'Calc II'].filter(course => uniqueCourses.includes(course));
            return (ordered.length > 0 ? ordered : ['Calc I', 'Calc II']).map(course => ({ value: course, label: course }));
        }

        if (filterName === 'sector') {
            return uniqueCleanStrings(dashboardFilters.sectors)
                .sort((a, b) => a.localeCompare(b))
                .map(sector => ({ value: sector, label: sector }));
        }

        if (filterName === 'region') {
            const regions = uniqueCleanStrings(dashboardFilters.regions)
                .map(normalizeRegionValue)
                .filter(Boolean);
            return Array.from(new Set(regions))
                .sort((a, b) => a.localeCompare(b))
                .map(region => ({ value: region, label: region }));
        }

        if (filterName === 'publisher') {
            return uniqueCleanStrings(dashboardFilters.publishers)
                .sort((a, b) => a.localeCompare(b))
                .map(publisher => ({ value: publisher, label: publisher }));
        }

        return [];
    }

    function normalizeSavedFilterValue(filterName, savedValue) {
        if (savedValue === undefined || savedValue === null) return 'All';
        const text = String(savedValue).trim();
        if (!text) return 'All';

        if (filterName === 'state') {
            const upper = text.toUpperCase();
            if (STATE_NAME_BY_CODE[upper]) {
                return STATE_NAME_BY_CODE[upper];
            }
        }

        if (filterName === 'course') {
            return normalizeCourseValue(text) || 'All';
        }

        if (filterName === 'region') {
            return normalizeRegionValue(text) || 'All';
        }

        return text;
    }

    function setSelectOptions(select, filterName, options) {
        const selected = normalizeSavedFilterValue(filterName, currentFilters[filterName]);

        select.innerHTML = '';
        select.add(new Option('All', 'All'));
        options.forEach(option => {
            select.add(new Option(option.label, option.value));
        });

        const validValues = new Set(['All', ...options.map(option => option.value)]);
        const value = validValues.has(selected) ? selected : 'All';
        select.value = value;
        currentFilters[filterName] = value;
    }

    function populateDynamicFilterOptions() {
        const filterGroups = document.querySelectorAll('.filter-group');
        filterGroups.forEach(group => {
            const label = group.querySelector('.filter-label');
            const select = group.querySelector('.filter-select');
            if (!label || !select) return;

            const filterName = getFilterNameFromLabel(label.textContent.trim());
            if (!filterName) return;

            const options = getOptionsForFilter(filterName);
            if (options.length > 0) {
                setSelectOptions(select, filterName, options);
            } else {
                const normalized = normalizeSavedFilterValue(filterName, currentFilters[filterName]);
                currentFilters[filterName] = normalized;
                if (normalized && normalized !== 'All') {
                    select.value = normalized;
                }
            }
        });
    }

    // Get filtered data from stateData
    function getFilteredData() {
        const sourceData = (typeof stateData !== 'undefined' && Array.isArray(stateData))
            ? stateData
            : (window.BMGF_DATA && Array.isArray(window.BMGF_DATA.state_data) ? window.BMGF_DATA.state_data : []);

        if (!sourceData || sourceData.length === 0) {
            console.warn('stateData not available');
            return [];
        }

        const filtered = sourceData.filter(item => {
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

        let withPeriod = filtered;

        // Period filter projection over state-level period breakdown sourced from All_Courses.Period.
        if (currentFilters.period && currentFilters.period !== 'All') {
            const projected = filtered
                .map(item => {
                    const breakdown = item.period_breakdown || {};
                    const periodData = breakdown[currentFilters.period];
                    if (!periodData) return null;
                    return {
                        ...item,
                        total: Number(periodData.total) || 0,
                        calc_i: Number(periodData.calc_i) || 0,
                        calc_ii: Number(periodData.calc_ii) || 0,
                        courses: Number(periodData.courses) || 0
                    };
                })
                .filter(item => item && item.total > 0);

            // Fallback to full data when period breakdown is not available in the current dataset.
            withPeriod = projected.length > 0 ? projected : filtered;
        }

        // Course filter projection over aggregated state data.
        // We cannot split institution count by course here, but we can align enrollment metrics.
        if (currentFilters.course === 'Calc I') {
            return withPeriod.map(item => ({
                ...item,
                total: item.calc_i || 0,
                calc_ii: 0
            }));
        }

        if (currentFilters.course === 'Calc II') {
            return withPeriod.map(item => ({
                ...item,
                total: item.calc_ii || 0,
                calc_i: 0
            }));
        }

        return withPeriod;
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
                totalFTE: Number(k.total_fte_enrollment) || 0
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
            acc.fte += item.fte || 0;
            return acc;
        }, { institutions: 0, calcI: 0, calcII: 0, total: 0, fte: 0 });

        return {
            totalInstitutions: totals.institutions,
            totalEnrollment: totals.total,
            totalCalcI: totals.calcI,
            totalCalcII: totals.calcII,
            totalFTE: totals.fte
        };
    }

    // Format number for display
    function formatNumber(num) {
        return Number(num || 0).toLocaleString();
    }

    // Update KPI display elements
    function updateKPIDisplay(kpis) {
        const baseKpis = getBaseDashboardKpis();
        const useBase = !hasActiveFilters() && baseKpis;

        // Total Institutions is a global KPI and must stay fixed (not filter-dependent).
        const instEl = document.getElementById('kpi-institutions');
        if (instEl) {
            const hasBaseInstitutions = baseKpis && baseKpis.total_institutions !== undefined && baseKpis.total_institutions !== null;
            const value = hasBaseInstitutions ? baseKpis.total_institutions : kpis.totalInstitutions;
            instEl.textContent = formatNumber(value);
        }

        // Total Calculus Enrollment is a global KPI and must stay fixed (not filter-dependent).
        const calcEl = document.getElementById('kpi-calculus');
        if (calcEl) {
            const hasBaseTotal = baseKpis && baseKpis.total_enrollment !== undefined && baseKpis.total_enrollment !== null;
            const value = hasBaseTotal ? baseKpis.total_enrollment : kpis.totalEnrollment;
            calcEl.textContent = formatNumber(value);
        }

        // Update FTE
        const fteEl = document.getElementById('kpi-fte');
        if (fteEl) {
            const value = useBase ? baseKpis.total_fte_enrollment : kpis.totalFTE;
            fteEl.textContent = formatNumber(value);
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
        populateDynamicFilterOptions();

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

            // Reset period buttons to default period filter.
            const periodButtons = document.querySelectorAll('.btn-period');
            let defaultPeriodSet = false;
            periodButtons.forEach((btn, index) => {
                const text = (btn.getAttribute('data-period') || btn.textContent || '').toLowerCase();
                const isDefault = !defaultPeriodSet && (text.includes('fall') || index === 0);
                if (isDefault) {
                    btn.classList.add('active');
                    btn.classList.remove('inactive');
                    currentFilters.period = (btn.getAttribute('data-period') || 'Fall 2025').trim() || 'Fall 2025';
                    defaultPeriodSet = true;
                } else {
                    btn.classList.remove('active');
                    btn.classList.add('inactive');
                }
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
        if (!periodButtons || periodButtons.length === 0) return;

        function getPeriodValueFromButton(btn) {
            const attr = (btn.getAttribute('data-period') || '').trim();
            if (attr) return attr;

            const text = (btn.textContent || '').toLowerCase();
            if (text.includes('fall')) return 'Fall 2025';
            if (text.includes('spring')) return 'Spring 2025';
            if (text.includes('winter')) return 'Winter 2025';
            if (text.includes('summer')) return 'Summer 2025';
            return '';
        }

        let hasCurrent = false;
        periodButtons.forEach(btn => {
            const periodValue = getPeriodValueFromButton(btn);
            if (periodValue && periodValue === currentFilters.period) {
                hasCurrent = true;
            }
        });
        if (!hasCurrent) {
            const firstPeriod = getPeriodValueFromButton(periodButtons[0]);
            currentFilters.period = firstPeriod || 'All';
        }

        periodButtons.forEach(btn => {
            const periodValue = getPeriodValueFromButton(btn);
            if (!periodValue) return;

            if (periodValue === currentFilters.period) {
                btn.classList.add('active');
                btn.classList.remove('inactive');
            } else {
                btn.classList.remove('active');
                btn.classList.add('inactive');
            }

            btn.addEventListener('click', function() {
                // Remove active from all buttons
                periodButtons.forEach(b => {
                    b.classList.remove('active');
                    b.classList.add('inactive');
                });

                // Add active to clicked button
                this.classList.remove('inactive');
                this.classList.add('active');

                currentFilters.period = periodValue;
                applyFilters();

                // Dispatch event for period change
                window.dispatchEvent(new CustomEvent('bmgf:periodChanged', {
                    detail: { period: periodValue }
                }));
            });
        });
    }

    // Initialize institution checkboxes (if present)
    function initializeInstitutionList() {
        const institutionList = document.querySelector('.institution-list');
        if (!institutionList) return;

        const dashboardFilters = getDashboardFilters();
        const institutions = uniqueCleanStrings(dashboardFilters.institutions)
            .filter(name => name.toLowerCase() !== '(blank)')
            .sort((a, b) => a.localeCompare(b));

        if (institutions.length > 0) {
            institutionList.innerHTML = '';
            const allLabel = document.createElement('label');
            allLabel.className = 'institution-item';
            const allInput = document.createElement('input');
            allInput.type = 'checkbox';
            allInput.checked = true;
            allLabel.appendChild(allInput);
            allLabel.appendChild(document.createTextNode(' (All)'));
            institutionList.appendChild(allLabel);

            institutions.forEach(name => {
                const label = document.createElement('label');
                label.className = 'institution-item';
                const input = document.createElement('input');
                input.type = 'checkbox';
                label.appendChild(input);
                label.appendChild(document.createTextNode(' ' + name));
                institutionList.appendChild(label);
            });
        }

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
