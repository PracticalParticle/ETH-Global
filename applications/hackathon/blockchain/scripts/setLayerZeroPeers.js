const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * @notice Set LayerZero peer addresses for cross-chain communication
 * @dev Sets peer addresses on routers to enable LayerZero messaging between chains
 */
async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Setting LayerZero peer addresses...");
    console.log("Deployer:", deployer.address);

    const network = await ethers.provider.getNetwork();
    console.log("Network:", network.name, "Chain ID:", network.chainId);

    // Load deployment info for current network
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    const deploymentFile = path.join(deploymentsDir, `${network.name}-${network.chainId}.json`);

    if (!fs.existsSync(deploymentFile)) {
        throw new Error(`Deployment file not found: ${deploymentFile}. Please run deploy.js first.`);
    }

    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    console.log("\n📋 Loaded deployment info from:", deploymentFile);

    const currentChainId = network.chainId.toString();

    // Peer configuration
    // Ethereum Sepolia -> Arbitrum Sepolia
    // Arbitrum Sepolia -> Ethereum Sepolia
    // Load peer router addresses from deployment files
    let peerRouterAddress;
    if (currentChainId === "11155111") {
        // Ethereum Sepolia -> need Arbitrum Sepolia router
        const arbDeploymentFile = path.join(deploymentsDir, `arbitrumSepolia-421614.json`);
        if (fs.existsSync(arbDeploymentFile)) {
            const arbDeploymentInfo = JSON.parse(fs.readFileSync(arbDeploymentFile, "utf8"));
            peerRouterAddress = arbDeploymentInfo.contracts.HybridOrchestrationRouter;
        }
    } else if (currentChainId === "421614") {
        // Arbitrum Sepolia -> need Ethereum Sepolia router
        const sepoliaDeploymentFile = path.join(deploymentsDir, `sepolia-11155111.json`);
        if (fs.existsSync(sepoliaDeploymentFile)) {
            const sepoliaDeploymentInfo = JSON.parse(fs.readFileSync(sepoliaDeploymentFile, "utf8"));
            peerRouterAddress = sepoliaDeploymentInfo.contracts.HybridOrchestrationRouter;
        }
    }

    const peerConfig = {
        "11155111": { // Ethereum Sepolia
            routerAddress: deploymentInfo.contracts.HybridOrchestrationRouter,
            peerEid: 40231, // Arbitrum Sepolia EID
            peerRouterAddress: peerRouterAddress || "0x2C5A00EA605767A2FE4362A70BFA9fdfEDcaaf69" // Will be loaded from deployment file
        },
        "421614": { // Arbitrum Sepolia
            routerAddress: deploymentInfo.contracts.HybridOrchestrationRouter,
            peerEid: 40161, // Ethereum Sepolia EID
            peerRouterAddress: peerRouterAddress || "0x12BF1f3Af419960d376768A4c141252be34a9DAE" // Will be loaded from deployment file
        }
    };
    const config = peerConfig[currentChainId];

    if (!config) {
        console.log(`⚠️  No peer configuration found for chain ID ${currentChainId}`);
        console.log("Available configurations:");
        Object.keys(peerConfig).forEach(chainId => {
            console.log(`  - Chain ID ${chainId}`);
        });
        return;
    }

    console.log("\n🔗 Setting LayerZero peer address...");
    console.log(`   Router: ${config.routerAddress}`);
    console.log(`   Peer EID: ${config.peerEid}`);
    console.log(`   Peer Router: ${config.peerRouterAddress}`);

    // Get router contract
    const HybridOrchestrationRouter = await ethers.getContractFactory("HybridOrchestrationRouter");
    const router = HybridOrchestrationRouter.attach(config.routerAddress);

    // Convert peer address to bytes32 (required by LayerZero)
    const peerAddressBytes32 = ethers.zeroPadValue(config.peerRouterAddress, 32);

    // Check current peer (if any)
    try {
        const currentPeer = await router.peers(config.peerEid);
        if (currentPeer !== ethers.ZeroHash && currentPeer.toLowerCase() !== peerAddressBytes32.toLowerCase()) {
            console.log(`   ⚠️  Current peer: ${currentPeer}`);
            console.log(`   Will update to: ${peerAddressBytes32}`);
        } else if (currentPeer.toLowerCase() === peerAddressBytes32.toLowerCase()) {
            console.log("   ✅ Peer already set correctly");
            return;
        }
    } catch (error) {
        console.log("   ℹ️  Could not check current peer (may not be set yet)");
    }

    // Set peer
    console.log("\n📝 Setting peer...");
    const setPeerTx = await router.setPeer(config.peerEid, peerAddressBytes32);
    console.log("   Transaction hash:", setPeerTx.hash);
    
    const receipt = await setPeerTx.wait();
    console.log("   ✅ Transaction confirmed in block:", receipt.blockNumber);

    // Verify peer was set
    const verifiedPeer = await router.peers(config.peerEid);
    if (verifiedPeer.toLowerCase() === peerAddressBytes32.toLowerCase()) {
        console.log("   ✅ Peer address verified successfully");
    } else {
        console.log("   ⚠️  Warning: Peer verification failed");
        console.log("   Expected:", peerAddressBytes32);
        console.log("   Got:", verifiedPeer);
    }

    // Update deployment info
    if (!deploymentInfo.layerZeroPeers) {
        deploymentInfo.layerZeroPeers = {};
    }
    deploymentInfo.layerZeroPeers[config.peerEid] = {
        peerRouterAddress: config.peerRouterAddress,
        peerAddressBytes32: peerAddressBytes32,
        setAt: new Date().toISOString(),
        txHash: setPeerTx.hash
    };
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log("\n💾 Deployment info updated");

    console.log("\n" + "=".repeat(60));
    console.log("✅ PEER ADDRESS SET SUCCESSFULLY");
    console.log("=".repeat(60));
    console.log(`Router: ${config.routerAddress}`);
    console.log(`Peer EID: ${config.peerEid}`);
    console.log(`Peer Router: ${config.peerRouterAddress}`);
    console.log("\n⚠️  Next steps:");
    console.log("1. Set peer on the other chain as well");
    console.log("2. Test cross-chain messaging");
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

