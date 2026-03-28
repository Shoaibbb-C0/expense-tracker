/* ================================================================
   CONFIG
   ================================================================ */
var CONFIG = {
    currency: '₹',
    defaultFilter: 'All',
    storageKeys: {
        expenses: 'expenses',
        nextId: 'nextId'
    }
};

var CATEGORIES = [
    { name: 'Food',          icon: '🍔', color: '#EF4444', bg: '#FEF2F2' },
    { name: 'Transport',     icon: '🚗', color: '#06B6D4', bg: '#ECFEFF' },
    { name: 'Shopping',      icon: '🛍️', color: '#F59E0B', bg: '#FFFBEB' },
    { name: 'Entertainment', icon: '🎮', color: '#8B5CF6', bg: '#F5F3FF' },
    { name: 'Bills',         icon: '💡', color: '#EC4899', bg: '#FDF2F8' },
    { name: 'Health',        icon: '🏥', color: '#10B981', bg: '#ECFDF5' },
    { name: 'Education',     icon: '📚', color: '#3B82F6', bg: '#EFF6FF' },
    { name: 'Other',         icon: '📦', color: '#6B7280', bg: '#F9FAFB' }
];


/* ================================================================
   STATE
   ================================================================ */
var state = {
    expenses: [],
    activeFilter: CONFIG.defaultFilter,
    searchText: '',
    nextId: 1
};


/* ================================================================
   DOM REFERENCES
   ================================================================ */
var dom = {
    // Form
    amountInput:    document.getElementById('amountInput'),
    categorySelect: document.getElementById('categorySelect'),
    descInput:      document.getElementById('descInput'),
    addBtn:         document.getElementById('addBtn'),
    errorMsg:       document.getElementById('errorMsg'),

    // Search & filter
    searchInput:     document.getElementById('searchInput'),
    searchClear:     document.getElementById('searchClear'),
    filterDropdown:  document.getElementById('filterDropdown'),
    resultsInfo:     document.getElementById('resultsInfo'),
    resultsCount:    document.getElementById('resultsCount'),
    clearFiltersBtn: document.getElementById('clearFiltersBtn'),

    // List & tabs
    filterTabs:  document.getElementById('filterTabs'),
    expenseList: document.getElementById('expenseList'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    totalBar:    document.getElementById('totalBar'),

    // Summary
    totalSpent:   document.getElementById('totalSpent'),
    expenseCount: document.getElementById('expenseCount'),
    avgExpense:   document.getElementById('avgExpense'),

    // Breakdown
    breakdownCard: document.getElementById('breakdownCard'),
    breakdownList: document.getElementById('breakdownList'),

    // Status
    saveStatus: document.getElementById('saveStatus')
};


/* ================================================================
   INITIALIZATION
   ================================================================ */
function init() {
    populateDropdowns();
    loadFromStorage();
    attachEventListeners();
    renderAll();
}


/* ================================================================
   DROPDOWN POPULATION
   Fills both the "add form" dropdown and "filter" dropdown
   ================================================================ */
function populateDropdowns() {
    for (var i = 0; i < CATEGORIES.length; i++) {
        var cat = CATEGORIES[i];
        var label = cat.icon + '  ' + cat.name;

        // Add to form dropdown
        var opt1 = document.createElement('option');
        opt1.value = cat.name;
        opt1.textContent = label;
        dom.categorySelect.appendChild(opt1);

        // Add to filter dropdown
        var opt2 = document.createElement('option');
        opt2.value = cat.name;
        opt2.textContent = label;
        dom.filterDropdown.appendChild(opt2);
    }
}


/* ================================================================
   EVENT LISTENERS
   All event binding happens here — no inline onclick in HTML
   ================================================================ */
function attachEventListeners() {

    // Add expense: button click and Enter key in form fields
    dom.addBtn.addEventListener('click', handleAddExpense);
    dom.amountInput.addEventListener('keypress', onEnterKey(handleAddExpense));
    dom.descInput.addEventListener('keypress', onEnterKey(handleAddExpense));

    // Search: live input and clear button
    dom.searchInput.addEventListener('input', handleSearchInput);
    dom.searchClear.addEventListener('click', handleClearSearch);

    // Filter dropdown change
    dom.filterDropdown.addEventListener('change', handleFilterDropdown);

    // Clear filters link
    dom.clearFiltersBtn.addEventListener('click', handleClearFilters);

    // Clear all expenses
    dom.clearAllBtn.addEventListener('click', handleClearAll);

    // Event delegation: filter tabs (dynamically created buttons)
    dom.filterTabs.addEventListener('click', function(e) {
        var tab = e.target.closest('.filter-tab');
        if (!tab) return;

        var category = tab.getAttribute('data-category');
        if (category) {
            setFilter(category);
        }
    });

    // Event delegation: delete buttons (dynamically created)
    dom.expenseList.addEventListener('click', function(e) {
        var btn = e.target.closest('.delete-btn');
        if (!btn) return;

        var id = parseInt(btn.getAttribute('data-id'));
        if (!isNaN(id)) {
            deleteExpense(id);
        }
    });
}

// Helper: returns a keypress handler that calls fn on Enter
function onEnterKey(fn) {
    return function(e) {
        if (e.key === 'Enter') fn();
    };
}


/* ================================================================
   EVENT HANDLERS
   ================================================================ */
function handleAddExpense() {
    var amount   = parseFloat(dom.amountInput.value);
    var category = dom.categorySelect.value;
    var desc     = dom.descInput.value.trim();

    // Validation
    if (isNaN(amount) || amount <= 0) {
        return showError('Please enter a valid amount greater than 0.');
    }
    if (category === '') {
        return showError('Please select a category.');
    }

    showError('');
    addExpense(amount, category, desc);

    // Reset form
    dom.amountInput.value = '';
    dom.categorySelect.value = '';
    dom.descInput.value = '';
    dom.amountInput.focus();
}

function handleSearchInput() {
    state.searchText = dom.searchInput.value.trim().toLowerCase();
    toggleClass(dom.searchClear, 'hidden', state.searchText.length === 0);
    renderFiltered();
}

function handleClearSearch() {
    dom.searchInput.value = '';
    state.searchText = '';
    toggleClass(dom.searchClear, 'hidden', true);
    dom.searchInput.focus();
    renderFiltered();
}

function handleFilterDropdown() {
    state.activeFilter = dom.filterDropdown.value;
    renderFilterTabs();
    renderFiltered();
}

function handleClearFilters() {
    dom.searchInput.value = '';
    state.searchText = '';
    state.activeFilter = CONFIG.defaultFilter;
    dom.filterDropdown.value = CONFIG.defaultFilter;
    toggleClass(dom.searchClear, 'hidden', true);
    renderFilterTabs();
    renderFiltered();
}

function handleClearAll() {
    if (!confirm('Delete ALL expenses? This cannot be undone.')) return;

    state.expenses = [];
    state.activeFilter = CONFIG.defaultFilter;
    state.searchText = '';
    dom.searchInput.value = '';
    dom.filterDropdown.value = CONFIG.defaultFilter;
    toggleClass(dom.searchClear, 'hidden', true);
    saveToStorage();
    renderAll();
}


/* ================================================================
   CORE LOGIC
   ================================================================ */
function addExpense(amount, category, description) {
    state.expenses.push({
        id:          state.nextId++,
        amount:      amount,
        category:    category,
        description: description,
        date:        new Date().toISOString()
    });
    saveToStorage();
    renderAll();
}

function deleteExpense(id) {
    state.expenses = state.expenses.filter(function(exp) {
        return exp.id !== id;
    });
    saveToStorage();
    renderAll();
}

function setFilter(category) {
    state.activeFilter = category;
    dom.filterDropdown.value = category;
    renderFilterTabs();
    renderFiltered();
}

// Central filter function — single source of truth
function getFilteredExpenses() {
    var results = [];

    for (var i = 0; i < state.expenses.length; i++) {
        var exp = state.expenses[i];

        // Check category
        if (state.activeFilter !== CONFIG.defaultFilter &&
            exp.category !== state.activeFilter) {
            continue;
        }

        // Check search text
        if (state.searchText !== '') {
            var haystack = (exp.category + ' ' + exp.description + ' ' +
                           exp.amount.toFixed(2)).toLowerCase();

            if (haystack.indexOf(state.searchText) === -1) {
                continue;
            }
        }

        results.push(exp);
    }

    return results;
}


/* ================================================================
   RENDER FUNCTIONS
   ================================================================ */

// Render everything
function renderAll() {
    renderSummary();
    renderFilterTabs();
    renderFiltered();
    renderBreakdown();
    dom.clearAllBtn.style.display = state.expenses.length > 0 ? 'block' : 'none';
}

// Render only the parts affected by search/filter changes
function renderFiltered() {
    renderExpenseList();
    renderTotalBar();
    renderResultsInfo();
}

// Summary cards (always reflect ALL expenses, not filtered)
function renderSummary() {
    var total = sumExpenses(state.expenses);
    var count = state.expenses.length;
    var avg   = count > 0 ? total / count : 0;

    dom.totalSpent.textContent   = formatCurrency(total);
    dom.expenseCount.textContent = count;
    dom.avgExpense.textContent   = formatCurrency(avg);
}

// Filter tab buttons
function renderFilterTabs() {
    var counts = getCategoryCounts(state.expenses);
    var used   = Object.keys(counts);

    // Reset filter if active category no longer exists
    if (state.activeFilter !== CONFIG.defaultFilter &&
        used.indexOf(state.activeFilter) === -1) {
        state.activeFilter = CONFIG.defaultFilter;
        dom.filterDropdown.value = CONFIG.defaultFilter;
    }

    // Build "All" tab
    var html = buildTabHTML(CONFIG.defaultFilter, 'All', state.expenses.length);

    // Build category tabs
    for (var i = 0; i < used.length; i++) {
        var cat  = used[i];
        var info = getCategoryInfo(cat);
        html += buildTabHTML(cat, info.icon + ' ' + cat, counts[cat]);
    }

    dom.filterTabs.innerHTML = html;
}

// Single tab HTML builder
function buildTabHTML(category, label, count) {
    var active = (state.activeFilter === category) ? ' active' : '';
    return '<button class="filter-tab' + active + '" data-category="' + category + '">' +
               label +
               '<span class="filter-count">' + count + '</span>' +
           '</button>';
}

// Expense list
function renderExpenseList() {
    var filtered = getFilteredExpenses();

    if (filtered.length === 0) {
        dom.expenseList.innerHTML = buildEmptyStateHTML();
        return;
    }

    // Newest first
    var sorted = filtered.slice().reverse();
    var html   = '';

    for (var i = 0; i < sorted.length; i++) {
        html += buildExpenseItemHTML(sorted[i]);
    }

    dom.expenseList.innerHTML = html;
}

// Single expense item HTML builder
function buildExpenseItemHTML(exp) {
    var info    = getCategoryInfo(exp.category);
    var desc    = escapeHTML(exp.description) || 'No description';
    var dateStr = formatDate(exp.date);

    // Apply search highlighting
    var displayCat  = state.searchText ? highlightText(exp.category, state.searchText) : exp.category;
    var displayDesc = state.searchText ? highlightText(desc, state.searchText) : desc;

    return '<div class="expense-item" style="border-left-color:' + info.color + '">' +
               '<div class="expense-icon" style="background:' + info.bg + '">' + info.icon + '</div>' +
               '<div class="expense-details">' +
                   '<div class="expense-category">' + displayCat + '</div>' +
                   '<div class="expense-desc">' + displayDesc + '</div>' +
                   '<div class="expense-date">' + dateStr + '</div>' +
               '</div>' +
               '<div class="expense-right">' +
                   '<span class="expense-amount">-' + formatCurrency(exp.amount) + '</span>' +
                   '<button class="delete-btn" data-id="' + exp.id + '" title="Delete">🗑️</button>' +
               '</div>' +
           '</div>';
}

// Empty state messages
function buildEmptyStateHTML() {
    var icon, title, sub;

    if (state.expenses.length === 0) {
        icon  = '📭';
        title = 'No expenses yet';
        sub   = 'Add your first expense above!';
    } else if (state.searchText !== '') {
        icon  = '🔍';
        title = 'No results found';
        sub   = 'Try a different search term or filter.';
    } else {
        icon  = '📂';
        title = 'No expenses here';
        sub   = 'No expenses match this category.';
    }

    return '<div class="empty-state">' +
               '<span class="empty-icon">' + icon + '</span>' +
               '<p class="empty-title">' + title + '</p>' +
               '<p class="empty-sub">' + sub + '</p>' +
           '</div>';
}

// Results info bar
function renderResultsInfo() {
    var isFiltering = state.searchText !== '' ||
                      state.activeFilter !== CONFIG.defaultFilter;

    if (!isFiltering || state.expenses.length === 0) {
        dom.resultsInfo.style.display = 'none';
        return;
    }

    dom.resultsInfo.style.display = 'flex';

    var filtered = getFilteredExpenses();
    var text     = 'Showing ' + filtered.length + ' of ' + state.expenses.length;

    if (state.searchText && state.activeFilter !== CONFIG.defaultFilter) {
        text += '  ·  Search: "' + state.searchText + '" in ' + state.activeFilter;
    } else if (state.searchText) {
        text += '  ·  Search: "' + state.searchText + '"';
    } else {
        text += '  ·  Filter: ' + state.activeFilter;
    }

    dom.resultsCount.textContent = text;
    toggleClass(dom.clearFiltersBtn, 'hidden', false);
}

// Total bar at bottom of expense list
function renderTotalBar() {
    if (state.expenses.length === 0) {
        dom.totalBar.innerHTML = '';
        return;
    }

    var filtered = getFilteredExpenses();

    if (filtered.length === 0) {
        dom.totalBar.innerHTML = '';
        return;
    }

    var total    = sumExpenses(filtered);
    var count    = filtered.length;
    var itemWord = count === 1 ? 'expense' : 'expenses';

    var label = 'Total';
    if (state.searchText !== '') {
        label = 'Matching total';
    } else if (state.activeFilter !== CONFIG.defaultFilter) {
        label = 'Total for ' + state.activeFilter;
    }

    dom.totalBar.innerHTML =
        '<div class="total-bar">' +
            '<span class="total-bar-label">' + label + ' ' +
                '<span class="total-bar-count">(' + count + ' ' + itemWord + ')</span>' +
            '</span>' +
            '<span class="total-bar-amount">' + formatCurrency(total) + '</span>' +
        '</div>';
}

// Category breakdown chart
function renderBreakdown() {
    if (state.expenses.length === 0) {
        dom.breakdownCard.style.display = 'none';
        return;
    }
    dom.breakdownCard.style.display = 'block';

    var totals = getCategoryTotals(state.expenses);

    // Sort by amount descending
    totals.sort(function(a, b) { return b.total - a.total; });

    var grandTotal = sumExpenses(state.expenses);
    var maxTotal   = totals[0].total;
    var html       = '';

    for (var i = 0; i < totals.length; i++) {
        var info = getCategoryInfo(totals[i].name);
        var pct  = (totals[i].total / grandTotal * 100).toFixed(0);
        var barW = (totals[i].total / maxTotal * 100).toFixed(1);

        html += '<div class="breakdown-item">' +
                    '<div class="breakdown-header">' +
                        '<span class="breakdown-name">' + info.icon + '  ' + totals[i].name + '</span>' +
                        '<span class="breakdown-amount">' + formatCurrency(totals[i].total) +
                            ' <span class="breakdown-pct">(' + pct + '%)</span></span>' +
                    '</div>' +
                    '<div class="breakdown-bar-bg">' +
                        '<div class="breakdown-bar" style="width:' + barW + '%;background:' + info.color + '"></div>' +
                    '</div>' +
                '</div>';
    }

    dom.breakdownList.innerHTML = html;
}


/* ================================================================
   UTILITY FUNCTIONS
   ================================================================ */

// Format amount with currency symbol
function formatCurrency(amount) {
    return CONFIG.currency + amount.toFixed(2);
}

// Sum all amounts in an expenses array
function sumExpenses(expenses) {
    var total = 0;
    for (var i = 0; i < expenses.length; i++) {
        total += expenses[i].amount;
    }
    return total;
}

// Count expenses per category → { Food: 3, Transport: 2 }
function getCategoryCounts(expenses) {
    var counts = {};
    for (var i = 0; i < expenses.length; i++) {
        var cat = expenses[i].category;
        counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
}

// Sum amounts per category → [{ name: "Food", total: 250 }, ...]
function getCategoryTotals(expenses) {
    var map = {};
    for (var i = 0; i < expenses.length; i++) {
        var cat = expenses[i].category;
        map[cat] = (map[cat] || 0) + expenses[i].amount;
    }

    var result = [];
    for (var cat in map) {
        result.push({ name: cat, total: map[cat] });
    }
    return result;
}

// Look up category info by name
function getCategoryInfo(name) {
    for (var i = 0; i < CATEGORIES.length; i++) {
        if (CATEGORIES[i].name === name) return CATEGORIES[i];
    }
    return { name: name, icon: '📦', color: '#6B7280', bg: '#F9FAFB' };
}

// Format ISO date string → "Jan 15, 2025 · 12:30 PM"
function formatDate(isoString) {
    var d      = new Date(isoString);
    var months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
    var h      = d.getHours();
    var m      = d.getMinutes();
    var ampm   = h >= 12 ? 'PM' : 'AM';

    h = h % 12 || 12;

    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() +
           '  ·  ' + h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
}

// Escape HTML entities to prevent XSS
function escapeHTML(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Wrap matching text in a highlight <span>
function highlightText(text, search) {
    if (!search) return text;

    var idx = text.toLowerCase().indexOf(search.toLowerCase());
    if (idx === -1) return escapeHTML(text);

    var before = text.substring(0, idx);
    var match  = text.substring(idx, idx + search.length);
    var after  = text.substring(idx + search.length);

    return escapeHTML(before) +
           '<span class="highlight">' + escapeHTML(match) + '</span>' +
           escapeHTML(after);
}

// Show or hide a CSS class on an element
function toggleClass(element, className, shouldHide) {
    if (shouldHide) {
        element.classList.add(className);
    } else {
        element.classList.remove(className);
    }
}

// Display or clear form error message
function showError(msg) {
    dom.errorMsg.textContent = msg;
}


/* ================================================================
   LOCAL STORAGE
   ================================================================ */
function saveToStorage() {
    try {
        localStorage.setItem(CONFIG.storageKeys.expenses, JSON.stringify(state.expenses));
        localStorage.setItem(CONFIG.storageKeys.nextId, state.nextId.toString());
        showSaveStatus('✓ Saved');
    } catch (e) {
        console.warn('Storage save failed:', e);
        showSaveStatus('⚠ Could not save');
    }
}

function loadFromStorage() {
    try {
        var saved   = localStorage.getItem(CONFIG.storageKeys.expenses);
        var savedId = localStorage.getItem(CONFIG.storageKeys.nextId);

        if (saved)   state.expenses = JSON.parse(saved);
        if (savedId) state.nextId   = parseInt(savedId, 10);

        if (state.expenses.length > 0) {
            showSaveStatus('Loaded ' + state.expenses.length + ' expenses');
        }
    } catch (e) {
        console.warn('Storage load failed:', e);
        state.expenses = [];
        state.nextId = 1;
    }
}

function showSaveStatus(message) {
    dom.saveStatus.textContent = message;
    dom.saveStatus.className   = 'save-status';
    void dom.saveStatus.offsetWidth; // Force reflow to restart animation
    dom.saveStatus.className   = 'save-status saved';
}


/* ================================================================
   START
   ================================================================ */
init();


/* ================================================================
   ================================================================
   TIME SUMMARY — NEW FEATURE
   Added below init() so nothing above is touched.
   ================================================================
   ================================================================ */


/* ────────────────────────────────────────────
   NEW DOM REFERENCES
   ──────────────────────────────────────────── */
var timeSummaryCard    = document.getElementById('timeSummaryCard');
var timeSummaryContent = document.getElementById('timeSummaryContent');


/* ────────────────────────────────────────────
   DATE HELPER: Is expense from today?
   
   Compares just the date part (ignores time).
   
   Example:
     Expense date: "2025-01-20T14:30:00Z"
     Today:        "2025-01-20"
     Same day? YES → return true
   ──────────────────────────────────────────── */
function isToday(dateString) {
    var expenseDate = new Date(dateString);
    var now         = new Date();

    return expenseDate.getDate()     === now.getDate() &&
           expenseDate.getMonth()    === now.getMonth() &&
           expenseDate.getFullYear() === now.getFullYear();
}


/* ────────────────────────────────────────────
   DATE HELPER: Is expense within last N days?
   
   Creates a "cutoff" date N days ago.
   If expense date >= cutoff → it's within range.
   
   Example (N = 7):
     Today:    Jan 20
     Cutoff:   Jan 20 - 7 = Jan 13 (midnight)
     
     Expense on Jan 15 → Jan 15 >= Jan 13? YES
     Expense on Jan 10 → Jan 10 >= Jan 13? NO
   ──────────────────────────────────────────── */
function isWithinLastDays(dateString, days) {
    var expenseDate = new Date(dateString);

    // Create cutoff: today minus N days, at midnight
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);

    return expenseDate >= cutoff;
}


/* ────────────────────────────────────────────
   DATE HELPER: Is expense in the current month?
   
   Checks if expense's month AND year match today's.
   
   Example:
     Today: January 2025
     
     Expense on Jan 15, 2025 → month=0, year=2025 → MATCH
     Expense on Dec 20, 2024 → month=11, year=2024 → NO MATCH
     Expense on Jan 10, 2024 → month=0, year=2024  → NO MATCH
                                                      (wrong year!)
   ──────────────────────────────────────────── */
function isCurrentMonth(dateString) {
    var expenseDate = new Date(dateString);
    var now         = new Date();

    return expenseDate.getMonth()    === now.getMonth() &&
           expenseDate.getFullYear() === now.getFullYear();
}


/* ────────────────────────────────────────────
   CALCULATE TIME PERIOD STATS
   
   Takes ALL expenses and a "checker" function.
   Returns { total, count, avg } for matching expenses.
   
   checker = a function like isToday or isCurrentMonth
             that returns true/false for each expense.
   
   avgDays = how many days to divide by for daily average
             (7 for weekly, ~30 for monthly, 1 for today)
   ──────────────────────────────────────────── */
function getTimePeriodStats(expenses, checker, avgDays) {
    var total = 0;
    var count = 0;

    for (var i = 0; i < expenses.length; i++) {
        if (checker(expenses[i].date)) {
            total += expenses[i].amount;
            count += 1;
        }
    }

    var avg = avgDays > 0 ? total / avgDays : 0;

    return {
        total: total,
        count: count,
        avg:   avg
    };
}


/* ────────────────────────────────────────────
   GET NUMBER OF DAYS ELAPSED IN CURRENT MONTH
   
   Jan 20 → returns 20 (20 days have passed)
   Feb 1  → returns 1
   
   Used to calculate accurate daily average for
   "this month" (instead of always dividing by 30).
   ──────────────────────────────────────────── */
function getDaysIntoMonth() {
    return new Date().getDate();
}


/* ────────────────────────────────────────────
   BUILD HTML FOR ONE TIME PERIOD CARD
   
   Creates the HTML for "Today", "This Week",
   or "This Month" — one card at a time.
   
   cssClass = "today", "week", or "month"
              (controls the top border color)
   ──────────────────────────────────────────── */
function buildTimeSummaryItemHTML(label, stats, cssClass, showAvg) {
    var html = '';

    html += '<div class="time-summary-item ' + cssClass + '">';
    html +=   '<span class="time-summary-period">' + label + '</span>';

    if (stats.count === 0) {
        // No expenses in this period
        html += '<span class="time-summary-amount">' + formatCurrency(0) + '</span>';
        html += '<span class="time-summary-empty">No expenses</span>';
    } else {
        // Show total, count, and daily average
        var itemWord = stats.count === 1 ? 'expense' : 'expenses';

        html += '<span class="time-summary-amount">' + formatCurrency(stats.total) + '</span>';
        html += '<span class="time-summary-count">' + stats.count + ' ' + itemWord + '</span>';

        if (showAvg) {
            html += '<span class="time-summary-avg">~' + formatCurrency(stats.avg) + '/day</span>';
        }
    }

    html += '</div>';
    return html;
}


/* ────────────────────────────────────────────
   RENDER TIME SUMMARY
   
   The main render function for this feature.
   Calculates stats for today, this week, this month,
   then builds and inserts the HTML.
   ──────────────────────────────────────────── */
function renderTimeSummary() {

    // Hide card if no expenses exist
    if (state.expenses.length === 0) {
        timeSummaryCard.style.display = 'none';
        return;
    }

    // Show the card
    timeSummaryCard.style.display = 'block';

    // Calculate stats for each time period
    var todayStats = getTimePeriodStats(
        state.expenses,
        isToday,
        1
    );

    var weekStats = getTimePeriodStats(
        state.expenses,
        function(dateString) { return isWithinLastDays(dateString, 7); },
        7
    );

    var daysIntoMonth = getDaysIntoMonth();
    var monthStats = getTimePeriodStats(
        state.expenses,
        isCurrentMonth,
        daysIntoMonth
    );

    // Build the HTML (3 cards side by side)
    var html = '';
    html += buildTimeSummaryItemHTML('Today',      todayStats, 'today', false);
    html += buildTimeSummaryItemHTML('This Week',   weekStats,  'week',  true);
    html += buildTimeSummaryItemHTML('This Month',  monthStats, 'month', true);

    timeSummaryContent.innerHTML = html;
}


/* ────────────────────────────────────────────
   HOOK INTO EXISTING renderAll()
   
   We save the original renderAll function,
   then replace it with a new version that
   calls the original + our new function.
   
   This way we NEVER modify the original code.
   
   BEFORE:
     renderAll() → renders summary, tabs, list, breakdown
   
   AFTER:
     renderAll() → renders summary, tabs, list, breakdown
                   + renders time summary (NEW)
   ──────────────────────────────────────────── */
var _originalRenderAll = renderAll;

renderAll = function() {
    _originalRenderAll();   // Run everything that already existed
    renderTimeSummary();    // Then run our new feature
};


/* ────────────────────────────────────────────
   FIRST RENDER
   
   init() already ran above and called the OLD renderAll.
   So the time summary hasn't been rendered yet.
   We call it once now to show it immediately.
   ──────────────────────────────────────────── */
renderTimeSummary();
