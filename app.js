// Constants
const INITIAL_BALANCE = 1000;
const INITIAL_YEAR = 1;
const TIMELINE = [1, 3, 5, 10, 15, 25]

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

// Initialize the application
function init() {
    loadState();
    if (!state.stocks || state.stocks.length === 0) {
        state.balance = INITIAL_BALANCE;
        state.timelineIdx = 0;
        Promise.all([generateStocks(), generateETFs()]).then(() => {
            updateUI();
            setupEventListeners();

            loadingContainer.style.display = 'none';
            contentDiv.style.display = 'block';
        })
    } else {
        // Update stock map cache for loaded stocks
        updateStockMap();
        // Filter out ETFs with invalid prices from loaded state
        if (state.etfs && state.etfs.length > 0) {
            state.etfs = state.etfs.filter(etf => 
                etf.price !== null && 
                etf.price !== undefined && 
                !isNaN(etf.price) && 
                etf.price > 0
            );
        }
        // Generate ETFs if not already loaded or if all were filtered out
        if (!state.etfs || state.etfs.length === 0) {
            generateETFs().then(() => {
                updateUI();
            });
        }
        updateUI();
        setupEventListeners();

        loadingContainer.style.display = 'none';
        contentDiv.style.display = 'block';
    }
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
    
    // Fetch all stock prices in parallel with progress tracking
    const stockPromises = marketData.map(async (company, index) => {
        try {
            const basePrice = await getStockPrice(company.displayedSymbol, TIMELINE[state.timelineIdx], 5000);
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
    
    // Fetch all ETF prices in parallel with progress tracking
    const etfPromises = etfData.map(async (etf) => {
        try {
            const basePrice = await getStockPrice(etf.displayedSymbol, TIMELINE[state.timelineIdx], 5000);
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
    state.timelineIdx++
    if (state.timelineIdx >= TIMELINE.length) {
        // Show results when reaching year 25
        showResults();
        return
    }
    loadingContainer.style.display = 'flex';
    contentDiv.style.display = 'none';

    // Fetch all stock prices in parallel - using map instead of forEach
    // forEach doesn't properly handle async operations
    const stockPromises = state.stocks.map(async (stock) => {
        try {
            stock.previousPrice = stock.price;
            const newPrice = await getStockPrice(stock.symbol, TIMELINE[state.timelineIdx]);
            stock.price = parseFloat(newPrice.toFixed(2));
            stock.change = parseFloat((stock.price - stock.previousPrice).toFixed(2));
            stock.changePercent = parseFloat((((stock.price - stock.previousPrice) / stock.previousPrice) * 100).toFixed(2));
        } catch (error) {
            console.error(`Failed to update price for ${stock.symbol}:`, error);
            // Keep the previous price if update fails
        }
    });
    
    // Also update ETF prices
    const etfPromises = (state.etfs || []).map(async (etf) => {
        try {
            etf.previousPrice = etf.price;
            const newPrice = await getStockPrice(etf.displayedSymbol, TIMELINE[state.timelineIdx]);
            // Only update if new price is valid
            if (newPrice !== null && newPrice !== undefined && !isNaN(newPrice) && newPrice > 0) {
                etf.price = parseFloat(newPrice.toFixed(2));
                etf.change = parseFloat((etf.price - etf.previousPrice).toFixed(2));
                etf.changePercent = parseFloat((((etf.price - etf.previousPrice) / etf.previousPrice) * 100).toFixed(2));
            } else {
                // Mark ETF as invalid by setting price to null
                etf.price = null;
            }
        } catch (error) {
            console.error(`Failed to update price for ETF ${etf.displayedSymbol}:`, error);
            // Mark ETF as invalid by setting price to null
            etf.price = null;
        }
    });
    
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
    // Calculate initial investment (sum of all buy transactions)
    const initialInvestment = state.transactions
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
    
    // Calculate gains
    const totalGains = finalValue - INITIAL_BALANCE;
    
    // Calculate ROI Total (Return on Initial Capital)
    const roiTotal = INITIAL_BALANCE > 0 
        ? ((totalGains / INITIAL_BALANCE) * 100) 
        : 0;
    
    // Calculate ROI Annuel (CAGR - Compound Annual Growth Rate)
    // Number of years: from year 1 to year 25 = 24 years
    const numberOfYears = TIMELINE[TIMELINE.length - 1] - TIMELINE[0];
    const roiAnnual = INITIAL_BALANCE > 0 && finalValue > 0 && numberOfYears > 0
        ? ((Math.pow(finalValue / INITIAL_BALANCE, 1 / numberOfYears) - 1) * 100)
        : 0;
    
    // Update results display
    const initialInvestmentEl = document.getElementById('initial-investment');
    const finalValueEl = document.getElementById('final-value');
    const totalGainsEl = document.getElementById('total-gains');
    const roiTotalEl = document.getElementById('roi-total');
    const roiAnnualEl = document.getElementById('roi-annual');
    const initialCapitalEl = document.getElementById('initial-capital');
    const remainingCashEl = document.getElementById('remaining-cash');
    const finalPortfolioValueEl = document.getElementById('final-portfolio-value');
    
    if (initialInvestmentEl) initialInvestmentEl.textContent = formatCurrency(initialInvestment);
    if (finalValueEl) finalValueEl.textContent = formatCurrency(finalValue);
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
    saveState();
}

// Reset the application to initial state
async function resetApplication() {
    if (!confirm('Êtes-vous sûr de vouloir réinitialiser l\'application ? Toutes vos données seront perdues.')) {
        return;
    }
    
    loadingContainer.style.display = 'flex';
    contentDiv.style.display = 'none';
    
    // Clear localStorage
    localStorage.removeItem('marketSimState');
    
    // Reset state to initial values
    state = {
        balance: INITIAL_BALANCE,
        portfolio: {},
        transactions: [],
        stocks: [],
        currentView: 'dashboard',
        selectedStock: null,
        timelineIdx: 0,
    };
    
    // Close modal if open
    if (stockModal) {
        stockModal.style.display = 'none';
    }
    
    // Regenerate stocks and ETFs
    await Promise.all([generateStocks(), generateETFs()]);
    
    // Update stock map cache
    updateStockMap();
    
    // Update UI
    updateUI();
    
    // Reset view to dashboard
    changeView('dashboard');
    
    loadingContainer.style.display = 'none';
    contentDiv.style.display = 'block';
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
    const isLastYear = state.timelineIdx >= TIMELINE.length - 1;
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
            renderStockList();
            break;
        case 'etf':
            renderETFList();
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
        li.innerHTML = `
            <div class="transaction-info">
                <div class="transaction-type ${transaction.type === 'buy' ? 'transaction-buy' : 'transaction-sell'}">
                    ${transaction.type === 'buy' ? 'Acheté' : 'Vendy'} ${transaction.quantity} ${transaction.symbol}
                </div>
                <div class="transaction-details">
                    à ${formatCurrency(transaction.price)} par action (${formatCurrency(transaction.total)})
                </div>
                <div class="transaction-date">Année ${transaction.year}}</div>
            </div>
        `;
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
        li.innerHTML = `
            <div class="transaction-type ${transaction.type === 'buy' ? 'transaction-buy' : 'transaction-sell'}">
                ${transaction.type === 'buy' ? 'Acheté' : 'Vendu'} ${transaction.quantity} ${transaction.symbol}
            </div>
            <div class="transaction-date">Année ${transaction.year}</div>
        `;
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