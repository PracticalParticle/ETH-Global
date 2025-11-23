const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * @notice Initialize deployed contracts
 * @dev Initializes EnterpriseCrossChainMessenger and sets up router connections
 */
async function main() {
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const owner = signers[1] || signers[0];
    const broadcaster = signers[2] || signers[0];
    const recovery = signers[3] || signers[0];
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
    
    // Load library addresses from deployment info
    const libraries = {};
    if (deploymentInfo.libraries) {
        Object.assign(libraries, deploymentInfo.libraries);
    }
    
    const EnterpriseCrossChainMessenger = await ethers.getContractFactory("EnterpriseCrossChainMessenger", {
        libraries: libraries
    });

    const chainRegistry = ChainRegistry.attach(deploymentInfo.contracts.ChainRegistry);
    const router = HybridOrchestrationRouter.attach(deploymentInfo.contracts.HybridOrchestrationRouter);
    const messenger = EnterpriseCrossChainMessenger.attach(deploymentInfo.contracts.EnterpriseCrossChainMessenger);

    // ============ Initialize EnterpriseCrossChainMessenger ============
    console.log("\n🔧 Initializing EnterpriseCrossChainMessenger...");
    
    // Use owner, broadcaster, recovery from signers or environment
    const initialOwner = process.env.INITIAL_OWNER || owner.address;
    const initialBroadcaster = process.env.INITIAL_BROADCASTER || broadcaster.address;
    const initialRecovery = process.env.INITIAL_RECOVERY || recovery.address;

    const initTx = await messenger["initialize(address,address,address,address,address)"](
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

    // ============ Register EIL Bridge Connectors (if on Ethereum Sepolia) ============
    if (network.chainId === 11155111n) {
        console.log("\n🌉 Registering EIL bridge connectors for Arbitrum Sepolia...");
        const ARB_SEPOLIA_CHAIN_ID = 421614;
        const L1_ARB_BRIDGE = "0x2Efeb9A8aa5d20D50f05Be721cCb64332dE2A6a2";
        const L2_ARB_BRIDGE = "0xDFa250f671A60B64dD3cD625AD2056b9B4A9124F";
        
        try {
            const registerTx = await router.registerNativeBridge(
                ARB_SEPOLIA_CHAIN_ID,
                L1_ARB_BRIDGE,
                L2_ARB_BRIDGE
            );
            await registerTx.wait();
            console.log(`✅ Registered Arbitrum Sepolia native bridge`);
            console.log(`   L1 Bridge: ${L1_ARB_BRIDGE}`);
            console.log(`   L2 Bridge: ${L2_ARB_BRIDGE}`);
            deploymentInfo.eilBridge = {
                arbitrumSepolia: {
                    chainId: ARB_SEPOLIA_CHAIN_ID,
                    l1Bridge: L1_ARB_BRIDGE,
                    l2Bridge: L2_ARB_BRIDGE
                }
            };
        } catch (error) {
            console.log(`⚠️  Failed to register EIL bridge:`, error.message);
        }
    }

    // ============ Register Common Chains ============
    console.log("\n🌐 Registering common chains...");
    
    // Common LayerZero endpoint IDs
    const commonChains = {
        // Sepolia
        11155111: 40161,
        // Arbitrum Sepolia
        421614: 40231
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
    if (network.chainId === 11155111n) {
        console.log("EIL bridge connectors registered");
    }
    console.log("\n⚠️  Next steps:");
    console.log("1. Set LayerZero peer addresses on other chains");
    console.log("2. Test message sending/receiving");
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
