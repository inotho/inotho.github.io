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
const nextDayBtn = document.getElementById('next-day-btn');
const resetBtn = document.getElementById('reset-btn');
const currentDateEl = document.getElementById('current-date');

// Initialize the application
function init() {
    loadState();
    if (!state.stocks || state.stocks.length === 0) {
        state.balance = INITIAL_BALANCE;
        state.timelineIdx = 0;
        generateStocks().then(() => {
            updateUI();
            setupEventListeners();

            loadingContainer.style.display = 'none';
            contentDiv.style.display = 'block';
        })
    } else {
        // Update stock map cache for loaded stocks
        updateStockMap();
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
    // Fetch all stock prices in parallel instead of sequentially
    // This reduces load time from ~20-40 seconds to ~1-2 seconds
    const stockPromises = marketData.map(async (company) => {
        try {
            const basePrice = await getStockPrice(company.displayedSymbol, TIMELINE[state.timelineIdx]);
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
    
    state.stocks = await Promise.all(stockPromises);
    // Update stock map cache
    updateStockMap();
}

// Update stock map cache for O(1) lookups
function updateStockMap() {
    stockMap.clear();
    state.stocks.forEach(stock => {
        stockMap.set(stock.symbol, stock);
    });
}

async function advanceToNextYear() {
    state.timelineIdx++
    if (state.timelineIdx >= TIMELINE.length) {
        return
    }
    loadingContainer.style.display = 'flex';
    contentDiv.style.display = 'none';

    // Fetch all stock prices in parallel - using map instead of forEach
    // forEach doesn't properly handle async operations
    const promises = state.stocks.map(async (stock) => {
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
    
    await Promise.all(promises);
    updateUI();
    loadingContainer.style.display = 'none';
    contentDiv.style.display = 'block';
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
    
    // Regenerate stocks
    await generateStocks();
    
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
    
    // Next day button
    nextDayBtn.addEventListener('click', advanceToNextYear);
    
    // Reset button
    resetBtn.addEventListener('click', resetApplication);
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
        case 'portfolio':
            renderPortfolioList();
            break;
        case 'history':
            renderTransactionHistory();
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