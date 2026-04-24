const hre = require('hardhat');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function main() {
  console.log("=========================================");
  console.log("   Interactive Contract Deployment       ");
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

  // Ensure it starts with 0x
  let formattedKey = userPrivKey;
  if (!formattedKey.startsWith("0x")) {
    formattedKey = "0x" + formattedKey;
  }

  // Set the private key in the environment for hardhat config to pick up
  process.env.PRIVATE_KEY = formattedKey;
  
  rl.close();

  console.log("\nStarting deployment...");

  // Dynamically read PPT Token Address from the frontend config
  let pptTokenAddress = "0xC00BBC9A2C88712dC1e094866973F036373C7134"; // Fallback
  try {
    const blockchainServicePath = path.join(
      __dirname, '..', '..', 'EdgeBilling', 'src', 'services', 'blockchain.ts'
    );
    if (fs.existsSync(blockchainServicePath)) {
      const content = fs.readFileSync(blockchainServicePath, 'utf8');
      const tokenMatch = content.match(/PPT_TOKEN_ADDRESS\s*=\s*"([^"]+)"/);
      if (tokenMatch) {
         pptTokenAddress = tokenMatch[1];
      }
    }
  } catch(e) {}
  
  console.log(`Using PPT Token Address: ${pptTokenAddress}`);
  hre.config.networks.calibnet.accounts = [formattedKey];
  hre.network.name = "calibnet";

  // Ensure contracts are compiled before getting the factory
  console.log("Compiling contracts...");
  await hre.run("compile");

  const MedInvoiceContract = await hre.ethers.getContractFactory("MedInvoiceContract");
  
  // Use explicit RPC provider for Filecoin Calibration
  const rpcUrl = process.env.RPC_URL || "https://api.calibration.node.glif.io/rpc/v1";
  const customProvider = new hre.ethers.JsonRpcProvider(rpcUrl);
  
  // Create a custom wallet and connect it to the provider
  const wallet = new hre.ethers.Wallet(formattedKey, customProvider);
  console.log("Deploying from address: ", wallet.address);
  
  const connectedFactory = MedInvoiceContract.connect(wallet);

  const invoiceContract = await connectedFactory.deploy(pptTokenAddress);
  await invoiceContract.waitForDeployment();

  const deployedAddress = invoiceContract.target;
  console.log("Contract deployed successfully at: ", deployedAddress);

  // Auto-update EdgeBilling frontend with deployed address
  try {
    const blockchainServicePath = path.join(
      __dirname, '..', '..', 'EdgeBilling', 'src', 'services', 'blockchain.ts'
    );
    if (fs.existsSync(blockchainServicePath)) {
      let content = fs.readFileSync(blockchainServicePath, 'utf8');
      const oldMatch = content.match(/INVOICE_CONTRACT_ADDRESS\s*=\s*"([^"]+)"/);
      if (oldMatch && oldMatch[1] !== deployedAddress) {
        content = content.replace(
          oldMatch[0],
          `INVOICE_CONTRACT_ADDRESS = "${deployedAddress}"`
        );
        fs.writeFileSync(blockchainServicePath, content);
        console.log(`✅ Auto-updated EdgeBilling blockchain.ts with new address: ${deployedAddress}`);
      } else if (!oldMatch) {
         console.log(`⚠️ Could not find INVOICE_CONTRACT_ADDRESS in blockchain.ts regex.`);
      }
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
