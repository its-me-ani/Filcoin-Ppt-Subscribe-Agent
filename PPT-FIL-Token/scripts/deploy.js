const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main(){
  console.log("Starting deployment...");

  // The PPT Token is already deployed at this address
  const pptTokenAddress = "0xC00BBC9A2C88712dC1e094866973F036373C7134";
  
  const invoiceContract = await hre.ethers.deployContract("MedInvoiceContract", [pptTokenAddress]);
  await invoiceContract.waitForDeployment();

  const deployedAddress = invoiceContract.target;
  console.log("Contract deployed at: ", deployedAddress);

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
        console.log(`Auto-updated EdgeBilling blockchain.ts with new address: ${deployedAddress}`);
      }
    }
  } catch (err) {
    console.error("Could not auto-update frontend:", err.message);
  }

  // console.log("Waiting 30 seconds before verification...")
  // await new Promise(resolve => setTimeout(resolve, 30000));
  
  // await hre.run("verify:verify",{
  //   address : invoiceContract.target,
  //   constructorArguments : [pptTokenAddress]
  // })
}

main()
  .then(() => { process.exit(0) })
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });