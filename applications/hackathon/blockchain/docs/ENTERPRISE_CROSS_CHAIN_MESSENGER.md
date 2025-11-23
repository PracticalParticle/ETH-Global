# EnterpriseCrossChainMessenger Documentation

## Overview

The `EnterpriseCrossChainMessenger` is a secure, enterprise-grade cross-chain messaging system that combines Bloxchain's multi-signature security workflows with intelligent routing between EIL native bridges and LayerZero. It provides a simplified message-only POC (Proof of Concept) that demonstrates smart routing capabilities without the complexity of token transfers.

## Purpose

**Why EnterpriseCrossChainMessenger?**

- **Bloxchain Security Integration** - Multi-signature workflows, time-locked operations, secure ownership
- **Smart Routing** - Automatically selects optimal bridge (EIL native vs LayerZero) based on message requirements
- **Message-Only POC** - Simplified implementation focusing on cross-chain messaging capabilities
- **Requirement-Based Routing** - Routes based on cost, speed, security, and chain support needs
- **Gasless User Experience** - Broadcaster pays routing fees via meta-transactions

## Key Features

✅ **Bloxchain Security** - Time-delayed operations with multi-signature approval  
✅ **Smart Routing** - Automatic selection between EIL native bridges and LayerZero  
✅ **Message Tracking** - Complete message lifecycle tracking (PENDING → DELIVERED → PROCESSED)  
✅ **Bidirectional Messaging** - Send and receive messages across chains  
✅ **Meta-Transaction Support** - Broadcaster pays fees, owner signs off-chain  
✅ **Requirement-Based** - Routes based on MessageRequirements parameters  
✅ **Upgradeable** - Uses OpenZeppelin's Initializable for proxy-based upgrades  

## Architecture

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

- **SecureOwnable** - Bloxchain's secure ownership with multi-signature support
- **StateAbstraction** - Transaction state machine (PENDING → APPROVED → EXECUTED)
- **HybridOrchestrationRouter** - Smart router that chooses optimal bridge
- **ChainRegistry** - Chain ID to LayerZero endpoint ID mapping
- **MessageRequirements** - Routing decision parameters

## State Variables

### Integration Contracts
- **`router`** - HybridOrchestrationRouter instance
- **`chainRegistry`** - ChainRegistry for endpoint lookups

### Message Tracking
- **`messages`** - Mapping of messageId → CrossChainMessage
- **`messageIdToProtocol`** - Mapping of messageId → protocol identifier ("EIL" or "LAYERZERO")
- **`_messageCounter`** - Counter for unique message IDs

### Fee Management
- **`routingFees`** - Mapping of messageKey → fee amount (paid by broadcaster)

## Message Lifecycle

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ PENDING  │ --> │ DELIVERED │ --> │ PROCESSED │     │  FAILED  │
│ (Sent)   │     │ (Received) │     │ (Executed) │     │ (Error)  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

1. **PENDING** - Message sent, waiting for delivery
2. **DELIVERED** - Message received on destination chain
3. **PROCESSED** - Message payload executed on destination
4. **FAILED** - Message delivery failed

## Core Functions

### Message Sending (Bloxchain Workflow)

#### `sendMessageRequest()`
**Access:** `onlyOwner`  
**Payable:** No (broadcaster pays fees)

Creates a time-delayed transaction request to send a cross-chain message.

```solidity
function sendMessageRequest(
    uint256 targetChainId,
    bytes memory payload,
    MessageRequirements.Requirements memory req
) external onlyOwner returns (StateAbstraction.TxRecord memory)
```

**Parameters:**
- `targetChainId` - Destination chain ID
- `payload` - Message payload (arbitrary bytes)
- `req` - Message requirements for routing decision

**Returns:** Transaction record with `txId` for tracking

**Workflow:**
1. Owner calls `sendMessageRequest()` (no ETH needed)
2. Creates time-locked transaction in state machine
3. Waits for broadcaster approval (before time delay expires)

#### `approveMessageWithMetaTx()`
**Access:** `onlyBroadcaster`  
**Payable:** Yes (broadcaster must send ETH for routing fees)

Approves a pending message using a meta-transaction. Broadcaster pays routing fees.

```solidity
function approveMessageWithMetaTx(
    StateAbstraction.MetaTransaction memory metaTx
) external payable onlyBroadcaster returns (StateAbstraction.TxRecord memory)
```

**Requirements:**
- Must be called BEFORE `releaseTime` (time delay expiration)
- Broadcaster must send ETH to cover routing fees
- Owner must have signed the meta-transaction off-chain

**Workflow:**
1. Owner signs meta-transaction off-chain
2. Broadcaster calls `approveMessageWithMetaTx()` with ETH
3. Fee is stored in `routingFees` mapping
4. Transaction is approved in state machine
5. State machine automatically executes `executeSendMessage()`

#### `cancelMessage()`
**Access:** `onlyOwner`

Cancels a pending message request.

```solidity
function cancelMessage(uint256 txId) external onlyOwner returns (StateAbstraction.TxRecord memory)
```

#### `executeSendMessage()`
**Access:** Internal (called by state machine)  
**Payable:** No (uses stored fee from broadcaster)

Executes the actual message sending. Called automatically by the state machine after approval.

```solidity
function executeSendMessage(
    uint256 targetChainId,
    bytes memory payload,
    MessageRequirements.Requirements memory req
) external
```

**Workflow:**
1. State machine calls after approval
2. Retrieves stored routing fee from `routingFees` mapping
3. Calls `_sendMessageWithFee()` to route message
4. Clears stored fee to prevent reuse

### Message Receiving

#### `handleIncomingMessage()`
**Access:** `onlyRouter`

Handles incoming messages from the HybridOrchestrationRouter.

```solidity
function handleIncomingMessage(
    uint256 sourceChainId,
    bytes memory messagePayload
) external
```

**Workflow:**
1. Router calls when message is received (LayerZero or EIL)
2. Decodes message metadata
3. Updates message status to DELIVERED
4. Emits `MessageDelivered` event

#### `processMessage()`
**Access:** Public

Processes a delivered message by executing its payload.

```solidity
function processMessage(
    bytes32 messageId,
    address targetContract,
    bytes memory callData
) external returns (bool success, bytes memory result)
```

**Parameters:**
- `messageId` - Message ID to process
- `targetContract` - Target contract address (optional, can be address(0))
- `callData` - Calldata to execute (optional, can be empty)

**Returns:** Success status and return data

**Workflow:**
1. Verifies message status is DELIVERED
2. If target contract provided, executes call
3. Updates status to PROCESSED
4. Emits `MessageProcessed` event

### View Functions

#### `getMessage()`
**Access:** `onlyOwner`

Retrieves message details (owner-only for security).

```solidity
function getMessage(bytes32 messageId) external view onlyOwner returns (CrossChainMessage memory)
```

#### `getMessageProtocol()`
**Access:** Public

Gets the routing protocol used for a message.

```solidity
function getMessageProtocol(bytes32 messageId) external view returns (bytes32)
```

**Returns:** Protocol identifier ("EIL" or "LAYERZERO")

#### `isEILMessage()` / `isLayerZeroMessage()`
**Access:** Public

Convenience functions to check routing protocol.

## Bloxchain Security Workflow

### Time-Delayed Operations

1. **Request Phase** (Owner)
   - Owner calls `sendMessageRequest()`
   - Creates time-locked transaction
   - Transaction enters PENDING state
   - `releaseTime` = `block.timestamp + timeLockPeriodSec`

2. **Approval Phase** (Broadcaster)
   - Owner signs meta-transaction off-chain
   - Broadcaster calls `approveMessageWithMetaTx()` with ETH
   - Must approve BEFORE `releaseTime` expires
   - After `releaseTime`, approval is no longer possible

3. **Execution Phase** (State Machine)
   - State machine automatically calls `executeSendMessage()`
   - Uses stored routing fee from broadcaster
   - Message is routed via HybridOrchestrationRouter

4. **Cancellation** (Owner)
   - Owner can cancel at any time before execution
   - Calls `cancelMessage(txId)`

### Security Features

- **Time-Locked Operations** - All message sends require time delay
- **Multi-Signature Support** - Owner signs, broadcaster executes
- **Meta-Transactions** - Gasless user experience
- **Access Control** - Only owner can request/cancel, only broadcaster can approve
- **Fee Management** - Broadcaster pays fees, preventing owner from being locked out

## Routing Decision

The messenger uses `MessageRequirements` to determine routing:

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

See [MESSAGE_REQUIREMENTS.md](./MESSAGE_REQUIREMENTS.md) for detailed routing logic.

## Fee Payment Model

### Current Implementation

- **Owner** - Does NOT pay fees (calls `sendMessageRequest()` without ETH)
- **Broadcaster** - Pays routing fees when approving (`approveMessageWithMetaTx()` with ETH)
- **Fee Storage** - Fees stored in `routingFees` mapping, retrieved during execution

### Fee Flow

```
Owner Request (no ETH)
    ↓
Broadcaster Approval (sends ETH)
    ↓
Fee Stored in routingFees mapping
    ↓
State Machine Execution
    ↓
Fee Retrieved and Used for Routing
```

## Events

### `MessageSent`
Emitted when a message is successfully sent.

```solidity
event MessageSent(
    bytes32 indexed messageId,
    uint256 indexed sourceChainId,
    uint256 indexed targetChainId,
    address sender,
    bytes32 routingProtocol,
    MessageRequirements.SecurityLevel securityLevel
);
```

### `MessageDelivered`
Emitted when a message is received on the destination chain.

```solidity
event MessageDelivered(
    bytes32 indexed messageId,
    uint256 indexed targetChainId,
    uint256 deliveredAt
);
```

### `MessageProcessed`
Emitted when a message payload is executed.

```solidity
event MessageProcessed(
    bytes32 indexed messageId,
    uint256 indexed targetChainId,
    bytes result
);
```

### `MessageFailed`
Emitted when message delivery fails.

```solidity
event MessageFailed(
    bytes32 indexed messageId,
    uint256 indexed targetChainId,
    string reason
);
```

## Initialization

### `initialize()`

Initializes the contract with Bloxchain security parameters and integration contracts.

```solidity
function initialize(
    address initialOwner,
    address broadcaster,
    address recovery,
    uint256 timeLockPeriodSec,
    address eventForwarder,
    address _router,
    address _chainRegistry
) public initializer
```

**Parameters:**
- `initialOwner` - Initial owner address (can request/cancel messages)
- `broadcaster` - Broadcaster address (can approve messages)
- `recovery` - Recovery address (for Bloxchain security)
- `timeLockPeriodSec` - Time lock period in seconds
- `eventForwarder` - Event forwarder address
- `_router` - HybridOrchestrationRouter address
- `_chainRegistry` - ChainRegistry address

**Setup:**
1. Initializes `SecureOwnable` with security parameters
2. Sets router and chain registry
3. Loads MessengerDefinitions (function schemas, role permissions)

## Admin Functions

### `setRouter()`
**Access:** `onlyOwner`

Updates the HybridOrchestrationRouter address.

```solidity
function setRouter(address _router) external onlyOwner
```

### `setChainRegistry()`
**Access:** `onlyOwner`

Updates the ChainRegistry address.

```solidity
function setChainRegistry(address _chainRegistry) external onlyOwner
```

## Example Usage

### Example 1: Send Message (Cost-Sensitive)

```solidity
// Owner requests message (no ETH)
MessageRequirements.Requirements memory req = MessageRequirements.Requirements({
    requiresFastFinality: false,
    requiresGuaranteedDelivery: false,
    isCostSensitive: true,
    isMultiChain: false,
    maxDelay: 7 days,
    amount: 0,
    requiresNativeSecurity: false,
    requiresDisputeResolution: false,
    securityLevel: MessageRequirements.SecurityLevel.LOW
});

TxRecord memory txRecord = messenger.sendMessageRequest(
    targetChainId,
    payload,
    req
);

// Owner signs meta-transaction off-chain
// Broadcaster approves with ETH
messenger.approveMessageWithMetaTx{value: routingFee}(metaTx);
// State machine automatically executes
```

### Example 2: Send Message (Time-Sensitive)

```solidity
// Owner requests message
MessageRequirements.Requirements memory req = MessageRequirements.Requirements({
    requiresFastFinality: true,
    requiresGuaranteedDelivery: true,
    isCostSensitive: false,
    isMultiChain: false,
    maxDelay: 1 hours,
    amount: 0,
    requiresNativeSecurity: false,
    requiresDisputeResolution: false,
    securityLevel: MessageRequirements.SecurityLevel.MEDIUM
});

TxRecord memory txRecord = messenger.sendMessageRequest(
    targetChainId,
    payload,
    req
);

// Owner signs meta-transaction off-chain
// Broadcaster approves with ETH (higher fee for LayerZero)
messenger.approveMessageWithMetaTx{value: routingFee}(metaTx);
// State machine automatically executes via LayerZero
```

### Example 3: Receive and Process Message

```solidity
// Message is automatically received via handleIncomingMessage()
// Then process it:

(bool success, bytes memory result) = messenger.processMessage(
    messageId,
    targetContract,
    callData
);
```

## Security Considerations

### Access Control
- **Owner** - Can request messages, cancel messages, view messages
- **Broadcaster** - Can approve messages (with ETH payment)
- **Router** - Can deliver incoming messages
- **Public** - Can process delivered messages

### Time-Lock Security
- Messages cannot be approved after time delay expires
- Owner can cancel at any time before execution
- Prevents rushed approvals and provides security review window

### Fee Security
- Fees are stored in mapping and cleared after use
- Prevents fee reuse attacks
- Broadcaster must provide sufficient ETH

### Message Security
- Messages are tracked by unique IDs
- Idempotency checks prevent duplicate processing
- Source chain verification prevents spoofing

## Integration with Other Contracts

### HybridOrchestrationRouter
- Messenger calls `router.routeMessage()` to send messages
- Router calls `messenger.handleIncomingMessage()` when messages arrive

### ChainRegistry
- Messenger uses `chainRegistry.isChainRegistered()` to validate chains
- Router uses ChainRegistry for LayerZero endpoint lookups

### MessageRequirements
- Messenger uses `MessageRequirements.shouldUseNativeBridge()` for routing decisions
- Requirements are passed through to router

## Summary

| Feature | Description |
|---------|-------------|
| **Security** | Bloxchain multi-signature workflows, time-locked operations |
| **Routing** | Automatic selection between EIL native bridges and LayerZero |
| **Fee Model** | Broadcaster pays routing fees via meta-transactions |
| **Message Tracking** | Complete lifecycle tracking (PENDING → DELIVERED → PROCESSED) |
| **Access Control** | Owner requests/cancels, Broadcaster approves, Router delivers |
| **Upgradeable** | OpenZeppelin Initializable for proxy-based upgrades |

The `EnterpriseCrossChainMessenger` provides a secure, enterprise-grade foundation for cross-chain messaging with intelligent routing and Bloxchain security integration.

