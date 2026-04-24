/**
 * PPT Token + MedInvoiceContract deploy script
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network opSepolia
 *   npx hardhat run scripts/deploy.js --network polygon
 *   npx hardhat run scripts/deploy.js --network hedera
 *
 * After each run, copy the printed addresses into frontend/config/chains.js
 */

const hre = require("hardhat");
const { ethers } = hre;

// ── Deployment parameters (adjust per chain) ──────────────────────
const CONFIG = {
  // Tokens minted immediately to deployer wallet (whole tokens)
  INITIAL_SUPPLY: 1_000_000,

  // Hard cap — can never be exceeded by mint() (whole tokens)
  MAX_SUPPLY: 10_000_000,

  // How much of the mint pool subscribed users can collectively mint (wei)
  USER_MINT_CAP: ethers.parseEther("500000"), // 500k PPT

  // How many PPT to pre-load into invoice contract for subscription rewards (wei)
  // Each subscribe() costs 10 PPT from this pool.
  // 50k PPT = 5,000 subscriptions before refill needed
  FUND_AMOUNT: ethers.parseEther("50000"),
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const network    = await ethers.provider.getNetwork();
  const chainId    = network.chainId;

  console.log("\n══════════════════════════════════════════════");
  console.log(`  PPT Deployment`);
  console.log(`  Network  : ${hre.network.name} (chainId ${chainId})`);
  console.log(`  Deployer : ${deployer.address}`);
  console.log(`  Balance  : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log("══════════════════════════════════════════════\n");

  // ── Step 1: Deploy PPTToken ──────────────────────────────────
  console.log("Step 1/5 — Deploying PPTToken...");
  const TokenFactory = await ethers.getContractFactory("PPTToken");
  const token = await TokenFactory.deploy(CONFIG.INITIAL_SUPPLY, CONFIG.MAX_SUPPLY);
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log(`  ✓ PPTToken deployed: ${tokenAddr}`);
  console.log(`    Initial supply : ${CONFIG.INITIAL_SUPPLY.toLocaleString()} PPT → deployer`);
  console.log(`    Max supply     : ${CONFIG.MAX_SUPPLY.toLocaleString()} PPT\n`);

  // ── Step 2: Deploy MedInvoiceContract ────────────────────────
  console.log("Step 2/5 — Deploying MedInvoiceContract...");
  const InvoiceFactory = await ethers.getContractFactory("MedInvoiceContract");
  const invoice = await InvoiceFactory.deploy(tokenAddr, CONFIG.USER_MINT_CAP);
  await invoice.waitForDeployment();
  const invoiceAddr = await invoice.getAddress();
  console.log(`  ✓ MedInvoiceContract deployed: ${invoiceAddr}`);
  console.log(`    User mint cap  : ${ethers.formatEther(CONFIG.USER_MINT_CAP)} PPT\n`);

  // ── Step 3: Link contracts ────────────────────────────────────
  console.log("Step 3/5 — Linking PPTToken → MedInvoiceContract...");
  const linkTx = await token.setMedInvoiceContract(invoiceAddr);
  await linkTx.wait();
  console.log(`  ✓ Linked. Token mint now restricted to ${invoiceAddr}\n`);

  // ── Step 4: Approve + fund invoice contract ───────────────────
  console.log("Step 4/5 — Funding invoice contract with PPT for subscription rewards...");
  const approveTx = await token.approve(invoiceAddr, CONFIG.FUND_AMOUNT);
  await approveTx.wait();
  console.log(`  ✓ Approved ${ethers.formatEther(CONFIG.FUND_AMOUNT)} PPT spend`);

  const fundTx = await invoice.fundContract(CONFIG.FUND_AMOUNT);
  await fundTx.wait();
  const contractBal = await token.balanceOf(invoiceAddr);
  console.log(`  ✓ Contract funded. Balance: ${ethers.formatEther(contractBal)} PPT`);
  console.log(`    This covers ${ethers.formatEther(CONFIG.FUND_AMOUNT) / 10} subscribe() calls\n`);

  // ── Step 5: Verify on block explorer ─────────────────────────
  const isLocal = ["localhost", "hardhat"].includes(hre.network.name);
  if (!isLocal) {
    console.log("Step 5/5 — Verifying contracts on block explorer...");
    try {
      await hre.run("verify:verify", {
        address: tokenAddr,
        constructorArguments: [CONFIG.INITIAL_SUPPLY, CONFIG.MAX_SUPPLY],
      });
      console.log("  ✓ PPTToken verified");
    } catch (e) {
      console.log(`  ! PPTToken verification: ${e.message}`);
    }
    try {
      await hre.run("verify:verify", {
        address: invoiceAddr,
        constructorArguments: [tokenAddr, CONFIG.USER_MINT_CAP],
      });
      console.log("  ✓ MedInvoiceContract verified");
    } catch (e) {
      console.log(`  ! MedInvoiceContract verification: ${e.message}`);
    }
  } else {
    console.log("Step 5/5 — Skipping verification (local network)\n");
  }

  // ── Summary ──────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE — add to chains.js:");
  console.log("══════════════════════════════════════════════");
  console.log(`  ${chainId}: {`);
  console.log(`    token:   "${tokenAddr}",`);
  console.log(`    invoice: "${invoiceAddr}",`);
  console.log(`    name:    "${hre.network.name}",`);
  console.log(`  },`);
  console.log("══════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
