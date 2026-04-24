import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with', deployer.address);

  const Registry = await ethers.getContractFactory('InvoiceRegistry');
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log('InvoiceRegistry deployed at', registryAddr);

  const tokenArg = process.env.SETTLEMENT_TOKEN ?? ethers.ZeroAddress;
  if (tokenArg && tokenArg !== ethers.ZeroAddress) {
    const Agent = await ethers.getContractFactory('Erc8004AgentPayments');
    const agent = await Agent.deploy(tokenArg);
    await agent.waitForDeployment();
    console.log('Erc8004AgentPayments deployed at', await agent.getAddress());
  } else {
    console.log('Skipping Erc8004AgentPayments (set SETTLEMENT_TOKEN to deploy)');
  }

  console.log('\nAdd to your .env files:');
  console.log(`INVOICE_REGISTRY_ADDRESS=${registryAddr}`);
  console.log(`VITE_INVOICE_REGISTRY_ADDRESS=${registryAddr}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
