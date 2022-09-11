import axios from "axios";
import { homedir } from "os";
import { keyStores } from "near-api-js";
import { orderConfigUrl } from "../config.json";
import { BigNumber } from "bignumber.js";
import { Order } from "@spinfi/core";
import { USide } from "@spinfi/core";
import { OrdersConfig } from "./types";
import { PEM_DECIMAL, USDC_DECIMAL } from "./consts" // TODO

const client = axios.create({
  baseURL: "https://indexer.ref.finance/",
});

export async function getPrice(tokenRefinanceId: string) {
  return client
    .get("get-token-price", { params: { token_id: tokenRefinanceId } })
    .then((res) => res.data.price) as unknown as number;
}

export async function sleep(n: number) {
  return new Promise((resolve) => setTimeout(resolve, n));
}

export async function getKeystore() {
  const HOME_DIR = homedir();
  const CREDENTIALS_DIR = ".near-credentials";
  const credentialsPath = HOME_DIR + "/" + CREDENTIALS_DIR;

  return new keyStores.UnencryptedFileSystemKeyStore(credentialsPath);
}

export async function getOrderConfig() {
  return (await axios.get(orderConfigUrl!)).data;
}

export function convertToDecimals(
  value: string | number,
  decimal: string | number = PEM_DECIMAL
): string {
  return (
    new BigNumber(value)
      .multipliedBy(new BigNumber(10).pow(new BigNumber(decimal)))
      .toString() || "0"
  );
}

export function convertWithDecimals(
  value: string | number,
  decimal: string | number = PEM_DECIMAL
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
        price: convertWithDecimals(order.price, USDC_DECIMAL).toFixed(3),
        id: order.id,
      });
    } else if (order.o_type === USide.Bid) {
      buy.push({
        quantity: convertWithDecimals(order.remaining),
        price: convertWithDecimals(order.price, USDC_DECIMAL).toFixed(3),
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
