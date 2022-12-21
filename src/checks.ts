import * as config from "../config.json";
import { Balance, OrderBook, Order_ } from "./types";

const sortOrderBook = (orderBook: OrderBook) => {
  orderBook.buy.sort((a: Order_, b: Order_) => a.price - b.price);
  orderBook.sell.sort((a: Order_, b: Order_) => a.price - b.price);
};

const amountOfOrdersChanged = (curOrders: any, configOrders: any) => {
  return (
    curOrders.buy.length !== configOrders.buy.length ||
    curOrders.sell.length !== configOrders.sell.length
  );
};

const priceChanged = (curOrders: OrderBook, configOrders: OrderBook, priceThreshold: number) => {
  for (let i = 0; i < curOrders.buy.length - 1; i++) {
    if (
      Math.abs(1 - curOrders.buy[i].price / configOrders.buy[i].price) > priceThreshold
      ||
      Math.abs(1 - curOrders.sell[i].price / configOrders.sell[i].price) > priceThreshold
    ) return true;
  }

  return false;
};

const quantityChanged = (curOrders: OrderBook, configOrders: OrderBook, quantityThreshold: number) => {
  for (let i = 0; i < curOrders.buy.length - 1; i++) {
    if (
      Math.abs(1 - curOrders.buy[i].quantity / configOrders.buy[i].quantity) > quantityThreshold 
      ||
      Math.abs(1 - curOrders.sell[i].quantity / configOrders.sell[i].quantity) > quantityThreshold
    ) return true;
  }

  return false;
};

export const isMakeMarketNeeded = (
  currentOrders: OrderBook,
  configOrders: OrderBook,
  priceThreshold: number,
  quantityThreshold: number
) => {
  sortOrderBook(currentOrders);

  if (!config.autoMarketMaker) return false

  if (amountOfOrdersChanged(currentOrders, configOrders)) return true;
  if (priceChanged(currentOrders, configOrders, priceThreshold)) return true;
  if (quantityChanged(currentOrders, configOrders, quantityThreshold)) return true;

  console.log('No changes detected.');

  return false;
};

export const notEnoughFunds = (balance: Balance, amount: number, price: number) => {
  return balance.quoteAvailable < (amount * price) && balance.baseAvailable < amount;
}
