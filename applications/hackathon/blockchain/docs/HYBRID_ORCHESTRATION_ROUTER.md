# HybridOrchestrationRouter Documentation

## Overview

The `HybridOrchestrationRouter` is a smart routing contract that automatically chooses between EIL native bridges and LayerZero v2 based on message requirements. It optimizes for cost, speed, security, and chain support to select the best routing path for each cross-chain message.

## Purpose

**Why HybridOrchestrationRouter?**

- **Intelligent Routing** - Automatically selects optimal bridge based on requirements
- **Cost Optimization** - Uses cheaper native bridges when speed isn't critical
- **Speed Optimization** - Uses LayerZero for time-sensitive operations
- **Universal Support** - Falls back to LayerZero for unsupported chains
- **Security-Aware** - Prioritizes native security when required

## Key Features

✅ **Automatic Routing** - Chooses best bridge based on message requirements  
✅ **Dual Bridge Support** - EIL native bridges + LayerZero v2  
✅ **Requirement-Based** - Routes based on cost, speed, security needs  
✅ **Chain Registry Integration** - Uses ChainRegistry for LayerZero endpoint lookups  
✅ **Native Bridge Management** - Register/unregister native bridge connectors  

## Architecture

```
┌─────────────────────────────────────────────┐
│     HybridOrchestrationRouter                │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │  Message Requirements Analysis        │   │
│  └──────────────┬───────────────────────┘   │
│                 │                            │
│        ┌────────┴────────┐                   │
│        │                 │                   │
│   ┌────▼────┐      ┌─────▼─────┐            │
│   │  EIL    │      │ LayerZero  │            │
│   │ Native  │      │    v2      │            │
│   │ Bridge  │      │            │            │
│   └─────────┘      └────────────┘           │
└──────────────────────────────────────────────┘
```

### Components

- **ChainRegistry** - Maps chain IDs to LayerZero endpoint IDs
- **Native Bridge Connectors** - L1 and L2 bridge addresses per chain
- **Message Requirements** - Analyzes routing requirements
- **LayerZero OApp** - Inherits OApp for LayerZero messaging

## Routing Logic

The router uses `MessageRequirements.shouldUseNativeBridge()` to decide:

### Priority Order:

1. **Security Requirements** (Highest Priority)
   - `requiresNativeSecurity` → EIL Native (if available & delay acceptable)
   - `requiresDisputeResolution` → EIL Native (if available & delay acceptable)
   - `securityLevel == CRITICAL` → EIL Native (if available & delay acceptable)

2. **Speed Requirements**
   - `requiresFastFinality` → LayerZero
   - `requiresGuaranteedDelivery` → LayerZero

3. **Operational Requirements**
   - `isMultiChain` → LayerZero
   - `isCostSensitive + can wait 7 days` → EIL Native

4. **Chain Support**
   - Chain not supported by native bridge → LayerZero

### Decision Flow

```
Is chain supported by native bridge?
├─ No → Use LayerZero
└─ Yes → Check requirements
    ├─ Security critical? → EIL Native (if delay OK)
    ├─ Fast finality needed? → LayerZero
    ├─ Multi-chain? → LayerZero
    ├─ Cost-sensitive + can wait? → EIL Native
    └─ Default → LayerZero
```

## State Variables

### Registry
- **`chainRegistry`** - ChainRegistry contract for endpoint ID lookups

### Native Bridge Mappings
- **`l1BridgeConnectors`** - Maps chainId → L1 bridge address
- **`l2BridgeConnectors`** - Maps chainId → L2 bridge address
- **`nativeBridgeChains`** - Array of chain IDs with native bridge support

### Constants
- **`LARGE_TRANSFER_THRESHOLD`** - 1,000,000 tokens (for future use)
- **`NATIVE_BRIDGE_DELAY`** - 7 days (typical L2→L1 delay)

## Functions

### Configuration Functions

#### `registerNativeBridge(uint256 chainId, address l1Bridge, address l2Bridge)`

Registers native bridge connectors for a chain. Only callable by owner.

**Parameters:**
- `chainId` - The chain ID
- `l1Bridge` - L1 bridge connector address
- `l2Bridge` - L2 bridge connector address

**Requirements:**
- Only owner can call
- Both bridge addresses must be non-zero

**Events:**
- `NativeBridgeRegistered(uint256 indexed chainId, address l1Bridge, address l2Bridge)`

**Example:**
```solidity
// Register Arbitrum native bridges
router.registerNativeBridge(
    42161,
    0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f, // Arbitrum L1 bridge
    0x0000000000000000000000000000000000000064  // Arbitrum L2 bridge
);
```

#### `unregisterNativeBridge(uint256 chainId)`

Unregisters native bridge for a chain. Only callable by owner.

**Parameters:**
- `chainId` - The chain ID to unregister

**Events:**
- `NativeBridgeUnregistered(uint256 indexed chainId)`

### Routing Functions

#### `routeMessage(uint256 chainId, bytes memory payload, MessageRequirements.Requirements memory req) → bytes32`

Main routing function that automatically selects the best bridge.

**Parameters:**
- `chainId` - Target chain ID
- `payload` - Message payload to send
- `req` - Message requirements (cost, speed, security, etc.)

**Returns:**
- `messageId` - Unique message identifier (bytes32 for native bridge, LayerZero GUID for LayerZero)

**Payable:**
- Yes - Must include LayerZero fees if routing via LayerZero

**Example:**
```solidity
// Cost-sensitive operation (can wait 7 days)
MessageRequirements.Requirements memory req = MessageRequirements.createCostSensitiveRequirements(
    1000 * 1e18,  // amount
    7 days         // maxDelay
);

bytes32 messageId = router.routeMessage{value: 0.01 ether}(
    42161,        // Arbitrum
    payload,
    req
);
// Will route via EIL native bridge
```

```solidity
// Time-sensitive operation
MessageRequirements.Requirements memory req = MessageRequirements.createTimeSensitiveRequirements(
    1000 * 1e18
);

bytes32 guid = router.routeMessage{value: 0.01 ether}(
    137,          // Polygon
    payload,
    req
);
// Will route via LayerZero
```

### Internal Routing Functions

#### `_routeViaNativeBridge(uint256 chainId, bytes memory payload) → bytes32`

Routes message via EIL native bridge.

**Flow:**
1. Gets L1 and L2 bridge connectors
2. Generates unique message ID
3. Encodes envelope: `(app, payload)`
4. Encodes forward call: `forwardFromL2(target, envelope, gasLimit)`
5. Calls L2 bridge: `sendMessageToL1(l1Bridge, forwardCalldata, gasLimit)`

**Events:**
- `MessageRoutedViaNativeBridge(uint256 indexed chainId, bytes32 indexed messageId, bytes payload)`

**Reverts:**
- `MessageRoutingFailed(uint256 chainId, bytes reason)` - If bridge call fails

#### `_routeViaLayerZero(uint256 chainId, bytes memory payload, MessageRequirements.Requirements memory req) → bytes32`

Routes message via LayerZero v2.

**Flow:**
1. Gets endpoint ID from ChainRegistry
2. Builds options based on requirements (executor if guaranteed delivery needed)
3. Gets peer address for destination
4. Quotes messaging fee
5. Sends message via `_lzSend()`

**Events:**
- `MessageRoutedViaLayerZero(uint32 indexed eid, bytes32 indexed guid, bytes payload)`

**Returns:**
- `guid` - LayerZero message GUID

### Helper Functions

#### `_buildExecutorOptions() → bytes memory`

Builds LayerZero options with executor for guaranteed delivery.

**Returns:**
- Encoded options with executor configuration

#### `_buildOptions() → bytes memory`

Builds standard LayerZero options (empty for standard delivery).

#### `getNativeBridgeChains() → uint256[]`

Gets array of all chain IDs with native bridge support.

#### `supportsNativeBridge(uint256 chainId) → bool`

Checks if a chain supports native bridge routing.

**Example:**
```solidity
if (router.supportsNativeBridge(42161)) {
    // Chain supports native bridge
}
```

### LayerZero Receiver

#### `_lzReceive(Origin calldata _origin, bytes32 _guid, bytes calldata _message, address _executor, bytes calldata _extraData)`

Receives messages from LayerZero. Currently passes through to EnterpriseCrossChainManager.

**Note:** In production, you may want to add routing logic here to handle incoming messages.

## Events

### `MessageRoutedViaNativeBridge(uint256 indexed chainId, bytes32 indexed messageId, bytes payload)`

Emitted when message is routed via EIL native bridge.

### `MessageRoutedViaLayerZero(uint32 indexed eid, bytes32 indexed guid, bytes payload)`

Emitted when message is routed via LayerZero.

### `NativeBridgeRegistered(uint256 indexed chainId, address l1Bridge, address l2Bridge)`

Emitted when native bridge is registered.

### `NativeBridgeUnregistered(uint256 indexed chainId)`

Emitted when native bridge is unregistered.

## Errors

### `InvalidChainId(uint256 chainId)`

Thrown when chain ID is invalid or not supported.

### `InvalidBridgeAddress(address bridge)`

Thrown when bridge address is invalid.

### `MessageRoutingFailed(uint256 chainId, bytes reason)`

Thrown when native bridge routing fails.

## Usage Examples

### Example 1: Cost-Sensitive Transfer (Use Native Bridge)

```solidity
// User wants to save money, can wait 7 days
MessageRequirements.Requirements memory req = MessageRequirements.createCostSensitiveRequirements(
    1000000 * 1e18,  // 1M tokens
    7 days            // Can wait
);

bytes32 messageId = router.routeMessage{value: 0}(
    42161,  // Arbitrum
    abi.encode("transfer", recipient, amount),
    req
);
// Routes via EIL native bridge (cheaper)
```

### Example 2: Time-Sensitive Transfer (Use LayerZero)

```solidity
// User needs fast delivery
MessageRequirements.Requirements memory req = MessageRequirements.createTimeSensitiveRequirements(
    1000 * 1e18
);

bytes32 guid = router.routeMessage{value: 0.01 ether}(
    137,  // Polygon
    abi.encode("transfer", recipient, amount),
    req
);
// Routes via LayerZero (faster)
```

### Example 3: Security-Critical Operation

```solidity
// High security requirement
MessageRequirements.Requirements memory req = MessageRequirements.createSecuritySensitiveRequirements(
    10000000 * 1e18,  // 10M tokens
    7 days,            // Can wait for security
    MessageRequirements.SecurityLevel.CRITICAL
);

bytes32 messageId = router.routeMessage{value: 0}(
    42161,  // Arbitrum
    abi.encode("criticalOperation", data),
    req
);
// Routes via EIL native bridge (native security)
```

### Example 4: Multi-Chain Broadcast

```solidity
// Send to multiple chains
MessageRequirements.Requirements memory req = MessageRequirements.createMultiChainRequirements(
    1000 * 1e18
);

uint256[] memory chains = [1, 137, 42161, 10];
for (uint256 i = 0; i < chains.length; i++) {
    router.routeMessage{value: 0.01 ether}(
        chains[i],
        payload,
        req
    );
}
// All route via LayerZero (universal support)
```

### Example 5: Checking Bridge Support

```solidity
function canRouteToChain(uint256 chainId) external view returns (bool) {
    // Check if chain is registered in ChainRegistry (LayerZero support)
    try router.chainRegistry().getEndpointId(chainId) returns (uint32) {
        return true; // LayerZero supported
    } catch {
        // Check native bridge support
        return router.supportsNativeBridge(chainId);
    }
}
```

## Integration with Other Contracts

### ChainRegistry

```solidity
// Router uses ChainRegistry to convert chain IDs to endpoint IDs
uint32 eid = chainRegistry.getEndpointId(chainId);
```

### MessageRequirements

```solidity
// Router uses MessageRequirements to decide routing
if (MessageRequirements.shouldUseNativeBridge(chainId, req, nativeBridgeChains)) {
    // Route via native bridge
} else {
    // Route via LayerZero
}
```

### EnterpriseCrossChainManager

The router receives LayerZero messages and passes them to EnterpriseCrossChainManager for processing.

## Security Considerations

### Access Control

✅ **Owner-Only Functions**: `registerNativeBridge()` and `unregisterNativeBridge()` are protected by `onlyOwner` modifier.

### Native Bridge Security

- ⚠️ **Bridge Address Validation**: Ensure bridge addresses are correct before registration
- ⚠️ **Gas Limits**: Hardcoded gas limits (200000) may need adjustment
- ⚠️ **Message Encoding**: Envelope format must match bridge expectations

### LayerZero Security

- ✅ **Peer Validation**: Uses `_getPeerOrRevert()` to validate destination
- ✅ **Fee Quoting**: Quotes fees before sending
- ✅ **Options Building**: Builds appropriate options based on requirements

### Reentrancy

- ✅ **No State Changes After External Calls**: Follows checks-effects-interactions pattern
- ⚠️ **Native Bridge Calls**: External bridge calls should be reviewed for reentrancy

## Gas Optimization

### Native Bridge Routing

- Uses `call()` instead of delegatecall for bridge interactions
- Hardcoded gas limits reduce gas estimation overhead
- Efficient array management for native bridge chains

### LayerZero Routing

- Uses LayerZero's built-in fee quoting
- Options are built based on requirements (executor only when needed)

## Limitations

1. **Hardcoded Gas Limits**: Native bridge calls use fixed 200000 gas limit
2. **Simplified Options**: LayerZero options building is simplified (production should use OptionsBuilder)
3. **No Message Retry**: Failed messages are not automatically retried
4. **No Fee Estimation**: Native bridge fees are not estimated before routing

## Future Enhancements

- [ ] Dynamic gas limit calculation
- [ ] Native bridge fee estimation
- [ ] Message retry mechanism
- [ ] Advanced LayerZero options building
- [ ] Multi-hop routing support
- [ ] Bridge health monitoring

## Summary

**HybridOrchestrationRouter** = Intelligent router that automatically selects the best bridge (EIL native or LayerZero) based on message requirements

**Key Benefits:**
- ✅ Automatic optimal routing
- ✅ Cost optimization for non-urgent messages
- ✅ Speed optimization for urgent messages
- ✅ Universal chain support via LayerZero
- ✅ Security-aware routing

**Use When:**
- You need automatic bridge selection
- You have varying message requirements (cost vs speed)
- You want to support both native bridges and LayerZero
- You need universal chain support

The router makes cross-chain messaging simpler by handling the complexity of bridge selection automatically.

