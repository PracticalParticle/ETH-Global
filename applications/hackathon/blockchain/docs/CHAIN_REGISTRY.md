# ChainRegistry Documentation

## Overview

The `ChainRegistry` contract provides a centralized registry for mapping Ethereum chain IDs to LayerZero endpoint IDs (EIDs). This mapping is essential for cross-chain operations that need to convert between the two different chain identification systems.

## Purpose

**Why ChainRegistry?**

- **Dual Identification Systems**: Ethereum uses chain IDs (uint256), while LayerZero uses endpoint IDs (uint32). The registry bridges this gap.
- **Centralized Mapping**: Provides a single source of truth for chain-to-endpoint conversions.
- **Dynamic Registration**: Allows adding new chains without contract redeployment.
- **Bidirectional Lookup**: Supports both chain ID → EID and EID → chain ID lookups.

## Key Features

✅ **Bidirectional Mapping** - Convert chain IDs to EIDs and vice versa  
✅ **Dynamic Registration** - Register/unregister chains on the fly  
✅ **Validation** - Prevents duplicate registrations and invalid mappings  
✅ **Query Support** - Check if chains are registered and get all registered chains  

## Architecture

```
┌─────────────────────────────────────┐
│      ChainRegistry                  │
│                                     │
│  chainIdToEid: mapping(uint256→uint32)│
│  eidToChainId: mapping(uint32→uint256)│
│  registeredChains: uint256[]        │
└─────────────────────────────────────┘
```

### State Variables

- **`chainIdToEid`** - Maps chain ID → LayerZero endpoint ID
- **`eidToChainId`** - Maps LayerZero endpoint ID → chain ID  
- **`registeredChains`** - Array of all registered chain IDs

## Functions

### Registration Functions

#### `registerChain(uint256 chainId, uint32 eid)`

Registers a new chain ID to endpoint ID mapping.

**Parameters:**
- `chainId` - The Ethereum chain ID
- `eid` - The LayerZero endpoint ID

**Requirements:**
- Chain ID must not already be registered
- Endpoint ID must not already be registered

**Events:**
- `ChainRegistered(uint256 indexed chainId, uint32 indexed eid)`

**Example:**
```solidity
// Register Ethereum Mainnet (chainId: 1, eid: 30101)
chainRegistry.registerChain(1, 30101);

// Register Arbitrum One (chainId: 42161, eid: 30110)
chainRegistry.registerChain(42161, 30110);
```

#### `unregisterChain(uint256 chainId)`

Unregisters a chain and removes it from the registry.

**Parameters:**
- `chainId` - The chain ID to unregister

**Requirements:**
- Chain must be registered

**Events:**
- `ChainUnregistered(uint256 indexed chainId, uint32 indexed eid)`

**Example:**
```solidity
// Unregister a chain
chainRegistry.unregisterChain(42161);
```

### Query Functions

#### `getEndpointId(uint256 chainId) → uint32`

Gets the LayerZero endpoint ID for a given chain ID.

**Parameters:**
- `chainId` - The chain ID to look up

**Returns:**
- `eid` - The LayerZero endpoint ID

**Reverts:**
- `ChainNotRegistered(uint256 chainId)` - If chain is not registered

**Example:**
```solidity
uint32 eid = chainRegistry.getEndpointId(1); // Returns 30101 for Ethereum Mainnet
```

#### `getChainId(uint32 eid) → uint256`

Gets the chain ID for a given LayerZero endpoint ID.

**Parameters:**
- `eid` - The LayerZero endpoint ID to look up

**Returns:**
- `chainId` - The Ethereum chain ID

**Reverts:**
- `InvalidEndpointId(uint32 eid)` - If endpoint ID is not registered

**Example:**
```solidity
uint256 chainId = chainRegistry.getChainId(30101); // Returns 1 for Ethereum Mainnet
```

#### `isChainRegistered(uint256 chainId) → bool`

Checks if a chain ID is registered in the registry.

**Parameters:**
- `chainId` - The chain ID to check

**Returns:**
- `true` if registered, `false` otherwise

**Example:**
```solidity
bool isRegistered = chainRegistry.isChainRegistered(1); // Returns true if registered
```

#### `getAllRegisteredChains() → uint256[]`

Gets an array of all registered chain IDs.

**Returns:**
- Array of all registered chain IDs

**Example:**
```solidity
uint256[] memory chains = chainRegistry.getAllRegisteredChains();
// Returns [1, 42161, 10, ...] - all registered chain IDs
```

## Errors

### `ChainNotRegistered(uint256 chainId)`

Thrown when attempting to get an endpoint ID for an unregistered chain.

### `InvalidEndpointId(uint32 eid)`

Thrown when attempting to get a chain ID for an unregistered endpoint ID.

### `ChainAlreadyRegistered(uint256 chainId)`

Thrown when attempting to register a chain that is already registered.

## Events

### `ChainRegistered(uint256 indexed chainId, uint32 indexed eid)`

Emitted when a new chain is registered.

### `ChainUnregistered(uint256 indexed chainId, uint32 indexed eid)`

Emitted when a chain is unregistered.

## Usage Examples

### Example 1: Registering Multiple Chains

```solidity
// Register common chains
chainRegistry.registerChain(1, 30101);        // Ethereum Mainnet
chainRegistry.registerChain(42161, 30110);    // Arbitrum One
chainRegistry.registerChain(10, 30111);       // Optimism
chainRegistry.registerChain(137, 30109);      // Polygon
```

### Example 2: Chain ID to EID Conversion

```solidity
// Convert chain ID to LayerZero endpoint ID
uint256 targetChainId = 42161; // Arbitrum
uint32 eid = chainRegistry.getEndpointId(targetChainId);
// Use eid for LayerZero operations
```

### Example 3: Checking Chain Support

```solidity
function canSendToChain(uint256 chainId) external view returns (bool) {
    return chainRegistry.isChainRegistered(chainId);
}
```

### Example 4: Iterating Over All Chains

```solidity
uint256[] memory chains = chainRegistry.getAllRegisteredChains();
for (uint256 i = 0; i < chains.length; i++) {
    uint32 eid = chainRegistry.getEndpointId(chains[i]);
    // Process each chain...
}
```

## Integration with HybridOrchestrationRouter

The `ChainRegistry` is used by `HybridOrchestrationRouter` to convert chain IDs to endpoint IDs when routing messages via LayerZero:

```solidity
// In HybridOrchestrationRouter._routeViaLayerZero()
uint32 eid = chainRegistry.getEndpointId(chainId);
// Now use eid for LayerZero messaging
```

## Security Considerations

### Access Control

⚠️ **Current Implementation**: The contract has no access control on `registerChain()` and `unregisterChain()`. In production, these should be restricted to authorized administrators.

**Recommended:**
```solidity
modifier onlyOwner() {
    require(msg.sender == owner, "Not authorized");
    _;
}

function registerChain(uint256 chainId, uint32 eid) external onlyOwner {
    // ...
}
```

### Validation

- ✅ Prevents duplicate chain ID registrations
- ✅ Prevents duplicate endpoint ID registrations
- ✅ Validates chain exists before unregistering

### Edge Cases

- **Zero Values**: Chain ID 0 and EID 0 are treated as "not registered" (used in checks)
- **Array Management**: Unregistering removes from array efficiently (O(1) by swapping with last element)

## Common LayerZero Endpoint IDs

| Chain | Chain ID | Endpoint ID (EID) |
|-------|----------|-------------------|
| Ethereum Mainnet | 1 | 30101 |
| Arbitrum One | 42161 | 30110 |
| Optimism | 10 | 30111 |
| Polygon | 137 | 30109 |
| BSC | 56 | 30102 |
| Avalanche | 43114 | 30106 |

*Note: These are examples. Actual endpoint IDs may vary by LayerZero deployment.*

## Summary

**ChainRegistry** = Centralized mapping between Ethereum chain IDs and LayerZero endpoint IDs

**Key Use Cases:**
- Converting chain IDs to endpoint IDs for LayerZero operations
- Validating chain support before routing
- Maintaining a registry of supported chains
- Enabling bidirectional chain identification lookups

The registry is a critical component for any system that needs to work with both Ethereum's chain ID system and LayerZero's endpoint ID system.

