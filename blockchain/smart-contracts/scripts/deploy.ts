import { ethers } from "hardhat";

async function main() {
  console.log("Deploying QuantumTrade smart contracts...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Deploy TradingVault
  console.log("\nDeploying TradingVault...");
  const TradingVault = await ethers.getContractFactory("TradingVault");
  const tradingEngine = process.env.TRADING_ENGINE_ADDRESS || deployer.address;
  const tradingVault = await TradingVault.deploy(tradingEngine);
  await tradingVault.waitForDeployment();
  const vaultAddress = await tradingVault.getAddress();
  console.log("TradingVault deployed to:", vaultAddress);

  // Add supported tokens
  console.log("\nAdding supported tokens...");
  const tokens = {
    USDC: process.env.USDC_ADDRESS || "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: process.env.USDT_ADDRESS || "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    WETH: process.env.WETH_ADDRESS || "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    WBTC: process.env.WBTC_ADDRESS || "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  };

  for (const [symbol, address] of Object.entries(tokens)) {
    const tx = await tradingVault.addSupportedToken(address);
    await tx.wait();
    console.log(`Added ${symbol}:`, address);
  }

  // Deploy LiquidityPool (USDC/WETH)
  console.log("\nDeploying LiquidityPool (USDC/WETH)...");
  const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
  const liquidityPool = await LiquidityPool.deploy(
    tokens.USDC,
    tokens.WETH,
    "QuantumTrade USDC/WETH LP",
    "QT-USDC-WETH"
  );
  await liquidityPool.waitForDeployment();
  const poolAddress = await liquidityPool.getAddress();
  console.log("LiquidityPool deployed to:", poolAddress);

  // Add supported tokens to pool
  const addToken0 = await liquidityPool.addSupportedToken(tokens.USDC);
  await addToken0.wait();
  const addToken1 = await liquidityPool.addSupportedToken(tokens.WETH);
  await addToken1.wait();
  console.log("Supported tokens added to pool");

  // Save deployment addresses
  const deployment = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    contracts: {
      TradingVault: vaultAddress,
      LiquidityPool: poolAddress,
    },
    tokens,
    timestamp: new Date().toISOString(),
  };

  console.log("\n=== Deployment Summary ===");
  console.log(JSON.stringify(deployment, null, 2));

  // Verify contracts on Etherscan
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("\nVerifying contracts on Etherscan...");
    
    try {
      await run("verify:verify", {
        address: vaultAddress,
        constructorArguments: [tradingEngine],
      });
      console.log("TradingVault verified");
    } catch (error) {
      console.error("Verification failed:", error);
    }

    try {
      await run("verify:verify", {
        address: poolAddress,
        constructorArguments: [
          tokens.USDC,
          tokens.WETH,
          "QuantumTrade USDC/WETH LP",
          "QT-USDC-WETH",
        ],
      });
      console.log("LiquidityPool verified");
    } catch (error) {
      console.error("Verification failed:", error);
    }
  }

  console.log("\n✅ Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
