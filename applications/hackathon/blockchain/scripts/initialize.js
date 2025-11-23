const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * @notice Initialize deployed contracts
 * @dev Initializes EnterpriseCrossChainMessenger and sets up router connections
 */
async function main() {
    const [deployer, owner, broadcaster, recovery] = await ethers.getSigners();
    console.log("Initializing contracts...");
    console.log("Deployer:", deployer.address);
    console.log("Owner:", owner.address);
    console.log("Broadcaster:", broadcaster.address);
    console.log("Recovery:", recovery.address);

    const network = await ethers.provider.getNetwork();
    console.log("Network:", network.name, "Chain ID:", network.chainId);

    // Load deployment addresses
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    const deploymentFile = path.join(deploymentsDir, `${network.name}-${network.chainId}.json`);
    
    if (!fs.existsSync(deploymentFile)) {
        throw new Error(`Deployment file not found: ${deploymentFile}. Please run deploy.js first.`);
    }

    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    console.log("\n📋 Loaded deployment info from:", deploymentFile);

    // Get contract instances
    const ChainRegistry = await ethers.getContractFactory("ChainRegistry");
    const HybridOrchestrationRouter = await ethers.getContractFactory("HybridOrchestrationRouter");
    const EnterpriseCrossChainMessenger = await ethers.getContractFactory("EnterpriseCrossChainMessenger");

    const chainRegistry = ChainRegistry.attach(deploymentInfo.contracts.ChainRegistry);
    const router = HybridOrchestrationRouter.attach(deploymentInfo.contracts.HybridOrchestrationRouter);
    const messenger = EnterpriseCrossChainMessenger.attach(deploymentInfo.contracts.EnterpriseCrossChainMessenger);

    // ============ Initialize EnterpriseCrossChainMessenger ============
    console.log("\n🔧 Initializing EnterpriseCrossChainMessenger...");
    
    // Use owner, broadcaster, recovery from signers or environment
    const initialOwner = process.env.INITIAL_OWNER || owner.address;
    const initialBroadcaster = process.env.INITIAL_BROADCASTER || broadcaster.address;
    const initialRecovery = process.env.INITIAL_RECOVERY || recovery.address;

    const initTx = await messenger.initialize(
        initialOwner,
        initialBroadcaster,
        initialRecovery,
        deploymentInfo.contracts.HybridOrchestrationRouter,
        deploymentInfo.contracts.ChainRegistry
    );
    await initTx.wait();
    console.log("✅ EnterpriseCrossChainMessenger initialized");
    console.log("   Owner:", initialOwner);
    console.log("   Broadcaster:", initialBroadcaster);
    console.log("   Recovery:", initialRecovery);

    // ============ Set Message Receiver in Router ============
    console.log("\n🔗 Setting message receiver in router...");
    const setReceiverTx = await router.setMessageReceiver(deploymentInfo.contracts.EnterpriseCrossChainMessenger);
    await setReceiverTx.wait();
    console.log("✅ Message receiver set to:", deploymentInfo.contracts.EnterpriseCrossChainMessenger);

    // ============ Register Common Chains (Optional) ============
    console.log("\n🌐 Registering common chains...");
    
    // Common LayerZero endpoint IDs (adjust based on network)
    const commonChains = {
        // Ethereum Mainnet
        1: 30101,
        // Sepolia
        11155111: 40161,
        // Arbitrum One
        42161: 30110,
        // Arbitrum Sepolia
        421614: 40231,
        // Optimism
        10: 30111,
        // Optimism Sepolia
        11155420: 40232,
        // Base
        8453: 30184,
        // Base Sepolia
        84532: 40245
    };

    const currentChainId = Number(network.chainId.toString());
    let registeredCount = 0;

    for (const [chainId, eid] of Object.entries(commonChains)) {
        const chainIdNum = Number(chainId);
        if (chainIdNum === currentChainId) {
            console.log(`   Skipping current chain ${chainIdNum}`);
            continue;
        }

        try {
            const isRegistered = await chainRegistry.isChainRegistered(chainIdNum);
            if (!isRegistered) {
                const registerTx = await chainRegistry.registerChain(chainIdNum, eid);
                await registerTx.wait();
                console.log(`   ✅ Registered chain ${chainIdNum} -> endpoint ${eid}`);
                registeredCount++;
            } else {
                console.log(`   ⏭️  Chain ${chainIdNum} already registered`);
            }
        } catch (error) {
            console.log(`   ⚠️  Failed to register chain ${chainIdNum}:`, error.message);
        }
    }

    console.log(`\n✅ Registered ${registeredCount} chains`);

    // ============ Summary ============
    console.log("\n" + "=".repeat(60));
    console.log("✅ INITIALIZATION COMPLETE");
    console.log("=".repeat(60));
    console.log("EnterpriseCrossChainMessenger initialized");
    console.log("Router message receiver configured");
    console.log("Chains registered in ChainRegistry");
    console.log("\n⚠️  Next steps:");
    console.log("1. Set LayerZero peer addresses on other chains");
    console.log("2. Register native bridge connectors (if using EIL)");
    console.log("3. Test message sending/receiving");
    console.log("=".repeat(60));

    // Update deployment info
    deploymentInfo.initialized = true;
    deploymentInfo.initialization = {
        owner: initialOwner,
        broadcaster: initialBroadcaster,
        recovery: initialRecovery,
        timestamp: new Date().toISOString()
    };
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

