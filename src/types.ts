import { Spin, Market } from "@spinfi/core";

export interface ProgramOptions {
  marketId: number;
  nearAccountId: string;
  tokenRefinanceId: string;
  contractId: string;
  baseQuantityPEM: number;
  baseQuantityUSDC: number;
  network: "mainnet" | "testnet";
  orderDelayMs: number;
}

export interface MarketMakerParams {
  spin: Spin;
  market: Market;
  tokenRefinanceId: string;
  baseQuantityPEM: number;
  baseQuantityUSDC: number;
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
