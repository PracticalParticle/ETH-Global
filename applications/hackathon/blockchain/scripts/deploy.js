const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * @notice Deploy all contracts for Enterprise Cross-Chain Messaging System
 * @dev Deploys ChainRegistry, HybridOrchestrationRouter, and EnterpriseCrossChainMessenger
 */
async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

    const network = await ethers.provider.getNetwork();
    console.log("Network:", network.name, "Chain ID:", network.chainId);

    // Get LayerZero endpoint address from environment or use default
    const LAYERZERO_ENDPOINT = process.env.LAYERZERO_ENDPOINT || ethers.ZeroAddress;
    const LAYERZERO_DELEGATE = process.env.LAYERZERO_DELEGATE || deployer.address;

    if (LAYERZERO_ENDPOINT === ethers.ZeroAddress) {
        console.warn("⚠️  WARNING: LAYERZERO_ENDPOINT not set, using zero address");
    }

    // ============ Deploy ChainRegistry ============
    console.log("\n📋 Deploying ChainRegistry...");
    const ChainRegistry = await ethers.getContractFactory("ChainRegistry");
    const chainRegistry = await ChainRegistry.deploy();
    await chainRegistry.waitForDeployment();
    const chainRegistryAddress = await chainRegistry.getAddress();
    console.log("✅ ChainRegistry deployed to:", chainRegistryAddress);

    // ============ Deploy HybridOrchestrationRouter ============
    console.log("\n🌉 Deploying HybridOrchestrationRouter...");
    const HybridOrchestrationRouter = await ethers.getContractFactory("HybridOrchestrationRouter");
    const router = await HybridOrchestrationRouter.deploy(
        LAYERZERO_ENDPOINT,
        LAYERZERO_DELEGATE,
        chainRegistryAddress
    );
    await router.waitForDeployment();
    const routerAddress = await router.getAddress();
    console.log("✅ HybridOrchestrationRouter deployed to:", routerAddress);

    // ============ Deploy EnterpriseCrossChainMessenger (Upgradeable) ============
    console.log("\n💬 Deploying EnterpriseCrossChainMessenger (Upgradeable Proxy)...");
    const EnterpriseCrossChainMessenger = await ethers.getContractFactory("EnterpriseCrossChainMessenger");
    
    // Deploy as upgradeable proxy
    const messenger = await upgrades.deployProxy(
        EnterpriseCrossChainMessenger,
        [], // Initialize will be called separately
        { 
            initializer: false, // We'll call initialize manually
            kind: "uups"
        }
    );
    await messenger.waitForDeployment();
    const messengerAddress = await messenger.getAddress();
    console.log("✅ EnterpriseCrossChainMessenger deployed to:", messengerAddress);

    // Get implementation address
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(messengerAddress);
    console.log("📦 Implementation address:", implementationAddress);

    // ============ Save deployment addresses ============
    const deploymentInfo = {
        network: network.name,
        chainId: network.chainId.toString(),
        deployer: deployer.address,
        contracts: {
            ChainRegistry: chainRegistryAddress,
            HybridOrchestrationRouter: routerAddress,
            EnterpriseCrossChainMessenger: messengerAddress,
            Implementation: implementationAddress
        },
        layerZero: {
            endpoint: LAYERZERO_ENDPOINT,
            delegate: LAYERZERO_DELEGATE
        },
        timestamp: new Date().toISOString()
    };

    // Save to file
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(deploymentsDir, `${network.name}-${network.chainId}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log("\n💾 Deployment info saved to:", deploymentFile);

    // ============ Summary ============
    console.log("\n" + "=".repeat(60));
    console.log("📊 DEPLOYMENT SUMMARY");
    console.log("=".repeat(60));
    console.log("ChainRegistry:", chainRegistryAddress);
    console.log("HybridOrchestrationRouter:", routerAddress);
    console.log("EnterpriseCrossChainMessenger:", messengerAddress);
    console.log("Implementation:", implementationAddress);
    console.log("\n⚠️  Next steps:");
    console.log("1. Run initialize.js to initialize contracts");
    console.log("2. Set LayerZero peer addresses for cross-chain communication");
    console.log("3. Register chains in ChainRegistry");
    console.log("=".repeat(60));

    return {
        chainRegistry,
        router,
        messenger,
        chainRegistryAddress,
        routerAddress,
        messengerAddress,
        implementationAddress
    };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

