import { MarketMakerParams, OrderBook, MandatoryHFTIter, OrderTypeStreak } from "./types";
import { USide, Market, Spin } from "@spinfi/core";
import { BigNumber } from "bignumber.js";
import { isMakeMarketNeeded } from "./checks";
import { QUOTE_DECIMAL } from "./consts"; // TODO
import * as config from "../config.json";
import {
  sleep,
  getOrderConfig,
  convertToDecimals,
  getPrice,
  userOrdersToOrderBook,
  getOrderBookFromConfig,
  changeIndexPrice,
  getRandomArbitrary
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

export async function makeMarket(params: MarketMakerParams) {
  const { spin, spinHFT, marketId, tokenRefinanceId, baseQuantity, quoteQuantity, orderDelayMs } = params;

  const market = await spin.getMarket({marketId: marketId});
  const marketHFT = await spinHFT.getMarket({marketId: marketId});
  let indexPrice = await getPrice(tokenRefinanceId);

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

    if (userOrderBook.buy.length > 0) {
      // randomSleepTimeMs = await makeHFT(tonic, tonicHFT, market, marketHFT, baseName, quoteName, mandatoryHftIter, orderTypeStreak);
    }

    if (!isMakeMarketNeeded(userOrderBook, configOrderBook, orderConfig.priceThreshold, orderConfig.quantityThreshold)) {
      await makeMarketSleep(orderDelayMs, randomSleepTimeMs);
      continue;
    }

    await makeBatch(spin, configOrderBook, userOrdersIds, market);

    await makeMarketSleep(orderDelayMs, randomSleepTimeMs);
  }
}
