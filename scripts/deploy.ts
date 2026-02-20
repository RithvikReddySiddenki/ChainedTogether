const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying ChainedTogether contracts...\n");

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Deploy DAO Token
  console.log("Deploying DemoDAOToken...");
  const DemoDAOToken = await ethers.getContractFactory("DemoDAOToken");
  const daoToken = await DemoDAOToken.deploy();
  await daoToken.waitForDeployment();
  const daoTokenAddress = await daoToken.getAddress();
  console.log("DemoDAOToken deployed to:", daoTokenAddress);

  // Mint tokens to 10 demo voters (first 10 Hardhat accounts)
  const signers = await ethers.getSigners();
  const voterAddresses = signers.slice(0, 10).map(s => s.address);

  console.log("\nMinting DAO tokens to voters...");
  const tokensPerVoter = ethers.parseEther("100"); // 100 tokens per voter
  for (const voter of voterAddresses) {
    await daoToken.mint(voter, tokensPerVoter);
    console.log(`Minted ${ethers.formatEther(tokensPerVoter)} tokens to ${voter}`);
  }

  // Deploy Match Registry
  console.log("\nDeploying MatchRegistry...");
  const yesThreshold = 5; // Need 5 yes votes for approval (5/10)
  const noThreshold = 5;  // 5 no votes for rejection
  const voteDurationSeconds = 600; // 10 minutes for demo

  const MatchRegistry = await ethers.getContractFactory("MatchRegistry");
  const matchRegistry = await MatchRegistry.deploy(
    daoTokenAddress,
    yesThreshold,
    noThreshold,
    voteDurationSeconds
  );
  await matchRegistry.waitForDeployment();
  const matchRegistryAddress = await matchRegistry.getAddress();
  console.log("MatchRegistry deployed to:", matchRegistryAddress);

  // Print summary
  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("DemoDAOToken:", daoTokenAddress);
  console.log("MatchRegistry:", matchRegistryAddress);
  console.log("\nAdd these to your .env file:");
  console.log(`NEXT_PUBLIC_DAO_TOKEN_ADDRESS=${daoTokenAddress}`);
  console.log(`NEXT_PUBLIC_MATCH_REGISTRY_ADDRESS=${matchRegistryAddress}`);
  console.log("\n=== CONFIGURATION ===");
  console.log("Yes Threshold:", yesThreshold);
  console.log("No Threshold:", noThreshold);
  console.log("Vote Duration:", voteDurationSeconds, "seconds");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
