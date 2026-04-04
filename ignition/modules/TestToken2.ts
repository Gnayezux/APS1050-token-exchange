import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TestToken2 = buildModule("Mytoken2", (m) => {
  const testtoken = m.contract("Mytoken2");

  return { testtoken };
});

export default TestToken2;