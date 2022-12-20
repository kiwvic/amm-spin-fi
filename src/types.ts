import { Spin, Market } from "@spinfi/core";


export interface MarketMakerParams {
  spin: Spin;
  spinHFT: Spin;
  marketId: number;
  tokenRefinanceId: string;
  baseQuantity: number;
  quoteQuantity: number;
  orderDelayMs: number;
}

interface OrderQS {
  quantity: number;
  spread: number;
}

export interface OrdersConfig {
  bids: Array<OrderQS>;
  asks: Array<OrderQS>;
  priceThreshold: number;
  quantityThreshold: number;
}

export interface Order_ {
  quantity: number;
  price: number;
  id: string;
}

export interface OrderBook {
  buy: Array<Order_>;
  sell: Array<Order_>;
}

export interface MandatoryHFTIter {
  counter: number,
  appeared: boolean
}

export interface OrderTypeStreak {
  counter: number,
  type: number
}

