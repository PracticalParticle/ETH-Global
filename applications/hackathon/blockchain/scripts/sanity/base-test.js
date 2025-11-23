/**
 * Base Test Class for EnterpriseCrossChainMessenger Tests
 * Provides common functionality for all test sections
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Helper to get RPC URL from environment or Hardhat config
function getRpcUrl() {
    const network = process.env.HARDHAT_NETWORK || "sepolia";
    const rpcUrls = {
        sepolia: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
        arbitrumSepolia: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc"
    };
    return rpcUrls[network] || rpcUrls.sepolia;
}

class BaseMessengerTest {
    constructor(testName) {
        this.testName = testName;
        
        // Determine test mode
        this.testMode = process.env.TEST_MODE || "auto";
        console.log(`🔧 Test Mode: ${this.testMode.toUpperCase()}`);
        
        // Initialize contract address and ABI
        this.contractAddress = null;
        this.contractABI = null;
        this.contract = null;
        
        // Initialize test wallets
        this.wallets = {};
        
        // Dynamic role assignments
        this.roles = {
            owner: null,
            broadcaster: null,
            recovery: null
        };
        
        this.roleWallets = {};
        
        // Test results
        this.testResults = {
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            startTime: null,
            endTime: null
        };
        
        // Network configuration
        this.networkName = process.env.HARDHAT_NETWORK || "sepolia";
    }

    async initializeAutoMode() {
        console.log("🤖 AUTO MODE: Loading contract addresses from deployment files...");
        
        try {
            // Load from deployment file
            const deploymentsDir = path.join(__dirname, "..", "..", "deployments");
            
            // Determine chain ID based on network name
            const chainIdMap = {
                sepolia: "11155111",
                arbitrumSepolia: "421614"
            };
            const chainId = chainIdMap[this.networkName] || "11155111";
            
            // Try different file name patterns
            let deploymentFile = path.join(deploymentsDir, `sepolia-${chainId}.json`);
            if (!fs.existsSync(deploymentFile)) {
                deploymentFile = path.join(deploymentsDir, `${this.networkName}-${chainId}.json`);
            }
            if (!fs.existsSync(deploymentFile)) {
                // Try finding any file with the chain ID
                if (fs.existsSync(deploymentsDir)) {
                    const files = fs.readdirSync(deploymentsDir);
                    const matchingFile = files.find(f => f.includes(chainId) && f.endsWith('.json'));
                    if (matchingFile) {
                        deploymentFile = path.join(deploymentsDir, matchingFile);
                    }
                }
            }
            
            if (!fs.existsSync(deploymentFile)) {
                const availableFiles = fs.existsSync(deploymentsDir) 
                    ? fs.readdirSync(deploymentsDir).join(", ") 
                    : "deployments directory not found";
                throw new Error(`Deployment file not found in ${deploymentsDir} for network ${this.networkName} (chain ${chainId}). Available files: ${availableFiles}`);
            }
            
            console.log(`  📋 Loading deployment file: ${deploymentFile}`);
            const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
            this.contractAddress = deploymentInfo.contracts.EnterpriseCrossChainMessenger;
            
            if (!this.contractAddress) {
                throw new Error("Could not find EnterpriseCrossChainMessenger address in deployment file");
            }
            
            console.log(`📋 Contract Address: ${this.contractAddress}`);
            
            // Load ABI from artifacts
            const artifactsPath = path.join(__dirname, "..", "..", "artifacts", "applications", "hackathon", "blockchain", "contracts", "EnterpriseCrossChainMessenger.sol", "EnterpriseCrossChainMessenger.json");
            const artifact = JSON.parse(fs.readFileSync(artifactsPath, "utf8"));
            this.contractABI = artifact.abi;
            
            // Get signers from Hardhat
            const signers = await ethers.getSigners();
            for (let i = 0; i < Math.min(5, signers.length); i++) {
                this.wallets[`wallet${i + 1}`] = signers[i];
                console.log(`  🔑 wallet${i + 1}: ${signers[i].address}`);
            }
            
            console.log("✅ Auto mode initialization completed");
            
        } catch (error) {
            console.error("❌ Auto mode initialization failed:", error.message);
            throw new Error(`Auto mode failed: ${error.message}`);
        }
    }

    async initializeManualMode() {
        console.log("👤 MANUAL MODE: Using provided contract addresses and private keys...");
        
        try {
            // Get contract address from environment or deployment file
            const deploymentsDir = path.join(__dirname, "..", "..", "deployments");
            const network = await ethers.provider.getNetwork();
            const chainId = network.chainId.toString();
            
            // Determine chain ID based on network name
            const chainIdMap = {
                sepolia: "11155111",
                arbitrumSepolia: "421614"
            };
            const expectedChainId = chainIdMap[this.networkName] || chainId;
            
            // Try different file name patterns
            let deploymentFile = null;
            
            // First try: sepolia-{chainId}.json
            deploymentFile = path.join(deploymentsDir, `sepolia-${expectedChainId}.json`);
            if (!fs.existsSync(deploymentFile)) {
                // Second try: {networkName}-{chainId}.json
                deploymentFile = path.join(deploymentsDir, `${this.networkName}-${expectedChainId}.json`);
            }
            if (!fs.existsSync(deploymentFile)) {
                // Third try: find any file with the chain ID
                if (fs.existsSync(deploymentsDir)) {
                    const files = fs.readdirSync(deploymentsDir);
                    const matchingFile = files.find(f => f.includes(expectedChainId) && f.endsWith('.json'));
                    if (matchingFile) {
                        deploymentFile = path.join(deploymentsDir, matchingFile);
                    }
                }
            }
            
            if (deploymentFile && fs.existsSync(deploymentFile)) {
                console.log(`  📋 Loading from deployment file: ${deploymentFile}`);
                const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
                this.contractAddress = deploymentInfo.contracts.EnterpriseCrossChainMessenger;
            } else {
                this.contractAddress = process.env.MESSENGER_ADDRESS;
            }
            
            if (!this.contractAddress) {
                const availableFiles = fs.existsSync(deploymentsDir) 
                    ? fs.readdirSync(deploymentsDir).join(", ") 
                    : "deployments directory not found";
                throw new Error(`MESSENGER_ADDRESS not set and deployment file not found for network ${this.networkName} (chain ${expectedChainId}). Available files: ${availableFiles}`);
            }
            
            console.log(`📋 Contract Address: ${this.contractAddress}`);
            
            // Load ABI from artifacts
            const artifactsPath = path.join(__dirname, "..", "..", "artifacts", "applications", "hackathon", "blockchain", "contracts", "EnterpriseCrossChainMessenger.sol", "EnterpriseCrossChainMessenger.json");
            const artifact = JSON.parse(fs.readFileSync(artifactsPath, "utf8"));
            this.contractABI = artifact.abi;
            
            // Initialize wallets from environment variables
            const privateKeys = [
                process.env.TEST_WALLET_1_PRIVATE_KEY,
                process.env.TEST_WALLET_2_PRIVATE_KEY,
                process.env.TEST_WALLET_3_PRIVATE_KEY,
                process.env.TEST_WALLET_4_PRIVATE_KEY,
                process.env.TEST_WALLET_5_PRIVATE_KEY
            ];
            
            for (let i = 0; i < privateKeys.length; i++) {
                if (privateKeys[i]) {
                    const wallet = new ethers.Wallet(privateKeys[i], ethers.provider);
                    this.wallets[`wallet${i + 1}`] = wallet;
                    console.log(`  🔑 wallet${i + 1}: ${wallet.address}`);
                }
            }
            
            console.log("✅ Manual mode initialization completed");
            
        } catch (error) {
            console.error("❌ Manual mode initialization failed:", error.message);
            throw new Error(`Manual mode failed: ${error.message}`);
        }
    }

    async initialize() {
        console.log(`🔧 Initializing ${this.testName}...`);
        
        // Initialize based on test mode
        if (this.testMode === "auto") {
            await this.initializeAutoMode();
        } else {
            await this.initializeManualMode();
        }
        
        // Initialize contract instance
        this.contract = new ethers.Contract(this.contractAddress, this.contractABI, ethers.provider);
        
        // Discover dynamic role assignments
        await this.discoverRoleAssignments();
        
        // Clear any pending transactions to ensure clean test state
        await this.clearPendingTransactions();
        
        console.log(`✅ ${this.testName} initialized successfully\n`);
    }

    async discoverRoleAssignments() {
        try {
            // Get actual role addresses from contract
            this.roles.owner = await this.contract.owner();
            this.roles.broadcaster = await this.contract.getBroadcaster();
            this.roles.recovery = await this.contract.getRecovery();
            
            console.log("📋 DISCOVERED ROLE ASSIGNMENTS:");
            console.log(`  👑 Owner: ${this.roles.owner}`);
            console.log(`  📡 Broadcaster: ${this.roles.broadcaster}`);
            console.log(`  🛡️ Recovery: ${this.roles.recovery}`);
            
            // Map roles to available wallets
            for (const [walletName, wallet] of Object.entries(this.wallets)) {
                const walletAddress = wallet.address || (wallet.getAddress ? await wallet.getAddress() : null);
                if (!walletAddress) continue;
                
                if (walletAddress.toLowerCase() === this.roles.owner.toLowerCase()) {
                    this.roleWallets.owner = wallet;
                    console.log(`  🔑 Owner role served by: ${walletName} (${walletAddress})`);
                }
                if (walletAddress.toLowerCase() === this.roles.broadcaster.toLowerCase()) {
                    this.roleWallets.broadcaster = wallet;
                    console.log(`  🔑 Broadcaster role served by: ${walletName} (${walletAddress})`);
                }
                if (walletAddress.toLowerCase() === this.roles.recovery.toLowerCase()) {
                    this.roleWallets.recovery = wallet;
                    console.log(`  🔑 Recovery role served by: ${walletName} (${walletAddress})`);
                }
            }
            
        } catch (error) {
            console.error("❌ Failed to discover role assignments:", error.message);
            throw new Error(`Role discovery failed: ${error.message}`);
        }
    }

    getRoleWallet(roleName) {
        const wallet = this.roleWallets[roleName.toLowerCase()];
        if (!wallet) {
            throw new Error(`No wallet found for role: ${roleName}`);
        }
        return wallet;
    }

    async sendTransaction(method, wallet) {
        try {
            const contractWithSigner = this.contract.connect(wallet);
            const tx = await contractWithSigner[method.name](...method.args);
            const receipt = await tx.wait();
            return receipt;
        } catch (error) {
            throw new Error(`Transaction failed: ${error.message}`);
        }
    }

    async callContractMethod(methodName, args = [], wallet = null) {
        try {
            let contractInstance = this.contract;
            
            if (wallet) {
                contractInstance = this.contract.connect(wallet);
            } else if (this.roleWallets.owner) {
                contractInstance = this.contract.connect(this.roleWallets.owner);
            }
            
            const result = await contractInstance[methodName](...args);
            return result;
        } catch (error) {
            throw new Error(`Contract call failed: ${error.message}`);
        }
    }

    assertTest(condition, message) {
        this.testResults.totalTests++;
        
        if (condition) {
            this.testResults.passedTests++;
            console.log(`  ✅ ${message}`);
        } else {
            this.testResults.failedTests++;
            console.log(`  ❌ ${message}`);
            throw new Error(`Test assertion failed: ${message}`);
        }
    }

    handleTestError(testName, error) {
        this.testResults.failedTests++;
        console.log(`❌ ${testName} failed: ${error.message}`);
        if (error.stack) {
            console.log(`   Stack: ${error.stack}`);
        }
    }

    async checkPendingTransactions() {
        try {
            console.log("🔍 Checking for pending transactions...");
            
            const pendingTxs = await this.callContractMethod("getPendingTransactions");
            
            if (pendingTxs.length === 0) {
                console.log("✅ No pending transactions found");
                return { hasPending: false, transactions: [] };
            }
            
            console.log(`📋 Found ${pendingTxs.length} pending transactions:`);
            
            const transactionDetails = [];
            
            for (const txId of pendingTxs) {
                try {
                    const tx = await this.callContractMethod("getTransaction", [txId]);
                    const currentTime = Math.floor(Date.now() / 1000);
                    const timeRemaining = Number(tx.releaseTime) - currentTime;
                    
                    const txDetail = {
                        txId: txId.toString(),
                        status: tx.status,
                        operationType: tx.params.operationType,
                        requester: tx.params.requester,
                        timeRemaining: timeRemaining,
                        expired: timeRemaining <= 0
                    };
                    
                    transactionDetails.push(txDetail);
                    
                    console.log(`   📋 Transaction ${txId}:`);
                    console.log(`      Status: ${tx.status} (${this.getStatusName(Number(tx.status))})`);
                    console.log(`      Requester: ${tx.params.requester}`);
                    console.log(`      Time Remaining: ${timeRemaining} seconds`);
                    console.log(`      Expired: ${txDetail.expired}`);
                    
                } catch (error) {
                    console.log(`   ❌ Error getting details for transaction ${txId}: ${error.message}`);
                }
            }
            
            return { hasPending: true, transactions: transactionDetails };
            
        } catch (error) {
            console.log(`❌ Error checking pending transactions: ${error.message}`);
            return { hasPending: false, transactions: [] };
        }
    }

    async clearPendingTransactions() {
        console.log("🧹 CLEARING PENDING TRANSACTIONS");
        console.log("-".repeat(40));
        
        try {
            const pendingTxs = await this.callContractMethod("getPendingTransactions");
            
            if (pendingTxs.length === 0) {
                console.log("✅ No pending transactions to clear");
                return true;
            }
            
            console.log(`📋 Found ${pendingTxs.length} pending transactions to clear`);
            
            let clearedCount = 0;
            
            for (const txId of pendingTxs) {
                try {
                    console.log(`  🗑️  Cancelling transaction ${txId}`);
                    
                    const ownerWallet = this.getRoleWallet("owner");
                    const contractWithSigner = this.contract.connect(ownerWallet);
                    const tx = await contractWithSigner.cancelMessage(txId);
                    await tx.wait();
                    
                    clearedCount++;
                    console.log(`    ✅ Transaction ${txId} cancelled successfully`);
                    
                } catch (error) {
                    console.log(`    ❌ Error cancelling transaction ${txId}: ${error.message}`);
                }
            }
            
            console.log(`📊 Cleared ${clearedCount}/${pendingTxs.length} pending transactions`);
            
            const remainingPending = await this.callContractMethod("getPendingTransactions");
            if (remainingPending.length === 0) {
                console.log("✅ All pending transactions cleared successfully");
                return true;
            } else {
                console.log(`⚠️  ${remainingPending.length} transactions still pending`);
                return false;
            }
            
        } catch (error) {
            console.log(`❌ Error clearing pending transactions: ${error.message}`);
            return false;
        }
    }

    getStatusName(status) {
        const statusMap = {
            0: "UNDEFINED",
            1: "PENDING",
            2: "CANCELLED",
            3: "COMPLETED",
            4: "FAILED",
            5: "REJECTED"
        };
        return statusMap[status] || "UNKNOWN";
    }

    printTestResults() {
        const duration = this.testResults.endTime - this.testResults.startTime;
        const successRate = this.testResults.totalTests > 0 
            ? ((this.testResults.passedTests / this.testResults.totalTests) * 100).toFixed(2)
            : "0.00";
        
        console.log("\n" + "=".repeat(60));
        console.log(`📊 ${this.testName.toUpperCase()} TEST RESULTS`);
        console.log("=".repeat(60));
        console.log(`📋 Total Tests: ${this.testResults.totalTests}`);
        console.log(`✅ Passed: ${this.testResults.passedTests}`);
        console.log(`❌ Failed: ${this.testResults.failedTests}`);
        console.log(`📈 Success Rate: ${successRate}%`);
        console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)} seconds`);
        console.log("=".repeat(60));
        
        if (this.testResults.failedTests === 0) {
            console.log("🎉 All tests passed successfully!");
        } else {
            console.log("⚠️  Some tests failed. Please review the output above.");
        }
    }

    async runTest() {
        this.testResults.startTime = Date.now();
        console.log(`🚀 Starting ${this.testName}...`);
        
        try {
            await this.initialize();
            await this.executeTests();
            
            this.testResults.endTime = Date.now();
            this.printTestResults();
            
            return this.testResults.failedTests === 0;
            
        } catch (error) {
            this.testResults.endTime = Date.now();
            this.handleTestError(this.testName, error);
            this.printTestResults();
            return false;
        }
    }

    // Abstract method - must be implemented by subclasses
    async executeTests() {
        throw new Error("executeTests() must be implemented by subclasses");
    }
}

module.exports = BaseMessengerTest;

