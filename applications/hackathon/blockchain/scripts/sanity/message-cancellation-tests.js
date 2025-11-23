/**
 * Message Cancellation Tests
 * Tests the workflow: owner requests message → time delay → owner cancels
 */

const BaseMessengerTest = require("./base-test");

class MessageCancellationTests extends BaseMessengerTest {
    constructor() {
        super("Message Cancellation Tests");
        this.allTxIds = []; // Track all transaction IDs created during test
    }

    async executeTests() {
        console.log("\n🔄 TESTING MESSAGE REQUEST AND CANCELLATION WORKFLOW");
        console.log("===================================================");
        console.log("📋 This workflow tests:");
        console.log("   1. Owner requests a cross-chain message");
        console.log("   1.5. Owner requests additional messages (to populate pending list)");
        console.log("   2. Message enters time delay (5 minutes)");
        console.log("   2.5. List ALL pending transactions with time until expiration");
        console.log("   3. Owner cancels the message before time delay expires");
        console.log("   4. Verify message is cancelled");

        await this.testStep1RequestMessage();
        await this.testStep2VerifyTimeDelay(); // Verify time delay for first message
        await this.testStep1_5RequestAdditionalMessages(); // Create more messages to see multiple in list
        await this.testStep2_5ListPendingTransactions();
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
            
            // Track this transaction ID
            if (this.txId) {
                this.allTxIds.push(this.txId.toString());
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

    async testStep1_5RequestAdditionalMessages() {
        console.log("\n📝 STEP 1.5: Request Additional Messages (for testing pending list)");
        console.log("----------------------------------------------------------------");

        try {
            // Get owner wallet
            const ownerWallet = this.getRoleWallet("owner");
            const contractWithSigner = this.contract.connect(ownerWallet);

            // Request 2 additional messages to populate the pending list
            const additionalMessages = [
                {
                    targetChainId: 421614,
                    payload: ethers.toUtf8Bytes("Additional message #1"),
                    description: "Additional message #1"
                },
                {
                    targetChainId: 421614,
                    payload: ethers.toUtf8Bytes("Additional message #2"),
                    description: "Additional message #2"
                }
            ];

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

            for (let i = 0; i < additionalMessages.length; i++) {
                const msg = additionalMessages[i];
                console.log(`  📤 Requesting ${msg.description}...`);
                
                const tx = await contractWithSigner.sendMessageRequest(
                    msg.targetChainId,
                    msg.payload,
                    requirements
                );
                
                const receipt = await tx.wait();
                
                // Get the transaction ID from pending transactions
                const pendingTxs = await this.callContractMethod("getPendingTransactions");
                const newTxId = pendingTxs[pendingTxs.length - 1];
                
                console.log(`     ✅ Transaction hash: ${receipt.hash}`);
                console.log(`     ✅ Transaction ID: ${newTxId.toString()}`);
                
                // Track this transaction ID
                this.allTxIds.push(newTxId.toString());
                
                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            console.log(`  ✅ Created ${additionalMessages.length} additional message requests`);
            console.log(`  📊 Total pending transactions: ${this.allTxIds.length}`);

        } catch (error) {
            console.error("  ❌ Step 1.5 failed:", error.message);
            // Don't throw - this is optional for testing the list
            console.log("  ⚠️  Continuing with test despite additional message creation failure");
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
            // Allow some tolerance for block time variations and test execution time
            const expectedDelay = 300; // 5 minutes
            const tolerance = 30; // 30 seconds tolerance (to account for test execution time)
            
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

    async testStep2_5ListPendingTransactions() {
        console.log("\n📋 STEP 2.5: List Pending Transactions with Time Until Expiration");
        console.log("---------------------------------------------------------------");

        try {
            // Get all pending transactions
            const pendingTxs = await this.callContractMethod("getPendingTransactions");
            
            if (pendingTxs.length === 0) {
                console.log("  ✅ No pending transactions found");
                return;
            }

            console.log(`  📊 Found ${pendingTxs.length} pending transaction(s):\n`);

            const currentTime = Math.floor(Date.now() / 1000);
            const transactionDetails = [];

            for (let i = 0; i < pendingTxs.length; i++) {
                const txId = pendingTxs[i];
                try {
                    const txRecord = await this.callContractMethod("getTransaction", [txId]);
                    const releaseTime = Number(txRecord.releaseTime);
                    const timeRemaining = releaseTime - currentTime;
                    const isExpired = timeRemaining <= 0;
                    
                    // Get operation type info
                    const operationType = txRecord.params.operationType;
                    const operationName = this.getOperationName(operationType);
                    
                    transactionDetails.push({
                        txId: txId.toString(),
                        status: Number(txRecord.status),
                        operationType: operationName,
                        requester: txRecord.params.requester,
                        releaseTime: releaseTime,
                        timeRemaining: timeRemaining,
                        expired: isExpired,
                        createdAt: releaseTime - 300 // Approximate (5 min before release)
                    });

                    // Display transaction info
                    console.log(`  📋 Transaction #${i + 1}:`);
                    console.log(`     Transaction ID: ${txId.toString()}`);
                    console.log(`     Status: ${this.getStatusName(Number(txRecord.status))}`);
                    console.log(`     Operation: ${operationName}`);
                    console.log(`     Requester: ${txRecord.params.requester}`);
                    console.log(`     Created: ${new Date((releaseTime - 300) * 1000).toLocaleString()}`);
                    console.log(`     Release Time: ${new Date(releaseTime * 1000).toLocaleString()}`);
                    
                    if (isExpired) {
                        const expiredSeconds = Math.abs(timeRemaining);
                        console.log(`     ⚠️  EXPIRED: ${this.formatTime(expiredSeconds)} ago`);
                    } else {
                        console.log(`     ⏰ Time Remaining: ${this.formatTime(timeRemaining)}`);
                        const minutesRemaining = Math.floor(timeRemaining / 60);
                        const secondsRemaining = timeRemaining % 60;
                        console.log(`     📊 Progress: ${((300 - timeRemaining) / 300 * 100).toFixed(1)}% of time delay elapsed`);
                    }
                    console.log("");

                } catch (error) {
                    console.log(`     ❌ Error getting details for transaction ${txId}: ${error.message}`);
                }
            }

            // Detailed view of all pending transactions
            console.log("\n  📊 DETAILED VIEW OF ALL PENDING TRANSACTIONS:");
            console.log("  " + "=".repeat(80));
            
            for (let i = 0; i < transactionDetails.length; i++) {
                const tx = transactionDetails[i];
                console.log(`\n  📋 Transaction #${i + 1} (ID: ${tx.txId}):`);
                console.log(`     ┌─────────────────────────────────────────────────────────────┐`);
                console.log(`     │ Status: ${this.getStatusName(tx.status).padEnd(55)}│`);
                console.log(`     │ Operation: ${tx.operationType.padEnd(50)}│`);
                console.log(`     │ Requester: ${tx.requester.padEnd(51)}│`);
                console.log(`     │ Created: ${new Date(tx.createdAt * 1000).toLocaleString().padEnd(52)}│`);
                console.log(`     │ Release Time: ${new Date(tx.releaseTime * 1000).toLocaleString().padEnd(47)}│`);
                
                if (tx.expired) {
                    const expiredAgo = this.formatTime(Math.abs(tx.timeRemaining));
                    console.log(`     │ ⚠️  EXPIRED: ${expiredAgo.padEnd(54)} ago │`);
                } else {
                    const timeRemaining = this.formatTime(tx.timeRemaining);
                    const progress = ((300 - tx.timeRemaining) / 300 * 100).toFixed(1);
                    console.log(`     │ ⏰ Time Remaining: ${timeRemaining.padEnd(46)}│`);
                    console.log(`     │ 📊 Progress: ${progress.padEnd(2)}% of time delay elapsed${" ".repeat(30 - progress.length)}│`);
                }
                console.log(`     └─────────────────────────────────────────────────────────────┘`);
            }
            
            // Summary table
            console.log("\n  📊 PENDING TRANSACTIONS SUMMARY TABLE:");
            console.log("  " + "-".repeat(70));
            console.log("  " + "ID".padEnd(10) + "Operation".padEnd(25) + "Time Remaining".padEnd(20) + "Status");
            console.log("  " + "-".repeat(70));
            
            for (const tx of transactionDetails) {
                const timeStr = tx.expired 
                    ? `EXPIRED (${this.formatTime(Math.abs(tx.timeRemaining))} ago)`
                    : this.formatTime(tx.timeRemaining);
                const statusStr = tx.expired ? "⚠️ EXPIRED" : "⏳ PENDING";
                console.log(`  ${tx.txId.padEnd(10)}${tx.operationType.padEnd(25)}${timeStr.padEnd(20)}${statusStr}`);
            }
            console.log("  " + "-".repeat(70));

            // Verify all test transactions are in the list
            console.log(`\n  📊 Test Transactions Status:`);
            for (const testTxId of this.allTxIds) {
                const testTx = transactionDetails.find(tx => tx.txId === testTxId);
                if (testTx) {
                    console.log(`     ✅ Transaction ID ${testTxId}:`);
                    console.log(`        Status: ${this.getStatusName(testTx.status)}`);
                    console.log(`        Operation: ${testTx.operationType}`);
                    console.log(`        Time remaining: ${this.formatTime(testTx.timeRemaining)}`);
                    if (testTx.expired) {
                        console.log(`        ⚠️  EXPIRED: ${this.formatTime(Math.abs(testTx.timeRemaining))} ago`);
                    } else {
                        const progress = ((300 - testTx.timeRemaining) / 300 * 100).toFixed(1);
                        console.log(`        📊 Progress: ${progress}% of time delay elapsed`);
                    }
                } else {
                    console.log(`     ⚠️  Transaction ID ${testTxId}: Not found in pending list (may have been cancelled or expired)`);
                }
            }
            
            // Verify at least our current test transaction is in the list
            const currentTestTx = transactionDetails.find(tx => tx.txId === this.txId.toString());
            this.assertTest(!!currentTestTx, "Current test transaction found in pending list");

            console.log("  🎉 Step 2.5 completed: Pending transactions listed");

        } catch (error) {
            console.error("  ❌ Step 2.5 failed:", error.message);
            throw error;
        }
    }

    formatTime(seconds) {
        const absSeconds = Math.abs(seconds);
        if (absSeconds < 60) {
            return `${seconds}s`;
        } else if (absSeconds < 3600) {
            const minutes = Math.floor(absSeconds / 60);
            const secs = absSeconds % 60;
            return `${minutes}m ${secs}s`;
        } else {
            const hours = Math.floor(absSeconds / 3600);
            const minutes = Math.floor((absSeconds % 3600) / 60);
            return `${hours}h ${minutes}m`;
        }
    }

    getOperationName(operationType) {
        // Check if it's a message operation
        // Message operations use SEND_MESSAGE operation type
        // We can check the function selector or operation type hash
        if (typeof operationType === 'string') {
            // Try to match known operation types
            if (operationType.toLowerCase().includes('message') || 
                operationType === '0x' || 
                operationType.length === 66) {
                return 'SEND_MESSAGE';
            }
        }
        // Default or unknown operation
        return operationType ? `0x${operationType.toString(16).padStart(64, '0')}` : 'UNKNOWN';
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

