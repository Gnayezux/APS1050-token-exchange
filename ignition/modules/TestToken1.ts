import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TestToken1 = buildModule("MyToken", (m) => {
  const testtoken = m.contract("MyToken");

  return { testtoken };
});

export default TestToken1;