const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("=========================================");
  console.log("  Deploy PPT Token + Invoice Contract    ");
  console.log("  Network: Optimism Sepolia              ");
  console.log("=========================================\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying from address: ${deployer.address}`);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${hre.ethers.formatEther(balance)} ETH\n`);

  // 1. Deploy PPTToken
  console.log("--- STEP 1: Deploying PPT Token ---");
  const PPTTokenFactory = await hre.ethers.getContractFactory("PPTToken");
  const initialSupply = 1000000n;
  const pptToken = await PPTTokenFactory.deploy(initialSupply);
  await pptToken.waitForDeployment();
  const pptTokenAddress = pptToken.target;
  console.log(`✅ PPT Token deployed at: ${pptTokenAddress}`);
  console.log(`🎉 You now own 1,000,000 PPT Tokens!\n`);

  // 2. Deploy MedInvoiceContract
  console.log("--- STEP 2: Deploying Invoice Contract ---");
  const MedInvoiceFactory = await hre.ethers.getContractFactory("MedInvoiceContract");
  const invoiceContract = await MedInvoiceFactory.deploy(pptTokenAddress);
  await invoiceContract.waitForDeployment();
  const invoiceAddress = invoiceContract.target;
  console.log(`✅ Invoice Contract deployed at: ${invoiceAddress}\n`);

  // 3. Auto-update optimism-frontend
  console.log("--- STEP 3: Updating Frontend Config ---");
  try {
    const blockchainServicePath = path.join(
      __dirname, '..', '..', 'optimism-frontend', 'src', 'services', 'blockchain.ts'
    );
    if (fs.existsSync(blockchainServicePath)) {
      let content = fs.readFileSync(blockchainServicePath, 'utf8');
      
      // Update PPT TOKEN
      const tokenMatch = content.match(/PPT_TOKEN_ADDRESS\s*=\s*"([^"]+)"/);
      if (tokenMatch) {
        content = content.replace(
          tokenMatch[0],
          `PPT_TOKEN_ADDRESS = "${pptTokenAddress}"`
        );
      }
      
      // Update INVOICE CONTRACT
      const invoiceMatch = content.match(/INVOICE_CONTRACT_ADDRESS\s*=\s*"([^"]+)"/);
      if (invoiceMatch) {
        content = content.replace(
          invoiceMatch[0],
          `INVOICE_CONTRACT_ADDRESS = "${invoiceAddress}"`
        );
      }
      
      fs.writeFileSync(blockchainServicePath, content);
      console.log(`✅ Auto-updated optimism-frontend blockchain.ts!`);
    } else {
      console.log(`⚠️ Could not find blockchain.ts at ${blockchainServicePath}`);
    }
  } catch (err) {
    console.error("Could not auto-update frontend:", err.message);
  }

  // 4. Summary
  console.log("\n=========================================");
  console.log("  DEPLOYMENT SUMMARY                     ");
  console.log("=========================================");
  console.log(`  Network:          Optimism Sepolia`);
  console.log(`  PPT Token:        ${pptTokenAddress}`);
  console.log(`  Invoice Contract: ${invoiceAddress}`);
  console.log(`  Deployer:         ${deployer.address}`);
  console.log("=========================================\n");
}

main()
  .then(() => { process.exit(0) })
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
