/**
 * Message Cancellation Tests
 * Tests the workflow: owner requests message → time delay → owner cancels
 */

const BaseMessengerTest = require("./base-test");

class MessageCancellationTests extends BaseMessengerTest {
    constructor() {
        super("Message Cancellation Tests");
    }

    async executeTests() {
        console.log("\n🔄 TESTING MESSAGE REQUEST AND CANCELLATION WORKFLOW");
        console.log("===================================================");
        console.log("📋 This workflow tests:");
        console.log("   1. Owner requests a cross-chain message");
        console.log("   2. Message enters time delay (5 minutes)");
        console.log("   3. Owner cancels the message before time delay expires");
        console.log("   4. Verify message is cancelled");

        await this.testStep1RequestMessage();
        await this.testStep2VerifyTimeDelay();
        await this.testStep3CancelMessage();
        await this.testStep4VerifyCancellation();
    }

    async testStep1RequestMessage() {
        console.log("\n📝 STEP 1: Owner Requests Cross-Chain Message");
        console.log("---------------------------------------------");

        try {
            // Get owner wallet
            const ownerWallet = this.getRoleWallet("owner");
            const contractWithSigner = this.contract.connect(ownerWallet);

            // Prepare message parameters
            const targetChainId = 421614; // Arbitrum Sepolia
            const payload = ethers.toUtf8Bytes("Test message from Ethereum Sepolia to Arbitrum Sepolia");
            
            // Message requirements - use LayerZero for fast delivery
            // Requirements struct: (bool requiresFastFinality, bool requiresGuaranteedDelivery, bool isCostSensitive, bool isMultiChain, uint256 maxDelay, uint256 amount, bool requiresNativeSecurity, bool requiresDisputeResolution, uint8 securityLevel)
            const requirements = [
                true,  // requiresFastFinality
                true,  // requiresGuaranteedDelivery
                false, // isCostSensitive
                true,  // isMultiChain
                3600,  // maxDelay (1 hour)
                0,     // amount (0 for message-only)
                false, // requiresNativeSecurity
                false, // requiresDisputeResolution
                2      // securityLevel (HIGH = 2)
            ];

            console.log("  📋 Message Parameters:");
            console.log(`     Target Chain ID: ${targetChainId}`);
            console.log(`     Payload: ${ethers.toUtf8String(payload)}`);
            console.log(`     Requirements: Fast finality, guaranteed delivery`);

            // Request message
            console.log("  📤 Requesting message...");
            const tx = await contractWithSigner.sendMessageRequest(
                targetChainId,
                payload,
                requirements
            );
            
            const receipt = await tx.wait();
            console.log(`  ✅ Transaction hash: ${receipt.hash}`);
            console.log(`  ✅ Block number: ${receipt.blockNumber}`);

            // Find the transaction ID from events or pending transactions
            // The sendMessageRequest creates a standard transaction, so we look for TransactionRequested event
            // or get it from pending transactions
            let txIdFound = false;
            
            // Try to find TransactionRequested event (from BaseStateMachine)
            for (const log of receipt.logs) {
                try {
                    const parsed = this.contract.interface.parseLog(log);
                    if (parsed && (parsed.name === "TransactionRequested" || parsed.name === "StandardTransactionRequested")) {
                        this.txId = parsed.args.txId || parsed.args.id;
                        if (this.txId) {
                            console.log(`  📋 Transaction ID (from event): ${this.txId.toString()}`);
                            this.assertTest(this.txId > 0n, "Message request created with valid transaction ID");
                            txIdFound = true;
                            break;
                        }
                    }
                } catch {
                    // Continue searching
                }
            }
            
            // Fallback: get pending transactions and use the latest one
            if (!txIdFound) {
                const pendingTxs = await this.callContractMethod("getPendingTransactions");
                this.assertTest(pendingTxs.length > 0, "Pending transactions found");
                this.txId = pendingTxs[pendingTxs.length - 1];
                console.log(`  📋 Transaction ID (from pending): ${this.txId.toString()}`);
            }

            // Verify transaction is pending
            const txRecord = await this.callContractMethod("getTransaction", [this.txId]);
            this.assertTest(Number(txRecord.status) === 1, "Transaction is in PENDING status");
            console.log(`  ✅ Transaction status: ${this.getStatusName(Number(txRecord.status))}`);

            console.log("  🎉 Step 1 completed: Message request created");

        } catch (error) {
            console.error("  ❌ Step 1 failed:", error.message);
            throw error;
        }
    }

    async testStep2VerifyTimeDelay() {
        console.log("\n⏰ STEP 2: Verify Time Delay (5 minutes)");
        console.log("--------------------------------------");

        try {
            // Get transaction details
            const txRecord = await this.callContractMethod("getTransaction", [this.txId]);
            const releaseTime = Number(txRecord.releaseTime);
            const currentTime = Math.floor(Date.now() / 1000);
            const timeDelay = releaseTime - currentTime;

            console.log(`  🕐 Current time: ${new Date(currentTime * 1000).toLocaleString()}`);
            console.log(`  🕐 Release time: ${new Date(releaseTime * 1000).toLocaleString()}`);
            console.log(`  ⏰ Time delay: ${timeDelay} seconds (${(timeDelay / 60).toFixed(2)} minutes)`);

            // Verify time delay is approximately 5 minutes (300 seconds)
            // Allow some tolerance for block time variations
            const expectedDelay = 300; // 5 minutes
            const tolerance = 10; // 10 seconds tolerance
            
            this.assertTest(
                Math.abs(timeDelay - expectedDelay) <= tolerance,
                `Time delay is approximately 5 minutes (${timeDelay}s, expected ~${expectedDelay}s)`
            );

            // Verify transaction is still pending
            this.assertTest(Number(txRecord.status) === 1, "Transaction is still in PENDING status");
            console.log(`  ✅ Transaction status: ${this.getStatusName(Number(txRecord.status))}`);

            console.log("  🎉 Step 2 completed: Time delay verified");

        } catch (error) {
            console.error("  ❌ Step 2 failed:", error.message);
            throw error;
        }
    }

    async testStep3CancelMessage() {
        console.log("\n🗑️  STEP 3: Owner Cancels Message");
        console.log("----------------------------------");

        try {
            // Get owner wallet
            const ownerWallet = this.getRoleWallet("owner");
            const contractWithSigner = this.contract.connect(ownerWallet);

            // Verify transaction is still pending before cancellation
            const txBefore = await this.callContractMethod("getTransaction", [this.txId]);
            this.assertTest(Number(txBefore.status) === 1, "Transaction is pending before cancellation");

            console.log(`  🗑️  Cancelling transaction ${this.txId.toString()}...`);
            
            // Cancel the message
            const tx = await contractWithSigner.cancelMessage(this.txId);
            const receipt = await tx.wait();
            
            console.log(`  ✅ Cancellation transaction hash: ${receipt.hash}`);
            console.log(`  ✅ Block number: ${receipt.blockNumber}`);

            // Check for cancellation event
            const cancelEvent = receipt.logs.find(log => {
                try {
                    const parsed = this.contract.interface.parseLog(log);
                    return parsed && (parsed.name === "TransactionCancelled" || parsed.name === "MessageCancelled");
                } catch {
                    return false;
                }
            });

            if (cancelEvent) {
                console.log("  ✅ Cancellation event found");
            }

            console.log("  🎉 Step 3 completed: Message cancelled");

        } catch (error) {
            console.error("  ❌ Step 3 failed:", error.message);
            throw error;
        }
    }

    async testStep4VerifyCancellation() {
        console.log("\n✅ STEP 4: Verify Message Cancellation");
        console.log("--------------------------------------");

        try {
            // Get updated transaction record
            const txRecord = await this.callContractMethod("getTransaction", [this.txId]);
            
            console.log(`  📋 Transaction ID: ${this.txId.toString()}`);
            console.log(`  📊 Status: ${this.getStatusName(Number(txRecord.status))}`);

            // Verify transaction is cancelled
            this.assertTest(
                Number(txRecord.status) === 2,
                "Transaction is in CANCELLED status"
            );

            // Verify transaction is no longer in pending list
            const pendingTxs = await this.callContractMethod("getPendingTransactions");
            const isStillPending = pendingTxs.some(tx => tx.toString() === this.txId.toString());
            this.assertTest(
                !isStillPending,
                "Transaction is no longer in pending transactions list"
            );

            console.log("  🎉 Step 4 completed: Cancellation verified");

        } catch (error) {
            console.error("  ❌ Step 4 failed:", error.message);
            throw error;
        }
    }
}

module.exports = MessageCancellationTests;

