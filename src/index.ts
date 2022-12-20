import * as config from "../config.json";
import { getSpin } from "./util";
import { makeMarket } from "./core";


async function main() {
  const { nearAccountId, nearAccountIdHFT, privateKey, privateKeyHFT, network } = config;

  const spin = await getSpin(network, nearAccountId, privateKey);
  const spinHFT = await getSpin(network, nearAccountIdHFT, privateKeyHFT);

  await makeMarket({ spin, spinHFT, ...config });
}

main();
