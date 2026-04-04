// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://v2.hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ExchangeModule = buildModule("TokenExchange", (m) => {
  const exchange = m.contract("TokenExchange");

  return { exchange };
});

export default ExchangeModule;
