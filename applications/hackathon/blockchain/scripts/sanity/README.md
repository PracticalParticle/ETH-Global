# Enterprise Cross-Chain Messenger Sanity Tests

Comprehensive sanity tests for the Enterprise Cross-Chain Messenger contract, testing the Bloxchain security workflow for cross-chain messaging.

## Overview

These tests verify the complete workflow of requesting, managing, and cancelling cross-chain messages using the Bloxchain protocol's secure ownership and time-delayed operation features.

## Test Structure

```
scripts/sanity/
├── base-test.js                    # Base test class with common functionality
├── message-cancellation-tests.js   # Message request and cancellation tests
├── run-tests.js                    # Test runner
└── README.md                       # This file
```

## Prerequisites

1. **Node.js 16+** and npm
2. **Hardhat** configured with network access
3. **Deployed contracts** on testnet (Ethereum Sepolia)
4. **Environment variables** configured (see Configuration section)

## Configuration

### Environment Variables

Create a `.env` file in the `blockchain` directory:

```env
# Test Mode: 'auto' (uses deployment files + Hardhat signers) or 'manual' (uses env vars)
TEST_MODE=auto

# RPC URLs
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc

# Private Key (for manual mode or when deploying)
PRIVATE_KEY=0x...

# Contract Addresses (for manual mode)
MESSENGER_ADDRESS=0x...

# Test Wallets (for manual mode)
TEST_WALLET_1_PRIVATE_KEY=0x...
TEST_WALLET_2_PRIVATE_KEY=0x...
TEST_WALLET_3_PRIVATE_KEY=0x...
TEST_WALLET_4_PRIVATE_KEY=0x...
TEST_WALLET_5_PRIVATE_KEY=0x...
```

### Test Modes

#### Auto Mode (`TEST_MODE=auto`)
- Automatically loads contract addresses from `deployments/sepolia-*.json`
- Uses Hardhat signers from `ethers.getSigners()`
- Best for local development and testing
- Requires: Contracts deployed and deployment files present

#### Manual Mode (`TEST_MODE=manual`)
- Uses contract addresses and private keys from environment variables
- Works with any Ethereum network (local or remote)
- Best for remote testing or custom networks
- Requires: All addresses and keys configured in `.env`

## Usage

### Run All Tests

```bash
npm run sanity
```

### Run Specific Test Suite

```bash
npm run sanity:cancellation
```

### Direct Execution

```bash
node scripts/sanity/run-tests.js --all
node scripts/sanity/run-tests.js --cancellation
```

## Available Test Suites

### Message Cancellation Tests (`--cancellation`)

Tests the complete message request and cancellation workflow:

1. **Request Message**: Owner requests a cross-chain message to Arbitrum Sepolia
2. **Verify Time Delay**: Confirms message enters 5-minute time delay
3. **Cancel Message**: Owner cancels the message before time delay expires
4. **Verify Cancellation**: Confirms message is properly cancelled

**Workflow:**
- Owner calls `sendMessageRequest()` → Creates time-delayed transaction
- Transaction enters PENDING status with 5-minute time lock
- Owner calls `cancelMessage()` → Cancels the transaction
- Transaction status changes to CANCELLED

## Test Architecture

### BaseMessengerTest

The base class provides:

- **Contract initialization**: Auto/manual mode support
- **Role discovery**: Automatically discovers owner, broadcaster, recovery roles
- **Wallet management**: Maps roles to available wallets
- **Transaction helpers**: Send transactions and call contract methods
- **Pending transaction management**: Check and clear pending transactions
- **Test result tracking**: Tracks test execution and results

### Role-Based Testing

Tests use role-based wallets to ensure proper access control:

- **Owner**: Can request and cancel messages
- **Broadcaster**: Can approve messages via meta-transactions
- **Recovery**: Can perform recovery operations

The test framework automatically discovers which wallet serves each role and uses the appropriate wallet for each operation.

## Writing New Tests

### Example Test Class

```javascript
const BaseMessengerTest = require('./base-test');

class MyTest extends BaseMessengerTest {
    constructor() {
        super('My Test Suite');
    }

    async executeTests() {
        console.log('\n🔄 TESTING MY WORKFLOW');
        
        await this.testStep1();
        await this.testStep2();
    }

    async testStep1() {
        console.log('\n📝 STEP 1: Do Something');
        
        // Get owner wallet
        const ownerWallet = this.getRoleWallet('owner');
        const contractWithSigner = this.contract.connect(ownerWallet);
        
        // Perform operation
        const tx = await contractWithSigner.someFunction();
        const receipt = await tx.wait();
        
        // Assert results
        this.assertTest(receipt.status === 1, 'Operation succeeded');
    }
}

module.exports = MyTest;
```

### Key Methods

- `getRoleWallet(roleName)`: Get wallet for a specific role (owner, broadcaster, recovery)
- `callContractMethod(methodName, args, wallet)`: Call a contract method
- `assertTest(condition, message)`: Assert a test condition
- `checkPendingTransactions()`: Check for pending transactions
- `clearPendingTransactions()`: Clear all pending transactions

## Troubleshooting

### "Contract address not found"

- **Auto mode**: Ensure contracts are deployed and `deployments/sepolia-*.json` exists
- **Manual mode**: Verify `MESSENGER_ADDRESS` is set in `.env`

### "No wallet found for role: owner"

- Ensure the owner address matches one of the available wallets
- Check that wallets are properly initialized in test mode
- Verify role assignments in the contract

### "Transaction failed"

- Check gas limits and gas prices
- Verify wallet has sufficient balance
- Ensure contract is deployed and initialized correctly
- Check that the operation is allowed for the role

### "RPC URL not accessible"

- Verify RPC URL is correct in `.env`
- Ensure network connectivity
- Check that the RPC endpoint is responding

## Test Results

Tests output detailed results including:

- Total tests executed
- Passed/failed counts
- Success rate percentage
- Execution duration
- Detailed step-by-step progress

## Security Considerations

- Tests use real testnet networks - ensure you're using testnet addresses
- Private keys should never be committed to version control
- Use separate test wallets for testing
- Verify contract addresses before running tests

## Next Steps

Additional test suites to implement:

- Message approval tests (broadcaster meta-transaction approval)
- Message execution tests (full cross-chain message flow)
- Time delay expiration tests
- Multi-chain routing tests (EIL vs LayerZero)

## License

Part of the Bloxchain Protocol - follows the same licensing terms.

