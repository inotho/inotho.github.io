class YahooMarket {
  async fetchClosePrice(ticker, startDate, endDate, interval = "1d") {
    const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${startTimestamp}&period2=${endTimestamp}&interval=${interval}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      // Check if data structure is valid
      if (!data.chart || !data.chart.result || !data.chart.result[0]) {
        throw new Error(`Invalid data structure for ticker ${ticker}`);
      }
      
      const result = data.chart.result[0];
      if (!result.indicators || !result.indicators.quote || !result.indicators.quote[0]) {
        throw new Error(`No quote data available for ticker ${ticker}`);
      }
      
      const closePrices = result.indicators.quote[0].close;
      if (!closePrices || closePrices.length === 0) {
        throw new Error(`No close prices available for ticker ${ticker}`);
      }
      
      // Filter out null values and return the first valid price
      const validPrice = closePrices.find(price => price !== null && price !== undefined);
      return validPrice || null;
    } catch (error) {
      console.error(`Error fetching data for ${ticker}:`, error);
      return null;
    }
  }

  async getPrice(displayedSymbol, dateString) {
    const stock = this.getStockOrThrow(displayedSymbol);
    const date = new Date(dateString);
    const startDate = new Date(dateString);
    const endDate = new Date(date);
    endDate.setMonth(endDate.getMonth() + 1);

    // Use symbol if available, otherwise fall back to displayedSymbol
    const ticker = stock.symbol || stock.displayedSymbol;
    return await this.fetchClosePrice(ticker, startDate, endDate);
  }

  getAllDisplayedSymbols() {
    return marketData.map((stock) => stock.displayedSymbol);
  }

  getStockOrThrow(displayedSymbol) {
    const stock = marketData.find((stock) => stock.displayedSymbol === displayedSymbol);
    if (!stock) {
      throw Error(`Stock "${displayedSymbol}" doesn't exist.`);
    }
    return stock;
  }
}

// Create a global instance
const yahooMarket = new YahooMarket();

// Create getStockPrice function that matches the witsoClient API
// year is a number (1, 3, 5, 10, 15, 20, 25) representing years from 2000
async function getStockPrice(symbol, year) {
  try {
    // Convert year number to date string (assuming years from 2000)
    const baseYear = 2000;
    const targetYear = baseYear + year;
    const dateString = `${targetYear}-01-01`;
    
    const price = await yahooMarket.getPrice(symbol, dateString);
    
    if (price === null) {
      throw new Error(`Could not fetch price for ${symbol} at year ${year}`);
    }
    
    return price;
  } catch (error) {
    console.error(`Error getting stock price for ${symbol}:`, error);
    throw error;
  }
}
