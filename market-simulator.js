// Annual Market Simulator Application
class MarketSimulator {
    constructor() {
        // Base stock data for 2020
        this.baseStocks = [
            { symbol: 'AAPL', name: 'Apple Inc.', basePrice: 80.00 },
            { symbol: 'GOOGL', name: 'Alphabet Inc.', basePrice: 1500.00 },
            { symbol: 'MSFT', name: 'Microsoft Corp.', basePrice: 200.00 },
            { symbol: 'AMZN', name: 'Amazon.com Inc.', basePrice: 2000.00 },
            { symbol: 'TSLA', name: 'Tesla Inc.', basePrice: 400.00 },
            { symbol: 'META', name: 'Meta Platforms Inc.', basePrice: 200.00 },
            { symbol: 'NVDA', name: 'NVIDIA Corp.', basePrice: 200.00 },
            { symbol: 'NFLX', name: 'Netflix Inc.', basePrice: 300.00 }
        ];

        this.currentYear = 2024;
        this.minYear = 2020;
        this.maxYear = 2030;
        this.stocks = [];
        this.annualData = {};
        
        this.portfolio = {
            cash: 10000.00,
            holdings: {},
            totalValue: 10000.00,
            yearStartValue: 10000.00
        };

        this.orderHistory = [];
        this.selectedStock = null;
        this.chart = null;
        this.isMarketOpen = true;
        this.currentOrderType = 'buy';
        this.commissionRate = 0.0025; // 0.25% commission

        this.initializeApp();
        this.generateAnnualData();
        this.updateStocksForCurrentYear();
    }

    initializeApp() {
        this.renderStocks();
        this.updatePortfolio();
        this.setupEventListeners();
        this.updateYearDisplay();
    }

    generateAnnualData() {
        // Generate realistic annual price changes for each stock
        this.baseStocks.forEach(stock => {
            this.annualData[stock.symbol] = {};
            let currentPrice = stock.basePrice;
            
            for (let year = this.minYear; year <= this.maxYear; year++) {
                // Generate realistic annual returns (-30% to +50%)
                const annualReturn = (Math.random() - 0.3) * 0.8; // Bias towards positive returns
                const newPrice = currentPrice * (1 + annualReturn);
                
                this.annualData[stock.symbol][year] = {
                    price: newPrice,
                    change: newPrice - currentPrice,
                    changePercent: (annualReturn * 100),
                    volume: Math.floor(Math.random() * 100000000) + 1000000
                };
                
                currentPrice = newPrice;
            }
        });
    }

    updateStocksForCurrentYear() {
        this.stocks = this.baseStocks.map(stock => {
            const yearData = this.annualData[stock.symbol][this.currentYear];
            return {
                symbol: stock.symbol,
                name: stock.name,
                price: yearData.price,
                change: yearData.change,
                changePercent: yearData.changePercent,
                volume: yearData.volume
            };
        });
    }

    updateYearDisplay() {
        const yearElement = document.getElementById('currentYear');
        if (yearElement) {
            yearElement.textContent = this.currentYear;
        }
    }

    changeYear(direction) {
        const newYear = this.currentYear + direction;
        if (newYear >= this.minYear && newYear <= this.maxYear) {
            this.currentYear = newYear;
            this.updateStocksForCurrentYear();
            this.updateYearDisplay();
            this.renderStocks();
            this.updatePortfolio();
            
            // Update trading section if open
            if (this.selectedStock) {
                this.updateTradingSection();
            }
        }
    }



    renderStocks() {
        const marketTableBody = document.getElementById('marketTableBody');
        if (!marketTableBody) {
            console.error('marketTableBody not found!');
            return;
        }
        marketTableBody.innerHTML = '';

        this.stocks.forEach(stock => {
            const row = document.createElement('tr');
            row.className = 'market-row';
            row.dataset.symbol = stock.symbol;
            
            const changeClass = stock.change >= 0 ? 'positive' : 'negative';
            const changeSymbol = stock.change >= 0 ? '+' : '';
            
            row.innerHTML = `
                <td class="name-symbol-cell">
                    <div class="stock-name">${stock.name}</div>
                </td>
                <td class="price-cell">€${stock.price.toFixed(2)}</td>
                <td class="change-cell ${changeClass}">
                    ${changeSymbol}${stock.changePercent.toFixed(2)}%
                </td>
            `;
            
            // Make the entire row clickable
            row.style.cursor = 'pointer';
            row.addEventListener('click', (e) => {
                console.log('Row clicked for stock:', stock.symbol);
                e.preventDefault();
                e.stopPropagation();
                try {
                    this.openTradingSection(stock);
                } catch (error) {
                    console.error('Error in openTradingSection:', error);
                }
            });

            marketTableBody.appendChild(row);
        });
    }

    selectStock(stock) {
        this.selectedStock = stock;
    }

    selectStockFromTable(symbol) {
        const stock = this.stocks.find(s => s.symbol === symbol);
        if (stock) {
            this.selectStock(stock);
        }
    }

    openTradingSection(stock) {
        console.log('openTradingSection called with stock:', stock);
        
        if (!stock) {
            console.error('No stock provided to openTradingSection');
            return;
        }
        
        this.selectedStock = stock;
        
        // Update stock details
        const symbolElement = document.getElementById('tradingInstrumentSymbol');
        const nameElement = document.getElementById('tradingInstrumentName');
        const priceElement = document.getElementById('tradingCurrentPrice');
        
        if (symbolElement) symbolElement.textContent = stock.symbol;
        if (nameElement) nameElement.textContent = stock.name;
        if (priceElement) priceElement.textContent = `€${stock.price.toFixed(2)}`;
        
        // Update price change
        const changeSymbol = stock.change >= 0 ? '+' : '';
        const changeClass = stock.change >= 0 ? 'positive' : 'negative';
        const priceChangeElement = document.getElementById('tradingPriceChange');
        priceChangeElement.textContent = `${changeSymbol}€${stock.change.toFixed(2)} (${changeSymbol}${stock.changePercent.toFixed(2)}%)`;
        priceChangeElement.className = `price-change ${changeClass}`;
        
        
        // Update chart
        this.updateTradingChart();
        
        // Reset form
        document.getElementById('tradingQuantity').value = 1;
        document.getElementById('tradingPrice').value = stock.price.toFixed(2);
        
        // Reset switch to buy (unchecked = buy, checked = sell)
        document.getElementById('orderSideSwitch').checked = false;
        
        // Reset timeline points
        document.querySelectorAll('#tradingTab .timeline-point').forEach(point => point.classList.remove('active'));
        document.querySelector('#tradingTab .timeline-point[data-period="1D"]').classList.add('active');
        
        // Update order summary
        this.updateTradingOrderSummary();
        
        
        // Show trading section in market tab
        this.showTradingInMarket();
        
        console.log('Trading section opened successfully');
    }

    showTradingInMarket() {
        // Hide market table
        const marketTable = document.querySelector('.market-table-container');
        if (marketTable) {
            marketTable.style.display = 'none';
        }
        
        // Hide the old trading section in market tab
        const oldTradingSection = document.querySelector('.trading-section');
        if (oldTradingSection) {
            oldTradingSection.style.display = 'none';
        }
        
        // Hide the old chart section in market tab
        const oldChartSection = document.querySelector('.chart-section');
        if (oldChartSection) {
            oldChartSection.style.display = 'none';
        }
        
        // Hide the market data section
        const marketDataSection = document.querySelector('.market-data-section');
        if (marketDataSection) {
            marketDataSection.style.display = 'none';
        }
        
        // Show trading section
        const tradingTab = document.getElementById('tradingTab');
        if (tradingTab) {
            tradingTab.style.display = 'block';
        }
        
        // Show back button
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.classList.add('visible');
        }
        
        // Scroll to top
        window.scrollTo(0, 0);
    }

    hideTradingInMarket() {
        // Show market table
        const marketTable = document.querySelector('.market-table-container');
        if (marketTable) {
            marketTable.style.display = 'block';
        }
        
        // Show the old trading section in market tab
        const oldTradingSection = document.querySelector('.trading-section');
        if (oldTradingSection) {
            oldTradingSection.style.display = 'block';
        }
        
        // Show the old chart section in market tab
        const oldChartSection = document.querySelector('.chart-section');
        if (oldChartSection) {
            oldChartSection.style.display = 'block';
        }
        
        // Show the market data section
        const marketDataSection = document.querySelector('.market-data-section');
        if (marketDataSection) {
            marketDataSection.style.display = 'block';
        }
        
        // Hide trading section
        const tradingTab = document.getElementById('tradingTab');
        if (tradingTab) {
            tradingTab.style.display = 'none';
        }
        
        // Hide back button
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.classList.remove('visible');
        }
        
        // Reset selected stock
        this.selectedStock = null;
    }


    updateTradingChart(symbol) {
        const ctx = document.getElementById('tradingChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.tradingChart) {
            this.tradingChart.destroy();
        }

        if (!this.selectedStock) return;

        // Generate annual price data for the chart
        const data = this.generateAnnualChartData(symbol);
        
        this.tradingChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: symbol,
                    data: data.prices,
                    borderColor: '#1e3a8a',
                    backgroundColor: 'rgba(30, 58, 138, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 0
                },
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Année'
                        }
                    },
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Prix (€)'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                elements: {
                    point: {
                        radius: 3,
                        hoverRadius: 5
                    }
                }
            }
        });
    }

    generateAnnualChartData(symbol) {
        const labels = [];
        const prices = [];
        
        for (let year = this.minYear; year <= this.currentYear; year++) {
            labels.push(year.toString());
            prices.push(this.annualData[symbol][year].price);
        }
        
        return { labels, prices };
    }

    processTradeFromWindow(tradeData) {
        console.log('Processing trade from window:', tradeData);
        
        // Execute the trade
        if (tradeData.side === 'buy') {
            this.portfolio.cash -= tradeData.total;
            this.portfolio.holdings[tradeData.symbol] = (this.portfolio.holdings[tradeData.symbol] || 0) + tradeData.quantity;
        } else {
            const currentHoldings = this.portfolio.holdings[tradeData.symbol] || 0;
            this.portfolio.cash += tradeData.value - tradeData.commission;
            this.portfolio.holdings[tradeData.symbol] = currentHoldings - tradeData.quantity;
            if (this.portfolio.holdings[tradeData.symbol] === 0) {
                delete this.portfolio.holdings[tradeData.symbol];
            }
        }

        // Add to order history
        this.orderHistory.unshift({
            id: Date.now(),
            symbol: tradeData.symbol,
            side: tradeData.side,
            quantity: tradeData.quantity,
            price: tradeData.price,
            value: tradeData.value,
            commission: tradeData.commission,
            total: tradeData.total,
            timestamp: tradeData.timestamp,
            status: tradeData.status
        });

        // Update portfolio and UI
        this.updatePortfolio();
        this.renderOrderHistory();
        
        console.log('Trade processed successfully');
    }

    closeTradingSection() {
        // Hide trading section and show market table
        this.hideTradingInMarket();
    }

    goBack() {
        // Close trading section and return to previous view
        this.closeTradingSection();
    }



    updateTradingOrderSummary() {
        const quantity = parseInt(document.getElementById('tradingQuantity').value) || 0;
        const price = parseFloat(document.getElementById('tradingPrice').value) || 0;
        const orderValue = quantity * price;
        const commission = orderValue * this.commissionRate;
        const totalCost = orderValue + commission;

        document.getElementById('tradingOrderValue').textContent = `€${orderValue.toFixed(2)}`;
        document.getElementById('tradingCommission').textContent = `€${commission.toFixed(2)}`;
        document.getElementById('tradingTotalCost').textContent = `€${totalCost.toFixed(2)}`;
    }

    executeTradingOrder() {
        if (!this.selectedStock) {
            alert('Aucun instrument sélectionné.');
            return;
        }

        const quantity = parseInt(document.getElementById('tradingQuantity').value);
        const orderSide = document.getElementById('orderSideSwitch').checked ? 'sell' : 'buy';
        
        if (!quantity || quantity <= 0) {
            alert('Veuillez entrer une quantité valide.');
            return;
        }

        const price = parseFloat(document.getElementById('tradingPrice').value);

        const orderValue = quantity * price;
        const commission = orderValue * this.commissionRate;
        const totalCost = orderValue + commission;

        if (orderSide === 'buy' && totalCost > this.portfolio.cash) {
            alert('Fonds insuffisants pour cet ordre.');
            return;
        }

        // Execute the trade
        if (orderSide === 'buy') {
            this.portfolio.cash -= totalCost;
            this.portfolio.holdings[this.selectedStock.symbol] = (this.portfolio.holdings[this.selectedStock.symbol] || 0) + quantity;
        } else {
            const currentHoldings = this.portfolio.holdings[this.selectedStock.symbol] || 0;
            if (quantity > currentHoldings) {
                alert('Vous ne possédez pas assez d\'actions pour cette vente.');
                return;
            }
            this.portfolio.cash += orderValue - commission;
            this.portfolio.holdings[this.selectedStock.symbol] = currentHoldings - quantity;
            if (this.portfolio.holdings[this.selectedStock.symbol] === 0) {
                delete this.portfolio.holdings[this.selectedStock.symbol];
            }
        }

        // Add to order history
        this.orderHistory.unshift({
            id: Date.now(),
            symbol: this.selectedStock.symbol,
            side: orderSide,
            quantity: quantity,
            price: price,
            value: orderValue,
            commission: commission,
            total: totalCost,
            timestamp: new Date(),
            status: 'Exécuté'
        });

        // Update portfolio and UI
        this.updatePortfolio();
        this.renderOrderHistory();
        
        // Hide trading section and show market table
        this.hideTradingInMarket();
        
        // Show success message
        const sideText = orderSide === 'buy' ? 'ACHAT' : 'VENTE';
        alert(`Ordre d'${sideText} exécuté avec succès !`);
    }



    formatVolume(volume) {
        if (volume >= 1000000) {
            return (volume / 1000000).toFixed(1) + 'M';
        } else if (volume >= 1000) {
            return (volume / 1000).toFixed(1) + 'K';
        }
        return volume.toString();
    }

    updatePortfolio() {
        // Calculate total portfolio value
        let holdingsValue = 0;
        Object.keys(this.portfolio.holdings).forEach(symbol => {
            const stock = this.stocks.find(s => s.symbol === symbol);
            if (stock) {
                holdingsValue += this.portfolio.holdings[symbol] * stock.price;
            }
        });

        this.portfolio.totalValue = this.portfolio.cash + holdingsValue;
        const dayChange = this.portfolio.totalValue - this.portfolio.dayStartValue;
        const dayChangePercent = (dayChange / this.portfolio.dayStartValue) * 100;

        // Update UI
        document.getElementById('cashBalance').textContent = `€${this.portfolio.cash.toFixed(2)}`;
        document.getElementById('investedValue').textContent = `€${holdingsValue.toFixed(2)}`;
        document.getElementById('totalValue').textContent = `€${this.portfolio.totalValue.toFixed(2)}`;
        
        const dayChangeElement = document.getElementById('dayChange');
        const changeSymbol = dayChange >= 0 ? '+' : '';
        dayChangeElement.textContent = `${changeSymbol}€${dayChange.toFixed(2)} (${changeSymbol}${dayChangePercent.toFixed(2)}%)`;
        dayChangeElement.className = `performance-value ${dayChange >= 0 ? 'positive' : 'negative'}`;

        // Update portfolio summary bar
        this.updatePortfolioSummary(holdingsValue, dayChange, dayChangePercent);

        this.renderPositions();
    }

    updatePortfolioSummary(holdingsValue, dayChange, dayChangePercent) {
        // Calculate buying power (cash available for trading)
        const buyingPower = this.portfolio.cash;
        
        // Update main portfolio summary in header
        document.getElementById('portfolioTotalValueInline').textContent = `€${this.portfolio.totalValue.toFixed(2)}`;
        
        const changeSymbol = dayChange >= 0 ? '+' : '';
        const changeElement = document.getElementById('portfolioChangeValueInline');
        changeElement.textContent = `${changeSymbol}€${dayChange.toFixed(2)} (${changeSymbol}${dayChangePercent.toFixed(2)}%)`;
        changeElement.className = `portfolio-change-value-inline ${dayChange >= 0 ? 'positive' : 'negative'}`;

        // Update detailed view in dropdown
        document.getElementById('detailBuyingPower').textContent = `€${buyingPower.toFixed(2)}`;
        document.getElementById('detailCash').textContent = `€${this.portfolio.cash.toFixed(2)}`;
        
        const dayPLElement = document.getElementById('detailDayPL');
        dayPLElement.textContent = `${changeSymbol}€${dayChange.toFixed(2)} (${changeSymbol}${dayChangePercent.toFixed(2)}%)`;
        dayPLElement.className = `detail-value ${dayChange >= 0 ? 'positive' : 'negative'}`;
        
        const totalPLElement = document.getElementById('detailTotalPL');
        totalPLElement.textContent = `${changeSymbol}€${dayChange.toFixed(2)} (${changeSymbol}${dayChangePercent.toFixed(2)}%)`;
        totalPLElement.className = `detail-value ${dayChange >= 0 ? 'positive' : 'negative'}`;
    }

    toggleSearchBar() {
        const searchModal = document.getElementById('searchModal');
        const isVisible = searchModal.style.display !== 'none';
        
        if (isVisible) {
            this.closeSearchModal();
        } else {
            this.openSearchModal();
        }
    }

    openSearchModal() {
        const searchModal = document.getElementById('searchModal');
        searchModal.style.display = 'flex';
        
        // Focus on the search input when shown
        setTimeout(() => {
            document.getElementById('searchInput').focus();
        }, 100);
        
        // Populate initial search results
        this.populateSearchResults();
    }

    closeSearchModal() {
        const searchModal = document.getElementById('searchModal');
        searchModal.style.display = 'none';
        
        // Clear search input
        document.getElementById('searchInput').value = '';
        
        // Clear search results
        document.getElementById('searchResults').innerHTML = '';
    }

    togglePortfolioDetails() {
        const details = document.getElementById('portfolioDetailsBar');
        const expandBtn = document.getElementById('portfolioExpandBtnInline');
        
        if (details.style.display === 'none' || details.style.display === '') {
            details.style.display = 'block';
            expandBtn.classList.add('expanded');
        } else {
            details.style.display = 'none';
            expandBtn.classList.remove('expanded');
        }
    }


    renderPositions() {
        const positionsList = document.getElementById('positionsList');
        positionsList.innerHTML = '';

        Object.keys(this.portfolio.holdings).forEach(symbol => {
            const quantity = this.portfolio.holdings[symbol];
            const stock = this.stocks.find(s => s.symbol === symbol);
            
            if (stock && quantity > 0) {
                const value = quantity * stock.price;
                const change = stock.change * quantity;
                const changeClass = change >= 0 ? 'positive' : 'negative';
                
                const positionItem = document.createElement('div');
                positionItem.className = 'position-item';
                positionItem.innerHTML = `
                    <div class="position-symbol">${symbol}</div>
                    <div class="position-details">
                        <div class="position-quantity">${quantity} actions</div>
                        <div class="position-value">€${value.toFixed(2)}</div>
                        <div class="performance-value ${changeClass}">
                            ${change >= 0 ? '+' : ''}€${change.toFixed(2)}
                        </div>
                    </div>
                `;
                positionsList.appendChild(positionItem);
            }
        });

        if (Object.keys(this.portfolio.holdings).length === 0) {
            positionsList.innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 20px; font-size: 13px;">Aucune position pour le moment. Commencez à trader !</div>';
        }
    }

    setupEventListeners() {
        // Back button functionality
        document.getElementById('backBtn').addEventListener('click', () => {
            this.goBack();
        });

        // Year navigation buttons
        document.getElementById('prevYearBtn').addEventListener('click', () => {
            this.changeYear(-1);
        });

        document.getElementById('nextYearBtn').addEventListener('click', () => {
            this.changeYear(1);
        });

        // Portfolio toggle buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                const view = e.target.dataset.view;
                if (view === 'overview') {
                    document.getElementById('portfolioOverview').style.display = 'block';
                    document.getElementById('positionsList').style.display = 'none';
                } else {
                    document.getElementById('portfolioOverview').style.display = 'none';
                    document.getElementById('positionsList').style.display = 'block';
                }
            });
        });



        // Search functionality
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchStocks(e.target.value);
        });

        // Market search functionality
        document.getElementById('marketSearchInput').addEventListener('input', (e) => {
            this.filterStocks(e.target.value);
        });

        // Close search modal button
        document.getElementById('closeSearchBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.closeSearchModal();
        });

        // Tab switching functionality
        document.querySelectorAll('.btn-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.closest('.btn-tab').dataset.tab;
                this.switchTab(tabName);
                
                // Hide trading section when switching tabs
                this.hideTradingInMarket();
            });
        });

        // Search toggle functionality
        document.getElementById('searchToggleBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSearchBar();
        });

        // Portfolio details expand functionality
        document.getElementById('portfolioExpandBtnInline').addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePortfolioDetails();
        });





        // Trading section event listeners
        document.getElementById('tradingQuantity').addEventListener('input', () => {
            this.updateTradingOrderSummary();
        });

        document.getElementById('tradingPrice').addEventListener('input', () => {
            this.updateTradingOrderSummary();
        });

        // Execute button in trading section
        document.getElementById('tradingExecuteBtn').addEventListener('click', () => {
            this.executeTradingOrder();
        });

        // Chart timeline points in trading section
        document.querySelectorAll('#tradingTab .timeline-point').forEach(point => {
            point.addEventListener('click', (e) => {
                document.querySelectorAll('#tradingTab .timeline-point').forEach(p => p.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                const period = e.currentTarget.dataset.period;
                if (this.selectedStock) {
                    this.updateTradingChart(this.selectedStock.symbol);
                }
            });
        });
    }



    renderOrderHistory() {
        const orderHistoryBody = document.getElementById('orderHistory');
        orderHistoryBody.innerHTML = '';

        this.orderHistory.slice(0, 20).forEach(order => {
            const row = document.createElement('tr');
            const sideText = order.side === 'buy' ? 'ACHAT' : 'VENTE';
            row.innerHTML = `
                <td>${order.timestamp.toLocaleTimeString()}</td>
                <td>${order.symbol}</td>
                <td class="side-${order.side}">${sideText}</td>
                <td>${order.quantity}</td>
                <td>€${order.price.toFixed(2)}</td>
                <td class="status-${order.status.toLowerCase()}">${order.status}</td>
            `;
            orderHistoryBody.appendChild(row);
        });
    }

    populateSearchResults() {
        const searchResults = document.getElementById('searchResults');
        searchResults.innerHTML = '';
        
        this.stocks.forEach(stock => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            resultItem.onclick = () => this.selectStockFromSearch(stock);
            
            const changeSymbol = stock.change >= 0 ? '+' : '';
            const changeClass = stock.change >= 0 ? 'positive' : 'negative';
            
            resultItem.innerHTML = `
                <div class="search-result-info">
                    <div class="search-result-symbol">${stock.symbol}</div>
                    <div class="search-result-name">${stock.name}</div>
                </div>
                <div class="search-result-price">
                    <div class="search-result-current-price">€${stock.price.toFixed(2)}</div>
                    <div class="search-result-change ${changeClass}">${changeSymbol}€${stock.change.toFixed(2)} (${changeSymbol}${stock.changePercent.toFixed(2)}%)</div>
                </div>
            `;
            
            searchResults.appendChild(resultItem);
        });
    }

    searchStocks(searchTerm) {
        const searchResults = document.getElementById('searchResults');
        const term = searchTerm.toLowerCase();
        
        if (term === '') {
            this.populateSearchResults();
            return;
        }
        
        searchResults.innerHTML = '';
        
        const filteredStocks = this.stocks.filter(stock => 
            stock.symbol.toLowerCase().includes(term) || 
            stock.name.toLowerCase().includes(term)
        );
        
        filteredStocks.forEach(stock => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            resultItem.onclick = () => this.selectStockFromSearch(stock);
            
            const changeSymbol = stock.change >= 0 ? '+' : '';
            const changeClass = stock.change >= 0 ? 'positive' : 'negative';
            
            resultItem.innerHTML = `
                <div class="search-result-info">
                    <div class="search-result-symbol">${stock.symbol}</div>
                    <div class="search-result-name">${stock.name}</div>
                </div>
                <div class="search-result-price">
                    <div class="search-result-current-price">€${stock.price.toFixed(2)}</div>
                    <div class="search-result-change ${changeClass}">${changeSymbol}€${stock.change.toFixed(2)} (${changeSymbol}${stock.changePercent.toFixed(2)}%)</div>
                </div>
            `;
            
            searchResults.appendChild(resultItem);
        });
    }

    selectStockFromSearch(stock) {
        this.closeSearchModal();
        this.openTradingSection(stock);
    }

    filterStocks(searchTerm) {
        const rows = document.querySelectorAll('.market-row');
        const term = searchTerm.toLowerCase();
        
        rows.forEach(row => {
            const symbol = row.querySelector('.symbol-cell').textContent.toLowerCase();
            const name = row.querySelector('.name-cell').textContent.toLowerCase();
            
            if (symbol.includes(term) || name.includes(term)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    switchTab(tabName) {
        // Remove active class from all tabs and content
        document.querySelectorAll('.btn-tab').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to selected tab and content
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.add('active');
        
        // Chart updates are now handled in the trading section
        
        // Update portfolio if switching to portfolio tab
        if (tabName === 'portfolio') {
            this.updatePortfolio();
        }
        
        // Update order history if switching to history tab
        if (tabName === 'history') {
            this.renderOrderHistory();
        }
    }

    updateTradingSection() {
        if (this.selectedStock) {
            const stock = this.stocks.find(s => s.symbol === this.selectedStock.symbol);
            if (stock) {
                document.getElementById('tradingInstrumentSymbol').textContent = stock.symbol;
                document.getElementById('tradingInstrumentName').textContent = stock.name;
                document.getElementById('tradingCurrentPrice').textContent = `€${stock.price.toFixed(2)}`;
                
                const changeClass = stock.change >= 0 ? 'positive' : 'negative';
                const changeSymbol = stock.change >= 0 ? '+' : '';
                document.getElementById('tradingPriceChange').textContent = 
                    `${changeSymbol}€${stock.change.toFixed(2)} (${changeSymbol}${stock.changePercent.toFixed(2)}%)`;
                document.getElementById('tradingPriceChange').className = `price-change ${changeClass}`;
                
                document.getElementById('tradingPrice').value = stock.price.toFixed(2);
                this.updateTradingChart();
            }
        }
    }




    // Market open/close simulation
    toggleMarket() {
        this.isMarketOpen = !this.isMarketOpen;
        const statusElement = document.getElementById('marketStatus');
        const statusDot = document.getElementById('marketStatusDot');
        
        if (this.isMarketOpen) {
            statusElement.textContent = 'Marché Ouvert';
            statusDot.style.background = '#1e3a8a';
        } else {
            statusElement.textContent = 'Marché Fermé';
            statusDot.style.background = '#e74c3c';
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.marketSimulator = new MarketSimulator();
});

// Add some additional utility functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount);
}

function formatPercent(value) {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Space bar to toggle market
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        if (window.marketSimulator) {
            window.marketSimulator.toggleMarket();
        }
    }
});

// Make the simulator globally accessible for debugging
window.MarketSimulator = MarketSimulator;
