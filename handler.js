import YahooMarket from './yahooMarket.mjs';

const initialDate = new Date("2000-01-01")
const market = new YahooMarket()

export const handler = async (event) => {
  const body = JSON.parse(event.body)
  if (!body.symbol) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Symbol is required",
      }),
    };
  }
  if (!body.year) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Year is required",
      }),
    };
  }
  const year = body.year;

  let simulationDate = new Date(initialDate)
  simulationDate.setFullYear(initialDate.getFullYear() + year - 1);

  try {
    const price = await market.getPrice(body.symbol, simulationDate)  
    return JSON.stringify({ symbol: body.symbol, price: price });
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: error.message,
      }),
    };
  }
};

//handler({symbol: "ALF", year: 5}).then(response => console.log(response));
