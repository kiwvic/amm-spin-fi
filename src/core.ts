import { MarketMakerParams, OrderBook, MandatoryHFTIter, OrderTypeStreak } from "./types";
import { USide, Market, Spin } from "@spinfi/core";
import { BigNumber } from "bignumber.js";
import { isMakeMarketNeeded, notEnoughFunds, } from "./checks";
import { QUOTE_DECIMAL, Buy, Sell } from "./consts"; // TODO
import * as config from "../config.json";
import {
  sleep,
  getOrderConfig,
  convertToDecimals,
  getPrice,
  userOrdersToOrderBook,
  getOrderBookFromConfig,
  changeIndexPrice,
  getRandomArbitrary,
  getBestPrice,
  calculateBestPrice,
  convertWithDecimals,
  orderTypeChangeIsNeeded
} from "./util";


BigNumber.set({ EXPONENTIAL_AT: 30 });

function createBatch(configOrderBook: OrderBook, userOrdersIds: string[], market: Market) {
  const bidOrders = configOrderBook.buy.map((o) => ({
    marketId: market.id,
    orderType: USide.Bid,
    price: convertToDecimals(o.price, QUOTE_DECIMAL),
    quantity: convertToDecimals(o.quantity),
    marketOrder: false,
  }));

  const askOrders = configOrderBook.sell.map((o) => ({
    marketId: market.id,
    orderType: USide.Ask,
    price: convertToDecimals(o.price, QUOTE_DECIMAL),
    quantity: convertToDecimals(o.quantity),
    marketOrder: false,
  }));

  return {
    ops: [{
      marketId: market.id,
      drop: userOrdersIds,
      place: [...bidOrders, ...askOrders],
    }],
  }
}

async function makeBatch(spin: Spin, configOrderBook: OrderBook, userOrdersIds: string[], market: Market) {
  const batch = createBatch(configOrderBook, userOrdersIds, market);
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    await spin.batchOps(batch);
  } catch (error) {
    console.log(error);
  }
}

async function makeMarketSleep(orderDelayMs: number, randomSleepTimeMs: number) {
  console.log(`Waiting ${orderDelayMs - randomSleepTimeMs}ms`);
  await sleep(orderDelayMs - randomSleepTimeMs);
}

async function makeHFT(
  spin: Spin, spinHFT: Spin,
  market: Market, 
  mandatoryHftIter: MandatoryHFTIter, orderTypeStreak: OrderTypeStreak
) {
  if (!config.hft) return 0;

  let randomSleepTimeMs = 0;
  const skip = Math.random() > config.hftChance;

  if (!mandatoryHftIter.appeared && mandatoryHftIter.counter >= config.mandatoryIterationRecharge) {
    console.log("!mandatoryHftIter.appeared && mandatoryHftIter.counter >= MANDATORY_ITERATION_RECHARGE");
    mandatoryHftIter.counter = 0;
  } else if (mandatoryHftIter.appeared && mandatoryHftIter.counter >= config.mandatoryIterationRecharge) {
    console.log("mandatoryHftIter.appeared && mandatoryHftIter.counter >= MANDATORY_ITERATION_RECHARGE");
    mandatoryHftIter.counter = 0;
    mandatoryHftIter.appeared = false;
    return randomSleepTimeMs;
  } else if (mandatoryHftIter.appeared) {
    console.log("mandatoryHftIter.appeared");
    mandatoryHftIter.counter += 1;
    return randomSleepTimeMs;
  } else if (skip) {
    console.log("skip");
    mandatoryHftIter.counter += 1;
    return randomSleepTimeMs;
  } 
  mandatoryHftIter.appeared = true;
  mandatoryHftIter.counter += 1;

  let randomAmount = getRandomArbitrary(config.randomTokenMin, config.randomTokenMax);
  let orderType = getRandomArbitrary(1, 2) - 1;

  const balances = await spin.getDeposits();
  const balancesHFT = await spinHFT.getDeposits();

  const baseAvailable = convertWithDecimals(balances[config.baseTokenAddress], QUOTE_DECIMAL);
  const quoteAvailable = convertWithDecimals(balances[config.quoteTokenAddress], QUOTE_DECIMAL);
  const baseHFTAvailable = convertWithDecimals(balancesHFT[config.baseTokenAddress], QUOTE_DECIMAL);
  const quoteHFTAvailable = convertWithDecimals(balancesHFT[config.quoteTokenAddress], QUOTE_DECIMAL);

  const { bestAskPrice, bestBidPrice } = getBestPrice(await spin.getOrderbook({marketId: market.id}));

  let price = calculateBestPrice(orderType, bestBidPrice, bestAskPrice);

  if (
      notEnoughFunds(baseAvailable, quoteAvailable, randomAmount, price) && 
      notEnoughFunds(baseHFTAvailable, quoteHFTAvailable, randomAmount, price)
    ) {
    return randomSleepTimeMs;
  }

  let forceChangeOrderType = false;
  if (orderType == Buy) {
    if ((quoteHFTAvailable < (randomAmount * price)) || (baseAvailable < randomAmount)) {
      orderType = orderType == Buy ? Sell : Buy;
      price = calculateBestPrice(orderType, bestBidPrice, bestAskPrice);
      forceChangeOrderType = true;
    }
  } else {
    if ((baseHFTAvailable < randomAmount) || (quoteAvailable < (randomAmount * price))) {
      orderType = orderType == Buy ? Sell : Buy;
      price = calculateBestPrice(orderType, bestBidPrice, bestAskPrice);
      forceChangeOrderType = true;
    }
  }

  if (orderTypeChangeIsNeeded(orderType, orderTypeStreak) && !forceChangeOrderType) {
    orderType = orderType == Buy ? Sell : Buy;
    randomAmount += 100;
  }

  const order = {
    marketId: market.id, 
    price: BigInt(convertToDecimals(price, QUOTE_DECIMAL)), 
    quantity: BigInt(convertToDecimals(randomAmount)), 
    marketOrder: false
  }

  if (orderType == Buy) {
    await spin.placeAsk(order);
    await spinHFT.placeBid(order);
  } else {
    await spin.placeBid(order);
    await spinHFT.placeAsk(order);
  }

  // TODO cancel orders

  return randomSleepTimeMs;
} 

export async function makeMarket(params: MarketMakerParams) {
  const { spin, spinHFT, marketId, tokenRefinanceId, baseQuantity, quoteQuantity, orderDelayMs } = params;

  const market = await spin.getMarket({marketId: marketId});

  let indexPrice = await getPrice(tokenRefinanceId);
  let mandatoryHftIter: MandatoryHFTIter = {counter: 0, appeared: false};
  let orderTypeStreak: OrderTypeStreak = {counter: 0, type: 0};
  
  while (true) {
    const orderConfig = await getOrderConfig();
    let randomSleepTimeMs = 0;

    let newPrice: number;
    try {
      newPrice = await getPrice(tokenRefinanceId);
    } catch(e: any) {
      await sleep(orderDelayMs);
      continue;
    }
    indexPrice = changeIndexPrice(indexPrice, newPrice);

    const userOrdersRaw = await spin.getOrders({ marketId: market.id });
    const userOrdersIds = userOrdersRaw.map((o) => o.id);

    const userOrderBook = userOrdersToOrderBook(userOrdersRaw);
    const configOrderBook = getOrderBookFromConfig(orderConfig, indexPrice, baseQuantity, quoteQuantity);

    if (userOrderBook.buy.length > 0 || !config.autoMarketMaker && config.hft) {
      randomSleepTimeMs = await makeHFT(spin, spinHFT, market, mandatoryHftIter, orderTypeStreak);
    }

    if (!isMakeMarketNeeded(userOrderBook, configOrderBook, orderConfig.priceThreshold, orderConfig.quantityThreshold)) {
      await makeMarketSleep(orderDelayMs, randomSleepTimeMs);
      continue;
    }

    await makeBatch(spin, configOrderBook, userOrdersIds, market);

    await makeMarketSleep(orderDelayMs, randomSleepTimeMs);
  }
}
