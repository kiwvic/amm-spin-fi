import { MarketMakerParams } from "./types";
import { createApi } from "@spinfi/node";
import * as config from "../config.json";
import { USide } from "@spinfi/core";
import { BigNumber } from "bignumber.js";
import { isMakeMarketNeeded } from "./checks";
import { USDC_DECIMAL } from "./consts"; // TODO
import {
  getKeystore,
  sleep,
  getOrderConfig,
  convertToDecimals,
  getPrice,
  userOrdersToOrderBook,
  getOrderBookFromConfig,
} from "./util";

BigNumber.set({ EXPONENTIAL_AT: 30 });

async function makeMarket(params: MarketMakerParams) {
  const {
    spin,
    market,
    tokenRefinanceId,
    baseQuantityPEM,
    baseQuantityUSDC,
    orderDelayMs,
  } = params;

  while (true) {
    const orderConfig = await getOrderConfig();
    const indexPrice = await getPrice(tokenRefinanceId);

    const userOrdersRaw = await spin.getOrders({ marketId: market.id });
    const userOrdersIds = userOrdersRaw.map((o) => o.id);

    const userOrderBook = userOrdersToOrderBook(userOrdersRaw);
    const configOrderBook = getOrderBookFromConfig(orderConfig, indexPrice, baseQuantityPEM, baseQuantityUSDC);

    if (isMakeMarketNeeded(userOrderBook, configOrderBook, orderConfig.priceThreshold, orderConfig.quantityThreshold)) {
      const bidOrders = configOrderBook.buy.map((o) => ({
        marketId: market.id,
        orderType: USide.Bid,
        price: convertToDecimals(o.price, USDC_DECIMAL),
        quantity: convertToDecimals(o.quantity),
        marketOrder: false,
      }));

      const askOrders = configOrderBook.sell.map((o) => ({
        marketId: market.id,
        orderType: USide.Ask,
        price: convertToDecimals(o.price, USDC_DECIMAL),
        quantity: convertToDecimals(o.quantity),
        marketOrder: false,
      }));
      
      try {
        await spin.batchOps({
          ops: [
            {
              marketId: market.id,
              drop: userOrdersIds,
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              place: [...bidOrders, ...askOrders],
            },
          ],
        });
      } catch (error) {
        console.log(error);
      }
    }

    console.log(`Waiting ${orderDelayMs}ms`);
    await sleep(orderDelayMs);
  }
}

async function main() {
  const { marketId, nearAccountId, network } = config;

  const keyStore = await getKeystore();

  const api = await createApi({
    // @ts-ignore
    network: network,
    accountId: nearAccountId,
    privateKey: (await keyStore.getKey(network, nearAccountId)).toString(),
  });
  const spin = api.spin;
  const market = await spin.getMarket({ marketId: marketId });

  await makeMarket({ spin, market, ...config });
}

main();
