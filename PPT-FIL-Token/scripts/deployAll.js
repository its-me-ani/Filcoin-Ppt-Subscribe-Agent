const hre = require('hardhat');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function main() {
  console.log("=========================================");
  console.log("   Deploy BOTH Token and Invoice Contract ");
  console.log("=========================================\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query, hidden) => new Promise((resolve) => {
    if (hidden) {
      rl.stdoutMuted = true;
      rl.question(query, (value) => {
        rl.history = rl.history.slice(1);
        resolve(value);
      });
      rl._writeToOutput = function _writeToOutput(stringToWrite) {
        if (rl.stdoutMuted)
          rl.output.write("*");
        else
          rl.output.write(stringToWrite);
      };
    } else {
      rl.question(query, resolve);
    }
  });

  // Prompt for private key securely
  const userPrivKey = await question("Please enter your Filecoin Calibration (calibnet) private key: ", true);
  console.log("\n");
  
  if (!userPrivKey || userPrivKey.length !== 66) {
    if(userPrivKey.length !== 64 && userPrivKey.length !== 66) {
      console.error("Invalid private key length. Expected 64 or 66 characters.");
      process.exit(1);
    }
  }

  let formattedKey = userPrivKey;
  if (!formattedKey.startsWith("0x")) {
    formattedKey = "0x" + formattedKey;
  }

  process.env.PRIVATE_KEY = formattedKey;
  rl.close();

  // Explicit Provider
  const rpcUrl = process.env.RPC_URL || "https://api.calibration.node.glif.io/rpc/v1";
  const customProvider = new hre.ethers.JsonRpcProvider(rpcUrl);
  const wallet = new hre.ethers.Wallet(formattedKey, customProvider);

  console.log("\nCompiling contracts...");
  await hre.run("compile");

  console.log(`\nDeploying from address: ${wallet.address}`);

  // 1. Deploy PPTToken FIRST
  console.log("\n--- STEP 1: Deploying NEW PPT Token ---");
  const PPTTokenFactory = await hre.ethers.getContractFactory("PPTToken");
  const connectedTokenFactory = PPTTokenFactory.connect(wallet);
  
  // Mint 1,000,000 tokens to the deployer
  const initialSupply = 1000000n;
  const pptTokenContract = await connectedTokenFactory.deploy(initialSupply);
  await pptTokenContract.waitForDeployment();
  const newPptTokenAddress = pptTokenContract.target;
  console.log(`✅ NEW PPT Token deployed at: ${newPptTokenAddress}`);
  console.log(`🎉 You now own 1,000,000 PPT Tokens in your wallet!`);

  // 2. Deploy MedInvoiceContract
  console.log("\n--- STEP 2: Deploying Invoice Contract ---");
  const MedInvoiceFactory = await hre.ethers.getContractFactory("MedInvoiceContract");
  const connectedInvoiceFactory = MedInvoiceFactory.connect(wallet);

  const invoiceContract = await connectedInvoiceFactory.deploy(newPptTokenAddress);
  await invoiceContract.waitForDeployment();
  const newInvoiceAddress = invoiceContract.target;
  console.log(`✅ Invoice Contract deployed at: ${newInvoiceAddress}`);

  // 3. Update Frontend
  console.log("\n--- STEP 3: Updating Frontend Config ---");
  try {
    const blockchainServicePath = path.join(
      __dirname, '..', '..', 'EdgeBilling', 'src', 'services', 'blockchain.ts'
    );
    if (fs.existsSync(blockchainServicePath)) {
      let content = fs.readFileSync(blockchainServicePath, 'utf8');
      
      // Update PPT TOKEN
      const tokenMatch = content.match(/PPT_TOKEN_ADDRESS\s*=\s*"([^"]+)"/);
      if (tokenMatch) {
        content = content.replace(
          tokenMatch[0],
          `PPT_TOKEN_ADDRESS = "${newPptTokenAddress}"`
        );
      }
      
      // Update INVOICE CONTRACT
      const invoiceMatch = content.match(/INVOICE_CONTRACT_ADDRESS\s*=\s*"([^"]+)"/);
      if (invoiceMatch) {
        content = content.replace(
          invoiceMatch[0],
          `INVOICE_CONTRACT_ADDRESS = "${newInvoiceAddress}"`
        );
      }
      
      fs.writeFileSync(blockchainServicePath, content);
      console.log(`✅ Auto-updated EdgeBilling blockchain.ts with new addresses!`);
    } else {
        console.log(`⚠️ Could not find blockchain.ts at ${blockchainServicePath}`);
    }
  } catch (err) {
    console.error("Could not auto-update frontend:", err.message);
  }
}

main()
  .then(() => { process.exit(0) })
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
