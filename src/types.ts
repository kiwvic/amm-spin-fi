import { Spin, GetDepositsResponse } from "@spinfi/core";
import * as config from "../config.json";
import { convertWithDecimals } from "./util";
import { QUOTE_DECIMAL } from "./consts"


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

export class Balance {
  deposits: GetDepositsResponse;
  baseAvailable: number;
  quoteAvailable: number;

  constructor(deposits: GetDepositsResponse) {
    this.deposits = deposits;
    this.baseAvailable = convertWithDecimals(deposits[config.baseTokenAddress], QUOTE_DECIMAL);
    this.quoteAvailable = convertWithDecimals(deposits[config.quoteTokenAddress], QUOTE_DECIMAL);
  }
}
