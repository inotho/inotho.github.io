// Constants
const INITIAL_BALANCE = 1200;
const TIMELINE = [1, 2, 3, 5, 10, 15, 25];
const ANNUAL_INVESTMENT = 1200;

// State management
let state = {
    balance: 0,
    portfolio: {},
    transactions: [],
    stocks: [],
    etfs: [],
    currentView: 'dashboard',
    selectedStock: null,
    timelineIdx: 0,
    course: null, // 'introduction' or 'strategie'
    courseVersion: null, // Track course changes
};

// Cache for stock lookups (Map for O(1) access)
let stockMap = new Map();

// Debounce timer for saveState
let saveStateTimer = null;

// DOM Elements
const loadingContainer = document.getElementById('loader-container');
const contentDiv = document.getElementById('content');

const navButtons = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');
const userBalanceEl = document.getElementById('user-balance');
const cashBalanceEl = document.getElementById('cash-balance');
const portfolioValueEl = document.getElementById('portfolio-value');
const totalValueEl = document.getElementById('total-value');
const stockListEl = document.getElementById('stock-list');
const portfolioListEl = document.getElementById('portfolio-list');
const transactionHistoryEl = document.getElementById('transaction-history');
const recentTransactionsEl = document.getElementById('recent-transactions');
const topHoldingsEl = document.getElementById('top-holdings');
const stockModal = document.getElementById('stock-modal');
const closeModalBtn = document.querySelector('.close-modal');
const modalStockName = document.getElementById('modal-stock-name');
const modalStockSymbol = document.getElementById('modal-stock-symbol');
const modalStockPrice = document.getElementById('modal-stock-price');
const modalStockChange = document.getElementById('modal-stock-change');
const modalStockDescription = document.getElementById('modal-stock-description');
const tradeQuantityInput = document.getElementById('trade-quantity');
const tradeTotalEl = document.getElementById('trade-total');
const buyButton = document.getElementById('buy-button');
const sellButton = document.getElementById('sell-button');
const ownedQuantityEl = document.getElementById('owned-quantity');
const ownedValueEl = document.getElementById('owned-value');
const stockSearchInput = document.getElementById('stock-search');
const etfSearchInput = document.getElementById('etf-search');
const etfListEl = document.getElementById('etf-list');
const nextDayBtn = document.getElementById('next-day-btn');
const resetBtn = document.getElementById('reset-btn');
const resultsResetBtn = document.getElementById('results-reset-btn');
const currentDateEl = document.getElementById('current-date');
const loadingText = document.getElementById('loading-text');
const loadingProgressBar = document.getElementById('loading-progress-bar');
const homepage = document.getElementById('homepage');
const courseCards = document.querySelectorAll('.course-card');

// Helper functions
function getValidTimelineIdx() {
    if (state.timelineIdx === undefined || state.timelineIdx === null || isNaN(state.timelineIdx)) {
        return 0;
    }
    return Math.min(Math.max(0, state.timelineIdx), TIMELINE.length - 1);
}

function getYearForTimelineIdx(timelineIdx) {
    const validIdx = Math.min(Math.max(0, timelineIdx || 0), TIMELINE.length - 1);
    const year = TIMELINE[validIdx];
    return year && !isNaN(year) ? year : TIMELINE[0];
}

function isAtEndOfTimeline() {
    return state.timelineIdx >= TIMELINE.length - 1;
}

// Initialize the application
function init() {
    loadState();
    
    // Check if we need to reset (at year 25 or course version mismatch)
    const isAtEnd = isAtEndOfTimeline();
    const needsReset = isAtEnd || !state.courseVersion;
    
    // Always reset if at year 25 - don't show results on page load
    if (isAtEnd && state.course) {
        // Force reset - clear localStorage first
        localStorage.removeItem('marketSimState');
        // Create a completely fresh state
        state = {
            balance: INITIAL_BALANCE,
            portfolio: {},
            transactions: [],
            stocks: [],
            etfs: [],
            currentView: 'dashboard',
            selectedStock: null,
            timelineIdx: 0,
            course: state.course, // Keep the course
            courseVersion: Date.now(),
        };
        // Clear stock map cache
        stockMap.clear();
        // Force regeneration by calling showApplication
        showApplication();
        return; // Exit early
    }
    
    // Check if course is already selected
    if (state.course) {
        // Normal case: show the main application
        // showApplication() will handle regeneration if needed
        showApplication();
    } else {
        // Show homepage for course selection
        showHomepage();
    }
}

// Show homepage
function showHomepage() {
    if (homepage) {
        homepage.style.display = 'flex';
    }
    if (contentDiv) {
        contentDiv.style.display = 'none';
    }
    if (loadingContainer) {
        loadingContainer.style.display = 'none';
    }
    
    // Add event listeners to course cards (only once)
    courseCards.forEach(card => {
        const btn = card.querySelector('.course-btn');
        if (btn && !btn.hasAttribute('data-listener-attached')) {
            btn.addEventListener('click', () => {
                const course = card.getAttribute('data-course');
                selectCourse(course);
            });
            btn.setAttribute('data-listener-attached', 'true');
        }
    });
}

// Select course and start application
function selectCourse(course) {
    // Clear all previous data when selecting a course
    // This is critical to prevent loading stale data
    localStorage.removeItem('marketSimState');
    
    // Generate a new version identifier for this course selection
    const courseVersion = Date.now();
    
    // Reset state completely - create a fresh state object
    // IMPORTANT: Create a completely new object to break any references
    state = {
        balance: INITIAL_BALANCE,
        portfolio: {},
        transactions: [],
        stocks: [],
        etfs: [],
        currentView: 'dashboard',
        selectedStock: null,
        timelineIdx: 0, // Always start at year 1
        course: course,
        courseVersion: courseVersion, // Track this course selection
    };
    
    // Force clear any cached data
    stockMap.clear();
    
    // Clear any pending save state timer
    if (saveStateTimer) {
        clearTimeout(saveStateTimer);
        saveStateTimer = null;
    }
    
    // Don't save state yet - wait until data is generated
    // This ensures we don't load stale data on next init
    showApplication();
}

// Show main application
function showApplication() {
    // Hide homepage first
    if (homepage) {
        homepage.style.display = 'none';
    }
    
    // Ensure content is hidden during loading
    if (contentDiv) {
        contentDiv.style.display = 'none';
    }
    
    // If we were at the end, clear localStorage to prevent stale data
    if (isAtEndOfTimeline()) {
        localStorage.removeItem('marketSimState');
    }
    
    // Always regenerate data when showing application to ensure fresh start
    // Clear existing data first and reset everything
    state.stocks = [];
    state.etfs = [];
    state.portfolio = {};
    state.transactions = [];
    state.balance = INITIAL_BALANCE;
    state.timelineIdx = 0; // Always start at year 1
    state.currentView = 'dashboard'; // Always start at dashboard view
    
    // Update course version to track this session
    if (!state.courseVersion) {
        state.courseVersion = Date.now();
    }
    
    // Clear stock map cache to ensure fresh lookups
    stockMap.clear();
    
    // Clear any pending save state timer
    if (saveStateTimer) {
        clearTimeout(saveStateTimer);
        saveStateTimer = null;
    }
    
    // Show loading screen
    loadingContainer.style.display = 'flex';
    
    // Generate data based on selected course
    const promises = [];
    if (state.course === 'introduction') {
        // Introduction course: only stocks
        promises.push(generateStocks());
        state.etfs = []; // Clear ETFs
    } else if (state.course === 'strategie') {
        // Strategie course: only ETFs
        promises.push(generateETFs());
        state.stocks = []; // Clear stocks
    } else {
        // Fallback: generate both
        promises.push(generateStocks(), generateETFs());
    }
    
    Promise.all(promises).then(() => {
        updateStockMap();
        
        // IMPORTANT: Change view to dashboard to hide results view
        changeView('dashboard');
        
        updateUI();
        setupEventListeners();
        updateNavigationForCourse();
        
        // Save state after data is generated
        saveState();

        // Hide loading and show content
        loadingContainer.style.display = 'none';
        contentDiv.style.display = 'block';
    });
}

// Load state from localStorage
function loadState() {
    const savedState = localStorage.getItem('marketSimState');
    if (savedState) {
        state = JSON.parse(savedState);
    }
}

// Save state to localStorage with debouncing
function saveState() {
    // Don't save state if we're at year 25 - this prevents reloading into results view
    if (state.timelineIdx >= TIMELINE.length - 1) {
        return;
    }
    
    // Clear existing timer
    if (saveStateTimer) {
        clearTimeout(saveStateTimer);
    }
    // Debounce: only save after 300ms of inactivity
    saveStateTimer = setTimeout(() => {
        localStorage.setItem('marketSimState', JSON.stringify(state));
    }, 300);
}

// Generate fake stocks
async function generateStocks() {
    const totalStocks = marketData.length;
    let loadedCount = 0;
    
    // Update loading progress
    const updateProgress = () => {
        loadedCount++;
        const progress = Math.min((loadedCount / totalStocks) * 100, 100);
        if (loadingText) {
            loadingText.textContent = `Chargement ${loadedCount}/${totalStocks} actions...`;
        }
        if (loadingProgressBar) {
            loadingProgressBar.style.width = `${progress}%`;
        }
    };
    
    const year = getYearForTimelineIdx(state.timelineIdx);
    
    // Fetch all stock prices in parallel with progress tracking
    const stockPromises = marketData.map(async (company, index) => {
        try {
            const basePrice = await getStockPrice(company.displayedSymbol, year, 5000);
            updateProgress();
            return {
                name: company.displayedName,
                symbol: company.displayedSymbol,
                description: company.description,
                price: parseFloat(basePrice.toFixed(2)),
                previousPrice: parseFloat(basePrice.toFixed(2)),
                change: 0,
                changePercent: 0
            };
        } catch (error) {
            console.error(`Failed to fetch price for ${company.displayedSymbol}:`, error);
            updateProgress();
            // Return a default stock with price 0 if API fails
            return {
                name: company.displayedName,
                symbol: company.displayedSymbol,
                description: company.description,
                price: 0,
                previousPrice: 0,
                change: 0,
                changePercent: 0
            };
        }
    });
    
    // Use allSettled to not block on errors and get results faster
    const results = await Promise.allSettled(stockPromises);
    state.stocks = results.map((result, index) => 
        result.status === 'fulfilled' ? result.value : {
            name: marketData[index].displayedName,
            symbol: marketData[index].displayedSymbol,
            description: marketData[index].description,
            price: 0,
            previousPrice: 0,
            change: 0,
            changePercent: 0
        }
    );
    
    // Update stock map cache
    updateStockMap();
}

// Generate ETFs
async function generateETFs() {
    if (!etfData || etfData.length === 0) return;
    
    const totalETFs = etfData.length;
    let loadedCount = 0;
    
    // Update loading progress (combined with stocks)
    const updateProgress = () => {
        loadedCount++;
        const totalItems = marketData.length + totalETFs;
        const currentLoaded = (marketData.length || 0) + loadedCount;
        const progress = Math.min((currentLoaded / totalItems) * 100, 100);
        if (loadingText) {
            loadingText.textContent = `Chargement ${currentLoaded}/${totalItems} titres...`;
        }
        if (loadingProgressBar) {
            loadingProgressBar.style.width = `${progress}%`;
        }
    };
    
    const year = getYearForTimelineIdx(state.timelineIdx);
    
    // Fetch all ETF prices in parallel with progress tracking
    const etfPromises = etfData.map(async (etf) => {
        try {
            if (!year) {
                throw new Error('Year is undefined');
            }
            const basePrice = await getStockPrice(etf.displayedSymbol, year, 5000);
            updateProgress();
            
            // Only return ETF if price is valid (not null, not 0, not undefined, and is a number)
            const isValidPrice = basePrice !== null && 
                                basePrice !== undefined && 
                                !isNaN(basePrice) && 
                                typeof basePrice === 'number' &&
                                basePrice > 0;
            
            if (isValidPrice) {
                return {
                    name: etf.name,
                    displayedSymbol: etf.displayedSymbol,
                    symbol: etf.symbol,
                    description: etf.description,
                    price: parseFloat(basePrice.toFixed(2)),
                    previousPrice: parseFloat(basePrice.toFixed(2)),
                    change: 0,
                    changePercent: 0,
                    isETF: true
                };
            } else {
                console.warn(`No valid price data for ETF ${etf.displayedSymbol} (price: ${basePrice}), excluding from list`);
                updateProgress();
                return null; // Return null to filter out later
            }
        } catch (error) {
            console.error(`Failed to fetch price for ETF ${etf.displayedSymbol}:`, error);
            updateProgress();
            return null; // Return null to filter out later
        }
    });
    
    // Use allSettled to not block on errors, then filter out null values
    const results = await Promise.allSettled(etfPromises);
    state.etfs = results
        .map((result) => result.status === 'fulfilled' ? result.value : null)
        .filter(etf => etf !== null); // Only keep ETFs with valid prices
}

// Update stock map cache for O(1) lookups
function updateStockMap() {
    stockMap.clear();
    state.stocks.forEach(stock => {
        stockMap.set(stock.symbol, stock);
    });
    // Also add ETFs to the map (use displayedSymbol as key for consistency)
    if (state.etfs) {
        state.etfs.forEach(etf => {
            stockMap.set(etf.displayedSymbol || etf.symbol, etf);
            // Also add by symbol for backward compatibility
            if (etf.displayedSymbol && etf.displayedSymbol !== etf.symbol) {
                stockMap.set(etf.symbol, etf);
            }
        });
    }
}

async function advanceToNextYear() {
    const currentIdx = getValidTimelineIdx();
    const previousYear = TIMELINE[currentIdx];
    
    // Check if we're already at the last year
    if (currentIdx >= TIMELINE.length - 1) {
        showResults();
        return;
    }
    
    state.timelineIdx = currentIdx + 1;
    
    // Check if we've reached the end
    if (state.timelineIdx >= TIMELINE.length) {
        showResults();
        return;
    }
    
    // Calculate years elapsed and add investment money
    const currentYear = TIMELINE[state.timelineIdx];
    const yearsElapsed = currentYear - previousYear;
    const investmentAmount = ANNUAL_INVESTMENT * yearsElapsed;
    state.balance += investmentAmount;
    
    // Record the investment as a transaction
    if (investmentAmount > 0) {
        state.transactions.push({
            type: 'investment',
            amount: investmentAmount,
            years: yearsElapsed,
            year: currentYear,
            timestamp: Date.now()
        });
    }
    
    loadingContainer.style.display = 'flex';
    contentDiv.style.display = 'none';

    // Helper function to update stock/ETF price
    const updatePrice = async (item, symbol, isETF = false) => {
        try {
            item.previousPrice = item.price;
            const year = getYearForTimelineIdx(state.timelineIdx);
            const newPrice = await getStockPrice(symbol, year);
            
            if (newPrice !== null && newPrice !== undefined && !isNaN(newPrice) && newPrice > 0) {
                item.price = parseFloat(newPrice.toFixed(2));
                item.change = parseFloat((item.price - item.previousPrice).toFixed(2));
                item.changePercent = parseFloat((((item.price - item.previousPrice) / item.previousPrice) * 100).toFixed(2));
            } else if (isETF) {
                item.price = null;
            }
        } catch (error) {
            console.error(`Failed to update price for ${symbol}:`, error);
            if (isETF) {
                item.price = null;
            }
        }
    };
    
    // Fetch all stock prices in parallel
    const stockPromises = state.stocks.map(stock => updatePrice(stock, stock.symbol, false));
    
    // Update ETF prices
    const etfPromises = (state.etfs || []).map(etf => updatePrice(etf, etf.displayedSymbol, true));
    
    await Promise.all(etfPromises);
    
    // Filter out ETFs with invalid prices after update
    state.etfs = (state.etfs || []).filter(etf => 
        etf.price !== null && 
        etf.price !== undefined && 
        !isNaN(etf.price) && 
        etf.price > 0
    );
    
    await Promise.all([...stockPromises, ...etfPromises]);
    
    // Check if we've reached the end
    if (state.timelineIdx >= TIMELINE.length) {
        showResults();
        return;
    }
    
    updateUI();
    loadingContainer.style.display = 'none';
    contentDiv.style.display = 'block';
    saveState();
}

// Calculate and show results
function showResults() {
    // Calculate total received (initial balance + all annual investments)
    const annualInvestments = state.transactions
        .filter(t => t.type === 'investment')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const totalReceived = INITIAL_BALANCE + annualInvestments;
    
    // Calculate total spent on purchases (sum of all buy transactions)
    const totalSpent = state.transactions
        .filter(t => t.type === 'buy')
        .reduce((sum, t) => sum + t.total, 0);
    
    // Calculate current portfolio value
    let portfolioValue = 0;
    Object.keys(state.portfolio).forEach(symbol => {
        const stock = stockMap.get(symbol);
        if (stock) {
            const quantity = state.portfolio[symbol];
            portfolioValue += stock.price * quantity;
        }
    });
    
    // Calculate final value (portfolio + remaining cash)
    const finalValue = state.balance + portfolioValue;
    
    // Calculate gains (final value - total received)
    // This shows the gain from stock market performance
    const totalGains = finalValue - totalReceived;
    
    // Calculate ROI Total (Gain / Total Spent on Stock Purchases)
    const roiTotal = totalSpent > 0 
        ? ((totalGains / totalSpent) * 100) 
        : 0;
    
    // Calculate ROI Annuel (CAGR - Compound Annual Growth Rate)
    // Number of years: from year 1 to year 25 = 24 years
    const numberOfYears = TIMELINE[TIMELINE.length - 1] - TIMELINE[0];
    const roiAnnual = totalSpent > 0 && finalValue > 0 && numberOfYears > 0
        ? ((Math.pow(finalValue / totalReceived, 1 / numberOfYears) - 1) * 100)
        : 0;
    
    // Update results display
    const initialInvestmentEl = document.getElementById('initial-investment');
    const totalGainsEl = document.getElementById('total-gains');
    const roiTotalEl = document.getElementById('roi-total');
    const roiAnnualEl = document.getElementById('roi-annual');
    const initialCapitalEl = document.getElementById('initial-capital');
    const remainingCashEl = document.getElementById('remaining-cash');
    const finalPortfolioValueEl = document.getElementById('final-portfolio-value');
    
    // Display total spent on stock purchases
    if (initialInvestmentEl) initialInvestmentEl.textContent = formatCurrency(totalSpent);
    if (totalGainsEl) {
        totalGainsEl.textContent = formatCurrency(totalGains);
        totalGainsEl.className = totalGains >= 0 ? 'positive' : 'negative';
    }
    if (roiTotalEl) {
        roiTotalEl.textContent = `${roiTotal >= 0 ? '+' : ''}${roiTotal.toFixed(2)}%`;
        roiTotalEl.className = roiTotal >= 0 ? 'positive' : 'negative';
    }
    if (roiAnnualEl) {
        roiAnnualEl.textContent = `${roiAnnual >= 0 ? '+' : ''}${roiAnnual.toFixed(2)}%`;
        roiAnnualEl.className = roiAnnual >= 0 ? 'positive' : 'negative';
    }
    if (initialCapitalEl) initialCapitalEl.textContent = formatCurrency(INITIAL_BALANCE);
    if (remainingCashEl) remainingCashEl.textContent = formatCurrency(state.balance);
    if (finalPortfolioValueEl) finalPortfolioValueEl.textContent = formatCurrency(portfolioValue);
    
    // Hide loading and show results view
    loadingContainer.style.display = 'none';
    contentDiv.style.display = 'block';
    changeView('results');
    
    // Ensure reset button has event listener (re-attach in case it was lost)
    const resultsResetBtnEl = document.getElementById('results-reset-btn');
    if (resultsResetBtnEl && !resultsResetBtnEl.hasAttribute('data-listener-attached')) {
        resultsResetBtnEl.addEventListener('click', resetApplication);
        resultsResetBtnEl.setAttribute('data-listener-attached', 'true');
    }
    
    // Don't save state when showing results - this prevents reloading into results view
    // The user should use the "Recommencer" button to restart
    // saveState();
}

// Reset the application to initial state
async function resetApplication() {
    if (!confirm('Êtes-vous sûr de vouloir réinitialiser l\'application ? Toutes vos données seront perdues.')) {
        return;
    }
    
    // Clear localStorage
    localStorage.removeItem('marketSimState');
    
    // Reset state to initial values (including course selection)
    state = {
        balance: INITIAL_BALANCE,
        portfolio: {},
        transactions: [],
        stocks: [],
        etfs: [],
        currentView: 'dashboard',
        selectedStock: null,
        timelineIdx: 0,
        course: null, // Reset course selection to show homepage
        courseVersion: null, // Reset course version
    };
    
    // Close modal if open
    if (stockModal) {
        stockModal.style.display = 'none';
    }
    
    // Hide content and loading, show homepage
    if (contentDiv) {
        contentDiv.style.display = 'none';
    }
    if (loadingContainer) {
        loadingContainer.style.display = 'none';
    }
    
    // Show homepage to choose course again
    showHomepage();
}

// Update navigation based on selected course
function updateNavigationForCourse() {
    if (!navButtons) return;
    
    navButtons.forEach(button => {
        const view = button.getAttribute('data-view');
        if (state.course === 'introduction') {
            // Introduction: hide ETF button, show market button
            if (view === 'etf') {
                button.style.display = 'none';
            } else {
                button.style.display = 'inline-block';
            }
        } else if (state.course === 'strategie') {
            // Strategie: hide market button, show ETF button
            if (view === 'market') {
                button.style.display = 'none';
            } else {
                button.style.display = 'inline-block';
            }
        } else {
            // Fallback: show all
            button.style.display = 'inline-block';
        }
    });
    
    // Hide/show views based on course
    const marketView = document.getElementById('market');
    const etfView = document.getElementById('etf');
    
    if (state.course === 'introduction') {
        // Introduction: hide ETF view
        if (etfView) {
            etfView.style.display = 'none';
        }
        if (marketView) {
            marketView.style.display = '';
        }
        // If currently viewing ETF, switch to dashboard
        if (state.currentView === 'etf') {
            changeView('dashboard');
        }
    } else if (state.course === 'strategie') {
        // Strategie: hide market view
        if (marketView) {
            marketView.style.display = 'none';
        }
        if (etfView) {
            etfView.style.display = '';
        }
        // If currently viewing market, switch to dashboard
        if (state.currentView === 'market') {
            changeView('dashboard');
        }
    } else {
        // Fallback: show all views
        if (marketView) {
            marketView.style.display = '';
        }
        if (etfView) {
            etfView.style.display = '';
        }
    }
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const view = button.getAttribute('data-view');
            changeView(view);
        });
    });
    
    // Close modal
    closeModalBtn.addEventListener('click', () => {
        stockModal.style.display = 'none';
    });
    
    // Click outside modal to close
    window.addEventListener('click', (e) => {
        if (e.target === stockModal) {
            stockModal.style.display = 'none';
        }
    });
    
    // Trade quantity input
    tradeQuantityInput.addEventListener('input', updateTradeTotal);
    
    // Buy button
    buyButton.addEventListener('click', () => {
        if (state.selectedStock) {
            buyStock(state.selectedStock, parseInt(tradeQuantityInput.value));
        }
    });
    
    // Sell button
    sellButton.addEventListener('click', () => {
        if (state.selectedStock) {
            sellStock(state.selectedStock, parseInt(tradeQuantityInput.value));
        }
    });
    
    // Stock search
    stockSearchInput.addEventListener('input', () => {
        renderStockList();
    });
    
    // ETF search
    if (etfSearchInput) {
        etfSearchInput.addEventListener('input', () => {
            renderETFList();
        });
    }
    
    // Next day button
    nextDayBtn.addEventListener('click', advanceToNextYear);
    
    // Reset button
    resetBtn.addEventListener('click', resetApplication);
    
    // Results reset button
    if (resultsResetBtn) {
        resultsResetBtn.addEventListener('click', resetApplication);
        resultsResetBtn.setAttribute('data-listener-attached', 'true');
    }
}

// Change current view
function changeView(view) {
    state.currentView = view;
    
    // Update active nav button
    navButtons.forEach(button => {
        if (button.getAttribute('data-view') === view) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
    
    // Show active view
    views.forEach(viewEl => {
        if (viewEl.id === view) {
            viewEl.classList.add('active');
        } else {
            viewEl.classList.remove('active');
        }
    });
    
    // Refresh the view content
    updateUI();
}

// Update UI elements
function updateUI() {
    // Always update balance and date
    updateBalanceDisplay();
    currentDateEl.textContent = `Année ${TIMELINE[state.timelineIdx]}`;
    
    // Show reset button only at year 25 (last year in timeline)
    const isLastYear = isAtEndOfTimeline();
    resetBtn.style.display = isLastYear ? 'inline-block' : 'none';
    nextDayBtn.style.display = isLastYear ? 'none' : 'inline-block';
    
    // If we're at the last year and not already showing results, show them
    if (isLastYear && state.currentView !== 'results') {
        showResults();
        return;
    }
    
    // Only render the active view to improve performance
    switch (state.currentView) {
        case 'dashboard':
            renderRecentTransactions();
            renderTopHoldings();
            updatePortfolioValue();
            break;
        case 'market':
            // Only render if course is introduction or both
            if (state.course === 'introduction' || !state.course) {
                renderStockList();
            }
            break;
        case 'etf':
            // Only render if course is strategie or both
            if (state.course === 'strategie' || !state.course) {
                renderETFList();
            }
            break;
        case 'portfolio':
            renderPortfolioList();
            break;
        case 'history':
            renderTransactionHistory();
            break;
        case 'results':
            // Results view is handled by showResults()
            break;
    }
}

// Update balance display
function updateBalanceDisplay() {
    let portfolioValue = 0;
    
    // Use Map for O(1) lookup instead of O(n) find
    Object.keys(state.portfolio).forEach(symbol => {
        const stock = stockMap.get(symbol);
        if (stock) {
            const quantity = state.portfolio[symbol];
            portfolioValue += stock.price * quantity;
        }
    });
    
    userBalanceEl.textContent = formatCurrency(state.balance + portfolioValue);
    cashBalanceEl.textContent = formatCurrency(state.balance);
}

// Render stock list
function renderStockList() {
    const searchTerm = stockSearchInput.value.toLowerCase();
    const filteredStocks = state.stocks.filter(stock => 
        stock.name.toLowerCase().includes(searchTerm) || 
        stock.symbol.toLowerCase().includes(searchTerm)
    );
    
    // Use DocumentFragment to reduce reflows
    const fragment = document.createDocumentFragment();
    
    if (filteredStocks.length === 0) {
        stockListEl.innerHTML = '<li class="empty-state">No stocks found</li>';
        return;
    }
    
    filteredStocks.forEach(stock => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="stock-info">
                <div class="stock-name">${stock.name}</div>
                <div class="stock-symbol">${stock.symbol}</div>
            </div>
            <div class="stock-price-info">
                <div class="stock-price">${formatCurrency(stock.price)}</div>
                <div class="stock-change ${stock.changePercent >= 0 ? 'positive' : 'negative'}">
                    ${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent}%
                </div>
            </div>
        `;
        li.addEventListener('click', () => openStockDetail(stock));
        fragment.appendChild(li);
    });
    
    stockListEl.innerHTML = '';
    stockListEl.appendChild(fragment);
}

// Render ETF list
function renderETFList() {
    if (!etfListEl || !state.etfs) {
        return;
    }
    
    const searchTerm = etfSearchInput ? etfSearchInput.value.toLowerCase() : '';
    // Filter out ETFs with invalid prices (null, 0, or NaN)
    const validETFs = state.etfs.filter(etf => 
        etf.price !== null && 
        etf.price !== undefined && 
        !isNaN(etf.price) && 
        etf.price > 0
    );
    const filteredETFs = validETFs.filter(etf => 
        etf.name.toLowerCase().includes(searchTerm) || 
        (etf.displayedSymbol && etf.displayedSymbol.toLowerCase().includes(searchTerm)) ||
        etf.symbol.toLowerCase().includes(searchTerm)
    );
    
    // Use DocumentFragment to reduce reflows
    const fragment = document.createDocumentFragment();
    
    if (filteredETFs.length === 0) {
        etfListEl.innerHTML = '<li class="empty-state">Aucun ETF trouvé</li>';
        return;
    }
    
    filteredETFs.forEach(etf => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="stock-info">
                <div class="stock-name">${etf.name}</div>
                <div class="stock-symbol">${etf.displayedSymbol || etf.symbol}</div>
            </div>
            <div class="stock-price-info">
                <div class="stock-price">${formatCurrency(etf.price)}</div>
                <div class="stock-change ${etf.changePercent >= 0 ? 'positive' : 'negative'}">
                    ${etf.changePercent >= 0 ? '+' : ''}${etf.changePercent}%
                </div>
            </div>
        `;
        li.addEventListener('click', () => openStockDetail(etf));
        fragment.appendChild(li);
    });
    
    etfListEl.innerHTML = '';
    etfListEl.appendChild(fragment);
}

// Render portfolio list
function renderPortfolioList() {
    const portfolioStocks = Object.keys(state.portfolio);
    
    if (portfolioStocks.length === 0) {
        portfolioListEl.innerHTML = '<li class="empty-state">Vous ne possédez pas d\'actions</li>';
        return;
    }
    
    // Use DocumentFragment to reduce reflows
    const fragment = document.createDocumentFragment();
    
    portfolioStocks.forEach(symbol => {
        const stock = stockMap.get(symbol); // O(1) lookup instead of O(n) find
        if (!stock) return;
        
        const quantity = state.portfolio[symbol];
        const value = stock.price * quantity;
        
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="stock-info">
                <div class="stock-name">${stock.name}</div>
                <div class="stock-symbol">${stock.symbol} - ${quantity} shares</div>
            </div>
            <div class="stock-price-info">
                <div class="stock-price">${formatCurrency(value)}</div>
                <div class="stock-change ${stock.changePercent >= 0 ? 'positive' : 'negative'}">
                    ${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent}%
                </div>
            </div>
        `;
        li.addEventListener('click', () => openStockDetail(stock));
        fragment.appendChild(li);
    });
    
    portfolioListEl.innerHTML = '';
    portfolioListEl.appendChild(fragment);
}

// Render transaction history
function renderTransactionHistory() {
    transactionHistoryEl.innerHTML = '';
    
    if (state.transactions.length === 0) {
        transactionHistoryEl.innerHTML = '<li class="empty-state">Aucune transaction</li>';
        return;
    }
    
    // Sort transactions by date (newest first)
    const sortedTransactions = [...state.transactions].sort((a, b) => b.timestamp - a.timestamp);
    
    sortedTransactions.forEach(transaction => {
        const li = document.createElement('li');
        let content = '';
        
        if (transaction.type === 'investment') {
            content = `
                <div class="transaction-info">
                    <div class="transaction-type transaction-investment">
                        Investissement annuel: ${formatCurrency(transaction.amount)}
                    </div>
                    <div class="transaction-details">
                        ${transaction.years} année${transaction.years > 1 ? 's' : ''} écoulée${transaction.years > 1 ? 's' : ''}
                    </div>
                    <div class="transaction-date">Année ${transaction.year}</div>
                </div>
            `;
        } else {
            content = `
                <div class="transaction-info">
                    <div class="transaction-type ${transaction.type === 'buy' ? 'transaction-buy' : 'transaction-sell'}">
                        ${transaction.type === 'buy' ? 'Acheté' : 'Vendu'} ${transaction.quantity} ${transaction.symbol}
                    </div>
                    <div class="transaction-details">
                        à ${formatCurrency(transaction.price)} par action (${formatCurrency(transaction.total)})
                    </div>
                    <div class="transaction-date">Année ${transaction.year}</div>
                </div>
            `;
        }
        
        li.innerHTML = content;
        transactionHistoryEl.appendChild(li);
    });
}

// Render recent transactions
function renderRecentTransactions() {
    recentTransactionsEl.innerHTML = '';
    
    if (state.transactions.length === 0) {
        recentTransactionsEl.innerHTML = '<li class="empty-state">Aucune transaction récente</li>';
        return;
    }
    
    // Get 5 most recent transactions
    const recentTransactions = [...state.transactions]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5);
    
    recentTransactions.forEach(transaction => {
        const li = document.createElement('li');
        let content = '';
        
        if (transaction.type === 'investment') {
            content = `
                <div class="transaction-type transaction-investment">
                    Investissement: ${formatCurrency(transaction.amount)}
                </div>
                <div class="transaction-date">Année ${transaction.year}</div>
            `;
        } else {
            content = `
                <div class="transaction-type ${transaction.type === 'buy' ? 'transaction-buy' : 'transaction-sell'}">
                    ${transaction.type === 'buy' ? 'Acheté' : 'Vendu'} ${transaction.quantity} ${transaction.symbol}
                </div>
                <div class="transaction-date">Année ${transaction.year}</div>
            `;
        }
        
        li.innerHTML = content;
        recentTransactionsEl.appendChild(li);
    });
}

// Render top holdings
function renderTopHoldings() {
    topHoldingsEl.innerHTML = '';
    
    const portfolioStocks = Object.keys(state.portfolio);
    
    if (portfolioStocks.length === 0) {
        topHoldingsEl.innerHTML = '<li class="empty-state">Aucune position</li>';
        return;
    }
    
    // Calculate value of each holding
    const holdings = portfolioStocks.map(symbol => {
        const stock = stockMap.get(symbol); // O(1) lookup instead of O(n) find
        if (!stock) return null;
        const quantity = state.portfolio[symbol];
        const value = stock.price * quantity;
        return { symbol, name: stock.name, quantity, value };
    }).filter(h => h !== null); // Filter out null entries
    
    // Sort by value (highest first) and take top 5
    const topHoldings = holdings
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
    
    topHoldings.forEach(holding => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="holding-info">
                <div class="holding-name">${holding.name} (${holding.symbol})</div>
                <div class="holding-quantity">${holding.quantity} shares</div>
            </div>
            <div class="holding-value">${formatCurrency(holding.value)}</div>
        `;
        topHoldingsEl.appendChild(li);
    });
}

// Update portfolio value
function updatePortfolioValue() {
    let portfolioValue = 0;
    
    Object.keys(state.portfolio).forEach(symbol => {
        const stock = stockMap.get(symbol); // O(1) lookup instead of O(n) find
        if (stock) {
            const quantity = state.portfolio[symbol];
            portfolioValue += stock.price * quantity;
        }
    });
    
    portfolioValueEl.textContent = formatCurrency(portfolioValue);
    totalValueEl.textContent = formatCurrency(state.balance + portfolioValue);
}

// Open stock detail modal
function openStockDetail(stock) {
    state.selectedStock = stock;
    
    modalStockName.textContent = stock.name;
    modalStockSymbol.textContent = stock.symbol;
    modalStockPrice.textContent = formatCurrency(stock.price);
    modalStockDescription.textContent = stock.description;
    
    modalStockChange.textContent = `${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent}%`;
    modalStockChange.className = stock.changePercent >= 0 ? 'positive' : 'negative';
    
    const ownedQuantity = state.portfolio[stock.symbol] || 0;
    ownedQuantityEl.textContent = ownedQuantity;
    ownedValueEl.textContent = formatCurrency(ownedQuantity * stock.price);
    
    sellButton.disabled = ownedQuantity <= 0;
    
    tradeQuantityInput.value = 1;
    updateTradeTotal();
    
    stockModal.style.display = 'block';
}

// Update trade total when quantity changes
function updateTradeTotal() {
    if (state.selectedStock) {
        const quantity = parseInt(tradeQuantityInput.value) || 0;
        const total = quantity * state.selectedStock.price;
        tradeTotalEl.textContent = formatCurrency(total);
    }
}

// Buy stock
function buyStock(stock, quantity) {
    if (quantity <= 0) {
        alert('Please enter a valid quantity');
        return;
    }
    
    const total = stock.price * quantity;
    
    if (total > state.balance) {
        alert('Not enough funds to complete this purchase');
        return;
    }
    
    // Update portfolio
    if (state.portfolio[stock.symbol]) {
        state.portfolio[stock.symbol] += quantity;
    } else {
        state.portfolio[stock.symbol] = quantity;
    }
    
    // Update balance
    state.balance -= total;
    
    // Record transaction
    const transaction = {
        type: 'buy',
        symbol: stock.symbol,
        quantity: quantity,
        price: stock.price,
        total: total,
        year: TIMELINE[state.timelineIdx]
    };
    
    state.transactions.push(transaction);
    
    // Update UI
    updateUI();
    
    // Update modal
    const ownedQuantity = state.portfolio[stock.symbol];
    ownedQuantityEl.textContent = ownedQuantity;
    ownedValueEl.textContent = formatCurrency(ownedQuantity * stock.price);
    sellButton.disabled = false;
    
    saveState();
}

// Sell stock
function sellStock(stock, quantity) {
    if (quantity <= 0) {
        alert('Please enter a valid quantity');
        return;
    }
    
    const ownedQuantity = state.portfolio[stock.symbol] || 0;
    
    if (quantity > ownedQuantity) {
        alert(`You only own ${ownedQuantity} shares of ${stock.symbol}`);
        return;
    }
    
    const total = stock.price * quantity;
    
    // Update portfolio
    state.portfolio[stock.symbol] -= quantity;
    
    // Remove stock from portfolio if quantity is 0
    if (state.portfolio[stock.symbol] === 0) {
        delete state.portfolio[stock.symbol];
    }
    
    // Update balance
    state.balance += total;
    
    // Record transaction
    const transaction = {
        type: 'sell',
        symbol: stock.symbol,
        quantity: quantity,
        price: stock.price,
        total: total,
        timestamp: Date.now(),
        year: state.year
    };
    
    state.transactions.push(transaction);
    
    // Update UI
    updateUI();
    
    // Update modal
    const newOwnedQuantity = state.portfolio[stock.symbol] || 0;
    ownedQuantityEl.textContent = newOwnedQuantity;
    ownedValueEl.textContent = formatCurrency(newOwnedQuantity * stock.price);
    sellButton.disabled = newOwnedQuantity <= 0;
    
    saveState();
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount);
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);