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

    // ============ Deploy Libraries ============
    console.log("\n📚 Deploying libraries...");
    const libraries = {};
    
    // Deploy MessengerDefinitions library
    try {
        const MessengerDefinitions = await ethers.getContractFactory("MessengerDefinitions");
        const messengerDefinitions = await MessengerDefinitions.deploy();
        await messengerDefinitions.waitForDeployment();
        const messengerDefinitionsAddress = await messengerDefinitions.getAddress();
        libraries["applications/hackathon/blockchain/contracts/utils/MessengerDefinitions.sol:MessengerDefinitions"] = messengerDefinitionsAddress;
        console.log("✅ MessengerDefinitions deployed to:", messengerDefinitionsAddress);
    } catch (error) {
        console.log("⚠️  MessengerDefinitions deployment:", error.message);
    }
    
    // Deploy SecureOwnableDefinitions library
    try {
        const SecureOwnableDefinitions = await ethers.getContractFactory("SecureOwnableDefinitions");
        const secureOwnableDefinitions = await SecureOwnableDefinitions.deploy();
        await secureOwnableDefinitions.waitForDeployment();
        const secureOwnableDefinitionsAddress = await secureOwnableDefinitions.getAddress();
        libraries["contracts/core/access/lib/definitions/SecureOwnableDefinitions.sol:SecureOwnableDefinitions"] = secureOwnableDefinitionsAddress;
        console.log("✅ SecureOwnableDefinitions deployed to:", secureOwnableDefinitionsAddress);
    } catch (error) {
        console.log("⚠️  SecureOwnableDefinitions deployment:", error.message);
    }
    
    // Deploy StateAbstraction library
    try {
        const StateAbstraction = await ethers.getContractFactory("StateAbstraction");
        const stateAbstraction = await StateAbstraction.deploy();
        await stateAbstraction.waitForDeployment();
        const stateAbstractionAddress = await stateAbstraction.getAddress();
        libraries["contracts/core/base/lib/StateAbstraction.sol:StateAbstraction"] = stateAbstractionAddress;
        console.log("✅ StateAbstraction deployed to:", stateAbstractionAddress);
    } catch (error) {
        console.log("⚠️  StateAbstraction deployment:", error.message);
    }
    
    // Deploy StateAbstractionDefinitions library
    try {
        const StateAbstractionDefinitions = await ethers.getContractFactory("StateAbstractionDefinitions");
        const stateAbstractionDefinitions = await StateAbstractionDefinitions.deploy();
        await stateAbstractionDefinitions.waitForDeployment();
        const stateAbstractionDefinitionsAddress = await stateAbstractionDefinitions.getAddress();
        libraries["contracts/core/base/lib/definitions/StateAbstractionDefinitions.sol:StateAbstractionDefinitions"] = stateAbstractionDefinitionsAddress;
        console.log("✅ StateAbstractionDefinitions deployed to:", stateAbstractionDefinitionsAddress);
    } catch (error) {
        console.log("⚠️  StateAbstractionDefinitions deployment:", error.message);
    }

    // ============ Deploy EnterpriseCrossChainMessenger (Upgradeable) ============
    console.log("\n💬 Deploying EnterpriseCrossChainMessenger (Upgradeable Proxy)...");
    const EnterpriseCrossChainMessenger = await ethers.getContractFactory("EnterpriseCrossChainMessenger", {
        libraries: libraries
    });
    
    // Deploy as upgradeable proxy
    const messenger = await upgrades.deployProxy(
        EnterpriseCrossChainMessenger,
        [], // Initialize will be called separately
        { 
            initializer: false, // We'll call initialize manually
            kind: "uups",
            unsafeAllowLinkedLibraries: true  // Allow external libraries
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
        libraries: libraries,
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
