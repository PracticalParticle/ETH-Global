/**
 * Message Meta-Transaction Approval Tests
 * Tests the workflow: owner cancels tx → owner requests new message → owner signs meta-tx → broadcaster executes
 */

const BaseMessengerTest = require("./base-test");
const { ethers } = require("hardhat");

class MessageMetaTxApprovalTests extends BaseMessengerTest {
    constructor() {
        super("Message Meta-Transaction Approval Tests");
        this.txIdToCancel = null;
        this.txIdToApprove = null;
    }

    async executeTests() {
        console.log("\n🔄 TESTING MESSAGE META-TRANSACTION APPROVAL WORKFLOW");
        console.log("===================================================");
        console.log("📋 This workflow tests:");
        console.log("   1. Owner requests a cross-chain message");
        console.log("   2. Owner cancels the message (demonstrating cancellation)");
        console.log("   3. Owner requests a new cross-chain message");
        console.log("   4. Owner signs meta-transaction for approval");
        console.log("   5. Broadcaster executes the meta-transaction");
        console.log("   6. Verify message was sent successfully");

        await this.testStep1RequestMessage();
        await this.testStep2CancelMessage();
        await this.testStep3RequestNewMessage();
        await this.testStep4SignMetaTransaction();
        await this.testStep5ExecuteMetaTransaction();
        await this.testStep6VerifyMessageSent();
    }

    async testStep1RequestMessage() {
        console.log("\n📝 STEP 1: Owner Requests Cross-Chain Message (to be cancelled)");
        console.log("-------------------------------------------------------------");
        try {
            const ownerWallet = this.getRoleWallet("owner");
            const contractWithSigner = this.contract.connect(ownerWallet);
            const targetChainId = 421614; // Arbitrum Sepolia
            const payload = ethers.toUtf8Bytes("Message to be cancelled");
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
            
            console.log("  📤 Requesting message...");
            const tx = await contractWithSigner.sendMessageRequest(
                targetChainId,
                payload,
                requirements
            );
            const receipt = await tx.wait();
            
            // Get transaction ID from pending transactions
            const pendingTxs = await this.callContractMethod("getPendingTransactions");
            this.txIdToCancel = pendingTxs[pendingTxs.length - 1];
            
            console.log(`  ✅ Transaction hash: ${receipt.hash}`);
            console.log(`  ✅ Transaction ID: ${this.txIdToCancel.toString()}`);
            console.log("  🎉 Step 1 completed: Message request created");
        } catch (error) {
            console.error("  ❌ Step 1 failed:", error.message);
            throw error;
        }
    }

    async testStep2CancelMessage() {
        console.log("\n🗑️  STEP 2: Owner Cancels Message");
        console.log("----------------------------------");
        try {
            const ownerWallet = this.getRoleWallet("owner");
            const contractWithSigner = this.contract.connect(ownerWallet);
            
            const txBefore = await this.callContractMethod("getTransaction", [this.txIdToCancel]);
            this.assertTest(Number(txBefore.status) === 1, "Transaction is pending before cancellation");
            
            console.log(`  🗑️  Cancelling transaction ${this.txIdToCancel.toString()}...`);
            const tx = await contractWithSigner.cancelMessage(this.txIdToCancel);
            const receipt = await tx.wait();
            
            console.log(`  ✅ Cancellation transaction hash: ${receipt.hash}`);
            
            const txAfter = await this.callContractMethod("getTransaction", [this.txIdToCancel]);
            this.assertTest(Number(txAfter.status) === 2, "Transaction is in CANCELLED status");
            
            console.log("  🎉 Step 2 completed: Message cancelled successfully");
        } catch (error) {
            console.error("  ❌ Step 2 failed:", error.message);
            throw error;
        }
    }

    async testStep3RequestNewMessage() {
        console.log("\n📝 STEP 3: Owner Requests New Cross-Chain Message (for meta-tx approval)");
        console.log("------------------------------------------------------------------------");
        try {
            const ownerWallet = this.getRoleWallet("owner");
            const contractWithSigner = this.contract.connect(ownerWallet);
            const targetChainId = 421614; // Arbitrum Sepolia
            const payload = ethers.toUtf8Bytes("Message to be approved via meta-transaction");
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
            
            console.log("  📤 Requesting new message...");
            const tx = await contractWithSigner.sendMessageRequest(
                targetChainId,
                payload,
                requirements
            );
            const receipt = await tx.wait();
            
            // Get transaction ID from pending transactions
            const pendingTxs = await this.callContractMethod("getPendingTransactions");
            this.txIdToApprove = pendingTxs[pendingTxs.length - 1];
            
            console.log(`  ✅ Transaction hash: ${receipt.hash}`);
            console.log(`  ✅ Transaction ID: ${this.txIdToApprove.toString()}`);
            
            // Verify transaction is pending
            const txRecord = await this.callContractMethod("getTransaction", [this.txIdToApprove]);
            this.assertTest(Number(txRecord.status) === 1, "Transaction is in PENDING status");
            
            console.log("  🎉 Step 3 completed: New message request created");
        } catch (error) {
            console.error("  ❌ Step 3 failed:", error.message);
            throw error;
        }
    }

    async testStep4SignMetaTransaction() {
        console.log("\n✍️  STEP 4: Owner Signs Meta-Transaction for Approval");
        console.log("---------------------------------------------------");
        try {
            // Get the transaction record
            const txRecord = await this.callContractMethod("getTransaction", [this.txIdToApprove]);
            this.assertTest(Number(txRecord.status) === 1, "Transaction is still pending");
            
            // Prepare meta-transaction parameters
            const network = await ethers.provider.getNetwork();
            const chainId = Number(network.chainId);
            const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
            
            // Get the function selector for approveMessageWithMetaTx
            // The selector is the first 4 bytes of the keccak256 hash of the function signature
            const functionSig = "approveMessageWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes32,bytes,(address,uint256,address,uint256),(uint256,uint256,address,bytes4,uint256,uint256,address),bytes,bytes))";
            const hash = ethers.keccak256(ethers.toUtf8Bytes(functionSig));
            const approveMessageSelector = hash.slice(0, 10); // First 4 bytes (0x + 8 hex chars)
            
            const metaTxParams = {
                chainId: chainId,
                nonce: this.txIdToApprove,
                handlerContract: this.contractAddress,
                handlerSelector: approveMessageSelector,
                action: 4, // EXECUTE_META_APPROVE (from StateAbstraction)
                deadline: deadline,
                maxGasPrice: 0,
                signer: this.roles.owner
            };
            
            console.log("  📋 Meta-transaction parameters:");
            console.log(`     Chain ID: ${chainId}`);
            console.log(`     Nonce (txId): ${this.txIdToApprove.toString()}`);
            console.log(`     Handler Contract: ${this.contractAddress}`);
            console.log(`     Handler Selector: ${approveMessageSelector}`);
            console.log(`     Action: EXECUTE_META_APPROVE (4)`);
            console.log(`     Deadline: ${new Date(deadline * 1000).toLocaleString()}`);
            console.log(`     Signer: ${this.roles.owner}`);
            
            // Generate unsigned meta-transaction
            console.log("  🔄 Generating unsigned meta-transaction...");
            const unsignedMetaTx = await this.generateUnsignedMetaTransactionForExisting(
                this.txIdToApprove,
                metaTxParams
            );
            
            console.log("  ✅ Unsigned meta-transaction generated");
            console.log(`     Message hash: ${unsignedMetaTx.message || "N/A"}`);
            
            // Get owner's private key
            const ownerWallet = this.getRoleWallet("owner");
            const ownerPrivateKey = ownerWallet.privateKey;
            
            // Sign the meta-transaction
            console.log("  ✍️  Signing meta-transaction with owner's private key...");
            const signedMetaTx = await this.signMetaTransaction(unsignedMetaTx, ownerPrivateKey);
            
            console.log("  ✅ Meta-transaction signed");
            console.log(`     Signature: ${signedMetaTx.signature ? signedMetaTx.signature.substring(0, 20) + "..." : "N/A"}`);
            
            // Store signed meta-transaction for execution
            this.signedMetaTx = signedMetaTx;
            
            console.log("  🎉 Step 4 completed: Meta-transaction signed by owner");
        } catch (error) {
            console.error("  ❌ Step 4 failed:", error.message);
            throw error;
        }
    }

    async testStep5ExecuteMetaTransaction() {
        console.log("\n🚀 STEP 5: Broadcaster Executes Meta-Transaction");
        console.log("---------------------------------------------");
        try {
            if (!this.signedMetaTx) {
                throw new Error("Signed meta-transaction not found. Run Step 4 first.");
            }
            
            // Get broadcaster wallet
            const broadcasterWallet = this.getRoleWallet("broadcaster");
            const contractWithSigner = this.contract.connect(broadcasterWallet);
            
            // Estimate routing fee (this would normally be calculated, but for test we'll use a small amount)
            const routingFee = ethers.parseEther("0.001"); // Small fee for testing
            
            console.log("  📡 Broadcaster executing meta-transaction...");
            console.log(`     Routing fee: ${ethers.formatEther(routingFee)} ETH`);
            console.log(`     Transaction ID: ${this.txIdToApprove.toString()}`);
            
            // Execute the meta-transaction with routing fee
            const tx = await contractWithSigner.approveMessageWithMetaTx(
                this.signedMetaTx,
                { value: routingFee }
            );
            
            const receipt = await tx.wait();
            console.log(`  ✅ Meta-transaction execution hash: ${receipt.hash}`);
            console.log(`  ✅ Block number: ${receipt.blockNumber}`);
            
            // Verify transaction is completed
            const txRecord = await this.callContractMethod("getTransaction", [this.txIdToApprove]);
            this.assertTest(Number(txRecord.status) === 3, "Transaction is in COMPLETED status");
            
            console.log("  🎉 Step 5 completed: Meta-transaction executed by broadcaster");
        } catch (error) {
            console.error("  ❌ Step 5 failed:", error.message);
            throw error;
        }
    }

    async testStep6VerifyMessageSent() {
        console.log("\n✅ STEP 6: Verify Message Was Sent Successfully");
        console.log("---------------------------------------------");
        try {
            // Get the transaction record
            const txRecord = await this.callContractMethod("getTransaction", [this.txIdToApprove]);
            
            this.assertTest(Number(txRecord.status) === 3, "Transaction is completed");
            
            // Check if message was created (it should be in the messages mapping)
            // Note: We can't directly access the messages mapping, but we can check events
            console.log("  📋 Transaction Status: COMPLETED");
            console.log(`  📋 Transaction ID: ${this.txIdToApprove.toString()}`);
            console.log(`  📋 Operation Type: ${txRecord.params.operationType}`);
            
            // Verify it's no longer in pending transactions
            const pendingTxs = await this.callContractMethod("getPendingTransactions");
            const isStillPending = pendingTxs.some(tx => tx.toString() === this.txIdToApprove.toString());
            this.assertTest(!isStillPending, "Transaction is no longer in pending list");
            
            console.log("  ✅ Message was successfully sent via meta-transaction");
            console.log("  🎉 Step 6 completed: Message verification successful");
        } catch (error) {
            console.error("  ❌ Step 6 failed:", error.message);
            throw error;
        }
    }
}

module.exports = MessageMetaTxApprovalTests;

