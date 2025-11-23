# Enterprise Cross-Chain Messaging System

A secure, enterprise-grade cross-chain messaging system that combines **Bloxchain's multi-signature security workflows** with intelligent routing between **EIL native bridges** and **LayerZero v2**.

## 🎯 Overview

This system provides a Proof of Concept (POC) for enterprise cross-chain messaging with the following features:

- **Smart Routing**: Automatically selects optimal bridge (EIL native vs LayerZero) based on message requirements
- **Bloxchain Security**: Multi-signature workflows, time-locked operations, secure ownership
- **Message-Only POC**: Simplified implementation focusing on cross-chain messaging capabilities
- **Requirement-Based Routing**: Routes based on cost, speed, security, and chain support needs
- **Gasless User Experience**: Broadcaster pays routing fees via meta-transactions

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│         EnterpriseCrossChainMessenger                    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Bloxchain Security Layer                  │   │
│  │  - SecureOwnable (multi-sig, time-locks)         │   │
│  │  - StateAbstraction (transaction state machine)   │   │
│  └──────────────┬───────────────────────────────────┘   │
│                 │                                        │
│  ┌──────────────▼──────────────────────────────────┐   │
│  │      Message Request Workflow                    │   │
│  │  1. Owner: sendMessageRequest()                  │   │
│  │  2. Broadcaster: approveMessageWithMetaTx()      │   │
│  │  3. State Machine: executeSendMessage()          │   │
│  └──────────────┬───────────────────────────────────┘   │
│                 │                                        │
│  ┌──────────────▼──────────────────────────────────┐   │
│  │      HybridOrchestrationRouter                   │   │
│  │  - Analyzes MessageRequirements                   │   │
│  │  - Routes to EIL Native or LayerZero             │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Components

- **EnterpriseCrossChainMessenger**: Main messaging contract with Bloxchain security
- **HybridOrchestrationRouter**: Smart router that chooses optimal bridge
- **ChainRegistry**: Maps chain IDs to LayerZero endpoint IDs
- **MessageRequirements**: Routing decision logic
- **MessengerDefinitions**: Bloxchain function schemas and permissions

## 📋 Prerequisites

- Node.js >= 18
- npm or yarn
- Hardhat
- Access to blockchain networks (Sepolia, Arbitrum, Optimism, etc.)

## 🚀 Installation

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm test
```

## 🔧 Configuration

Create a `.env` file in the root directory:

```env
# Network RPC URLs
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
OPTIMISM_RPC_URL=https://mainnet.optimism.io

# Private Key (for deployment)
PRIVATE_KEY=your_private_key_here

# LayerZero Configuration
LAYERZERO_ENDPOINT=0x... # LayerZero endpoint address
LAYERZERO_DELEGATE=0x... # Delegate address

# Optional: Initial addresses
INITIAL_OWNER=0x...
INITIAL_BROADCASTER=0x...
INITIAL_RECOVERY=0x...

# Etherscan API Keys (for verification)
ETHERSCAN_API_KEY=your_key
ARBISCAN_API_KEY=your_key
OPTIMISTIC_ETHERSCAN_API_KEY=your_key
```

## 📦 Deployment

### Step 1: Deploy Contracts

```bash
# Deploy to Sepolia
npx hardhat run scripts/deploy.js --network sepolia

# Deploy to Arbitrum
npx hardhat run scripts/deploy.js --network arbitrum

# Deploy to Optimism
npx hardhat run scripts/deploy.js --network optimism
```

This will deploy:
- `ChainRegistry`
- `HybridOrchestrationRouter`
- `EnterpriseCrossChainMessenger` (upgradeable proxy)

Deployment addresses are saved to `deployments/{network}-{chainId}.json`

### Step 2: Initialize Contracts

```bash
# Initialize on Sepolia
npx hardhat run scripts/initialize.js --network sepolia

# Initialize on Arbitrum
npx hardhat run scripts/initialize.js --network arbitrum
```

This will:
- Initialize `EnterpriseCrossChainMessenger` with owner, broadcaster, and recovery addresses
- Set message receiver in router
- Register common chains in `ChainRegistry`

### Step 3: Configure Cross-Chain Peers

For LayerZero routing, you need to set peer addresses on each chain:

```javascript
// On Chain A
const routerA = await ethers.getContractAt("HybridOrchestrationRouter", routerAddressA);
await routerA.setPeer(chainBEndpointId, routerAddressB);

// On Chain B
const routerB = await ethers.getContractAt("HybridOrchestrationRouter", routerAddressB);
await routerB.setPeer(chainAEndpointId, routerAddressA);
```

## 💻 Usage

### Sending a Message

```javascript
const messenger = await ethers.getContractAt(
    "EnterpriseCrossChainMessenger",
    messengerAddress
);

// 1. Owner requests message (no ETH needed)
const payload = ethers.toUtf8Bytes("Hello from Chain A!");
const requirements = {
    requiresFastFinality: false,
    requiresGuaranteedDelivery: false,
    isCostSensitive: true,
    isMultiChain: false,
    maxDelay: 7 * 24 * 60 * 60, // 7 days
    amount: 0,
    requiresNativeSecurity: false,
    requiresDisputeResolution: false,
    securityLevel: 0 // LOW
};

const tx = await messenger.sendMessageRequest(
    targetChainId,
    payload,
    requirements
);
const receipt = await tx.wait();

// 2. Owner signs meta-transaction off-chain
// (Implementation depends on your meta-transaction signing library)

// 3. Broadcaster approves with ETH (pays routing fees)
const metaTx = { /* ... */ }; // Constructed from owner's signature
const routingFee = ethers.parseEther("0.001"); // Estimate fee
await messenger.connect(broadcaster).approveMessageWithMetaTx(
    metaTx,
    { value: routingFee }
);

// 4. State machine automatically executes message sending
```

### Receiving a Message

Messages are automatically received via `handleIncomingMessage()` when they arrive from the router.

### Processing a Message

```javascript
// Process a delivered message
const result = await messenger.processMessage(
    messageId,
    targetContract, // Optional: address(0) if no execution needed
    callData        // Optional: empty if no execution needed
);
```

### Viewing Messages

```javascript
// Only owner on destination chain can view
const message = await messenger.connect(owner).getMessage(messageId);
console.log("Message:", message);
```

## 🔐 Security Features

### Bloxchain Integration

- **Time-Locked Operations**: All message sends require a 5-minute time delay
- **Multi-Signature Support**: Owner signs, broadcaster executes
- **Meta-Transactions**: Gasless user experience
- **Access Control**: Only owner can request/cancel, only broadcaster can approve

### Message Privacy

- Messages are stored in a `private` mapping
- Only the owner on the destination chain can view messages
- Messages can only be viewed on the destination chain

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test file
npx hardhat test test/EnterpriseCrossChainMessenger.test.js

# Run with gas reporting
REPORT_GAS=true npm test
```

## 📚 Documentation

Comprehensive documentation is available in the `docs/` folder:

- [EnterpriseCrossChainMessenger.md](./docs/ENTERPRISE_CROSS_CHAIN_MESSENGER.md) - Main messenger contract
- [HybridOrchestrationRouter.md](./docs/HYBRID_ORCHESTRATION_ROUTER.md) - Router documentation
- [MessageRequirements.md](./docs/MESSAGE_REQUIREMENTS.md) - Routing logic
- [ChainRegistry.md](./docs/CHAIN_REGISTRY.md) - Chain registry
- [MessengerDefinitions.md](./docs/MESSENGER_DEFINITIONS.md) - Bloxchain definitions
- [Interfaces.md](./docs/INTERFACES.md) - Protocol interfaces

## 🔄 Routing Logic

The system automatically chooses between EIL native bridges and LayerZero based on:

1. **Security Requirements** (Highest Priority)
   - `requiresNativeSecurity` → EIL Native
   - `requiresDisputeResolution` → EIL Native
   - `securityLevel == CRITICAL` → EIL Native

2. **Speed Requirements**
   - `requiresFastFinality` → LayerZero
   - `requiresGuaranteedDelivery` → LayerZero

3. **Operational Requirements**
   - `isMultiChain` → LayerZero
   - `isCostSensitive + can wait` → EIL Native

4. **Chain Support**
   - Chain not supported by native bridge → LayerZero

See [MESSAGE_REQUIREMENTS.md](./docs/MESSAGE_REQUIREMENTS.md) for detailed routing logic.

## 🛠️ Development

### Project Structure

```
blockchain/
├── contracts/
│   ├── EnterpriseCrossChainMessenger.sol
│   ├── HybridOrchestrationRouter.sol
│   ├── interfaces/
│   │   ├── IEILIntegration.sol
│   │   └── ILayerZeroIntegration.sol
│   └── utils/
│       ├── ChainRegistry.sol
│       ├── MessageRequirements.sol
│       └── MessengerDefinitions.sol
├── scripts/
│   ├── deploy.js
│   └── initialize.js
├── test/
│   ├── EnterpriseCrossChainMessenger.test.js
│   └── HybridOrchestrationRouter.test.js
├── docs/
│   └── ... (documentation files)
└── hardhat.config.js
```

### Compiling

```bash
# Compile contracts
npm run compile

# Clean artifacts
npm run clean
```

### Verifying Contracts

```bash
# Verify on Etherscan
npx hardhat verify --network sepolia CONTRACT_ADDRESS "CONSTRUCTOR_ARGS"
```

## ⚠️ Important Notes

1. **Time Lock Period**: Hardcoded to 5 minutes (300 seconds) for POC
2. **Event Forwarder**: Disabled (address(0)) for POC
3. **Message Privacy**: Messages are private, only viewable by destination chain owner
4. **Fee Payment**: Broadcaster pays routing fees when approving messages
5. **Upgradeability**: Messenger uses UUPS proxy pattern

## 🤝 Contributing

This is a POC for hackathon demonstration. For production use, consider:

- Comprehensive test coverage
- Security audit
- Gas optimization
- Error handling improvements
- Additional access control mechanisms

## 📄 License

MPL-2.0

## 👥 Authors

Particle Crypto Security

## 🔗 Links

- [Bloxchain Protocol](../../../../contracts/)
- [LayerZero Documentation](https://docs.layerzero.network/)
- [EIL Documentation](https://eil.xyz/)

---

**Note**: This is a Proof of Concept for hackathon demonstration. Not intended for production use without additional security audits and testing.
