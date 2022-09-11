import { assert } from "console";
import { OrderBook, Order_ } from "./types";

const amountOfOrdersChanged = (currentOrders: any, configOrders: any) => {
  return (
    currentOrders.buy.length !== configOrders.buy.length ||
    currentOrders.sell.length !== configOrders.sell.length
  );
};

const sortOrderBook = (orderBook: OrderBook) => {
  orderBook.buy.sort((a: Order_, b: Order_) => a.price - b.price);
  orderBook.sell.sort((a: Order_, b: Order_) => a.price - b.price);
};

const priceChanged = (
  currentOrders: OrderBook,
  configOrders: OrderBook,
  priceThreshold: number
) => {
  assert(currentOrders.buy.length === configOrders.buy.length);
  assert(currentOrders.sell.length === configOrders.sell.length);

  sortOrderBook(currentOrders);

  for (let i = 0; currentOrders.buy.length; i++) {
    if (
      Math.abs(1 - currentOrders.buy[i].price / configOrders.buy[i].price) > priceThreshold
      ||
      Math.abs(1 - currentOrders.sell[i].price / configOrders.sell[i].price) > priceThreshold
    ) return true;
  }

  return false;
};

const quantityChanged = (
  currentOrders: OrderBook,
  configOrders: OrderBook,
  quantityThreshold: number
) => {
  assert(currentOrders.buy.length === configOrders.buy.length);
  assert(currentOrders.sell.length === configOrders.sell.length);

  sortOrderBook(currentOrders);

  for (let i = 0; currentOrders.buy.length; i++) {
    if (
      Math.abs(1 - currentOrders.buy[i].quantity / configOrders.buy[i].quantity) > quantityThreshold 
      ||
      Math.abs(1 - currentOrders.sell[i].quantity / configOrders.sell[i].quantity) > quantityThreshold
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
  if (amountOfOrdersChanged(currentOrders, configOrders)) return true;
  if (priceChanged(currentOrders, configOrders, priceThreshold)) return true;
  if (quantityChanged(currentOrders, configOrders, quantityThreshold))
    return true;

  return false;
};
