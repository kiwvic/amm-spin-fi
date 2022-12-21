import { BASE_DECIMAL, QUOTE_DECIMAL, PRICE_CONFIG_FIXED, Buy, Sell } from "./consts" 
import { BigNumber } from "bignumber.js";
import { Order, USide, GetOrderbookResponse } from "@spinfi/core";
import { createApi, } from "@spinfi/node";
import { Balance, OrdersConfig, OrderTypeStreak } from "./types";
import * as config from "../config.json"
import axios from "axios";


export async function getPrice(tokenRefinanceId: string) {
  const client = axios.create({ baseURL: "https://indexer.ref.finance/" });
  
  return client.get("get-token-price", {params: {token_id: tokenRefinanceId}})
    .then((res) => res.data.price) as unknown as number;
}

export async function sleep(n: number) {
  return new Promise((resolve) => setTimeout(resolve, n));
}

export async function getOrderConfig() {
  return require("../order-config.json");
}

export const getRandomDecimal = (min: number, max: number) => {
  return Math.random() * (max - min) + min;
}

export const toFixedNoRound = (number: number, precision: number): number => {
  const factor = Math.pow(10, precision);
  return Math.floor(number * factor) / factor;
}

export const getRandomArbitrary = (min: number, max: number) => {
  return Math.round(Math.random() * (max - min) + min);
}

const relDiff = (a: any, b: any) => {
  return 100*((a-b)/((a+b)/2));
}

export function convertToDecimals(
  value: string | number,
  decimal: string | number = BASE_DECIMAL
): string {
  return (
    new BigNumber(value)
      .multipliedBy(new BigNumber(10).pow(new BigNumber(decimal)))
      .toString() || "0"
  );
}

export function convertWithDecimals(
  value: string | number,
  decimal: string | number = BASE_DECIMAL
): number {
  return (
    new BigNumber(value)
      .dividedBy(new BigNumber(10).pow(new BigNumber(decimal)))
      .toNumber() || 0
  );
}

export function userOrdersToOrderBook(userOrders: Order[]) {
  let sell = [];
  let buy = [];

  for (let order of userOrders) {
    if (order.o_type === USide.Ask) {
      sell.push({
        quantity: convertWithDecimals(order.remaining),
        price: convertWithDecimals(order.price, QUOTE_DECIMAL).toFixed(3),
        id: order.id,
      });
    } else if (order.o_type === USide.Bid) {
      buy.push({
        quantity: convertWithDecimals(order.remaining),
        price: convertWithDecimals(order.price, QUOTE_DECIMAL).toFixed(3),
        id: order.id,
      });
    }
  }

  return { sell, buy };
}

export function getOrderBookFromConfig(
  config: OrdersConfig,
  indexPrice: number,
  baseQuantityToken: number,
  baseQuantityUSDC: number
) {
  let buy = [];
  let sell = [];

  config.bids.forEach((item) => {
    const bidQuantity = baseQuantityToken * item.quantity;
    const bidPrice = indexPrice * (1 + item.spread);
    // todo .toFixed(x) dynamic
    sell.push({ quantity: bidQuantity, price: bidPrice.toFixed(3), id: "" });
  });

  config.asks.forEach((item) => {
    const totalUSDC = baseQuantityUSDC * item.quantity;
    const askPrice = indexPrice * (1 - item.spread); // price per token
    const askQuantity = parseFloat((totalUSDC / askPrice).toFixed(1));

    buy.push({ quantity: askQuantity, price: askPrice.toFixed(3), id: "" });
  });

  return { buy, sell };
}

export const getBestPrice = (orders: GetOrderbookResponse) => {
  return {
    bestAskPrice: convertWithDecimals(orders.ask_orders[0].price, QUOTE_DECIMAL), 
    bestBidPrice: convertWithDecimals(orders.bid_orders[0].price, QUOTE_DECIMAL)
  };
}

export const calculateBestPrice = (bestBid: number, bestAsk: number) => {
  let randomDecimal = toFixedNoRound(getRandomDecimal(bestAsk, bestBid), PRICE_CONFIG_FIXED);

  if (randomDecimal == bestAsk) {
    randomDecimal -= Math.pow(10, -PRICE_CONFIG_FIXED);
  } else if (randomDecimal == bestBid) {
    randomDecimal += Math.pow(10, -PRICE_CONFIG_FIXED);
  }

  return toFixedNoRound(randomDecimal, PRICE_CONFIG_FIXED);
}

export const orderTypeChangeIsNeeded = (orderType: number, orderTypeStreak: OrderTypeStreak) => {
  if (orderTypeStreak.type == orderType && orderTypeStreak.counter >= config.sameOrderStreak) {
    orderTypeStreak.counter = 0;
    return true;
  } else if (orderTypeStreak.type != orderType || orderTypeStreak.counter >= config.sameOrderStreak) {
    orderTypeStreak.type = orderType;
    orderTypeStreak.counter = 0;
  } else {
    orderTypeStreak.counter += 1;
  }

  return false;
}

export async function getSpin(network: string, nearAccountId: string, nearPrivateKey: string) {
  return (await createApi({
    // @ts-ignore
    network: network,
    accountId: nearAccountId,
    privateKey: nearPrivateKey,
  })).spin;
}

export const changeIndexPrice = (price: number, newPrice: number): number => { 
  let priceDiff = relDiff(newPrice, price);

  if (priceDiff > 0 && priceDiff > config.priceChangeThresholdPercent) {
    price += (price * (config.priceChangeThresholdPercent / 100));
  } else if (priceDiff < 0 && priceDiff < (-1) * config.priceChangeThresholdPercent) {
    price -= (price * (config.priceChangeThresholdPercent / 100));
  }

  return price;
}

export function reverseOrdertype(orderType: number) {
  return orderType == Buy ? Sell : Buy;
}

export function forceChangeOrderType(
  orderType: number, 
  balance: Balance, balanceHFT: Balance,
  randomAmount: number, price: number) {

  if (orderType == Buy) {
    if ((balanceHFT.quoteAvailable < (randomAmount * price)) || (balance.baseAvailable < randomAmount)) {
      return true;
    }
  } else {
    if ((balanceHFT.baseAvailable < randomAmount) || (balance.quoteAvailable < (randomAmount * price))) {
      return true;
    }
  }

  return false;
}
