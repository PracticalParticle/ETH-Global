# MessengerDefinitions Documentation

## Overview

The `MessengerDefinitions` library is a static definitions library that contains all configuration data for the `EnterpriseCrossChainMessenger` contract. It decouples static configuration from the main contract, reducing contract size and improving modularity.

## Purpose

**Why MessengerDefinitions?**

- **Contract Size Reduction** - Moves static data to a library, reducing main contract size
- **Modularity** - Separates configuration from implementation
- **Reusability** - Definitions can be used across multiple messenger instances
- **Maintainability** - Centralized location for all function schemas and permissions
- **Gas Optimization** - Library code is deployed once and reused

## Key Features

✅ **Operation Type Constants** - Predefined operation type identifiers  
✅ **Function Selector Constants** - Function selectors for all messenger functions  
✅ **Function Schemas** - Complete schema definitions for state machine  
✅ **Role Permissions** - Role-based access control definitions  
✅ **Static Data** - All data is `pure` functions, no storage  

## Architecture

```
┌─────────────────────────────────────────┐
│      EnterpriseCrossChainMessenger      │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │   MessengerDefinitions Library    │  │
│  │  - getFunctionSchemas()           │  │
│  │  - getRolePermissions()           │  │
│  │  - Operation Type Constants       │  │
│  │  - Function Selector Constants    │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

The library is called during contract initialization to load definitions into the state machine.

## Operation Types

### Constants

```solidity
bytes32 public constant SEND_MESSAGE = keccak256("SEND_MESSAGE");
bytes32 public constant CANCEL_MESSAGE = keccak256("CANCEL_MESSAGE");
bytes32 public constant META_APPROVE_MESSAGE = keccak256("META_APPROVE_MESSAGE");
```

**Purpose:** Identifiers for different types of operations in the state machine.

- **SEND_MESSAGE** - Operation type for sending cross-chain messages
- **CANCEL_MESSAGE** - Operation type for canceling pending messages
- **META_APPROVE_MESSAGE** - Operation type for meta-transaction approvals

## Function Selectors

### Execution Function Selector

```solidity
bytes4 public constant SEND_MESSAGE_SELECTOR = bytes4(
    keccak256("executeSendMessage(uint256,bytes,(bool,bool,bool,bool,uint256,uint256,bool,bool,uint8))")
);
```

**Purpose:** Selector for the execution function called by the state machine after approval.

### Time-Delay Function Selectors

```solidity
bytes4 public constant SEND_MESSAGE_REQUEST_SELECTOR = bytes4(
    keccak256("sendMessageRequest(uint256,bytes,(bool,bool,bool,bool,uint256,uint256,bool,bool,uint8))")
);

bytes4 public constant CANCEL_MESSAGE_SELECTOR = bytes4(
    keccak256("cancelMessage(uint256)")
);
```

**Purpose:** Selectors for time-delayed operations (request and cancel).

### Meta-Transaction Function Selector

```solidity
bytes4 public constant APPROVE_MESSAGE_META_SELECTOR = bytes4(
    keccak256("approveMessageWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes32,bytes,(address,uint256,address,uint256),(uint256,uint256,address,bytes4,uint256,uint256,address),bytes,bytes))")
);
```

**Purpose:** Selector for meta-transaction approval function.

## Function Schemas

### `getFunctionSchemas()`

Returns an array of `FunctionSchema` definitions that describe how each function interacts with the state machine.

```solidity
function getFunctionSchemas() public pure returns (StateAbstraction.FunctionSchema[] memory)
```

**Returns:** Array of 3 function schemas:

1. **sendMessageRequest** - Time-delay request function
   - Operation Type: `SEND_MESSAGE`
   - Supported Actions: `EXECUTE_TIME_DELAY_REQUEST`
   - Protected: `true`

2. **cancelMessage** - Time-delay cancel function
   - Operation Type: `CANCEL_MESSAGE`
   - Supported Actions: `EXECUTE_TIME_DELAY_CANCEL`
   - Protected: `true`

3. **approveMessageWithMetaTx** - Meta-transaction approval function
   - Operation Type: `META_APPROVE_MESSAGE`
   - Supported Actions: `SIGN_META_APPROVE`, `EXECUTE_META_APPROVE`
   - Protected: `true`

### Schema Structure

Each schema contains:
- **functionName** - Human-readable function name
- **functionSelector** - Function selector (bytes4)
- **operationType** - Operation type identifier (bytes32)
- **operationName** - Human-readable operation name
- **supportedActionsBitmap** - Bitmap of supported TxActions
- **isProtected** - Whether the function is protected from removal

## Role Permissions

### `getRolePermissions()`

Returns role hashes and their corresponding function permissions for access control.

```solidity
function getRolePermissions() public pure returns (IDefinition.RolePermission memory)
```

**Returns:** `RolePermission` struct containing:
- **roleHashes** - Array of role identifiers
- **functionPermissions** - Array of function permissions per role

### Permission Matrix

| Role | Function | Action | Purpose |
|------|----------|--------|---------|
| **OWNER** | `sendMessageRequest` | `EXECUTE_TIME_DELAY_REQUEST` | Request to send message |
| **OWNER** | `cancelMessage` | `EXECUTE_TIME_DELAY_CANCEL` | Cancel pending message |
| **OWNER** | `approveMessageWithMetaTx` | `SIGN_META_APPROVE` | Sign meta-transaction (off-chain) |
| **BROADCASTER** | `approveMessageWithMetaTx` | `EXECUTE_META_APPROVE` | Execute meta-transaction (on-chain) |

### Role Definitions

#### OWNER_ROLE
- **Purpose:** Owner of the messenger contract
- **Permissions:**
  - Can request messages (`sendMessageRequest`)
  - Can cancel messages (`cancelMessage`)
  - Can sign meta-transactions (off-chain)

#### BROADCASTER_ROLE
- **Purpose:** Broadcaster who executes meta-transactions
- **Permissions:**
  - Can execute meta-transaction approvals (`approveMessageWithMetaTx`)
  - Pays routing fees when approving

## Usage in EnterpriseCrossChainMessenger

### Initialization

During contract initialization, definitions are loaded:

```solidity
function initialize(...) public initializer {
    // ... other initialization ...
    
    // Load Messenger-specific definitions
    IDefinition.RolePermission memory permissions = 
        MessengerDefinitions.getRolePermissions();
    _loadDefinitions(
        MessengerDefinitions.getFunctionSchemas(),
        permissions.roleHashes,
        permissions.functionPermissions
    );
}
```

### How It Works

1. **Contract Initialization**
   - `initialize()` calls `getFunctionSchemas()` and `getRolePermissions()`
   - Definitions are loaded into the state machine via `_loadDefinitions()`

2. **State Machine Integration**
   - Function schemas define which actions each function supports
   - Role permissions define which roles can perform which actions
   - State machine enforces these permissions

3. **Runtime Enforcement**
   - When functions are called, state machine checks permissions
   - Only authorized roles can perform specific actions
   - Protected functions cannot be removed

## Function Schema Details

### sendMessageRequest Schema

```solidity
FunctionSchema({
    functionName: "sendMessageRequest",
    functionSelector: SEND_MESSAGE_REQUEST_SELECTOR,
    operationType: SEND_MESSAGE,
    operationName: "SEND_MESSAGE",
    supportedActionsBitmap: createBitmapFromActions([EXECUTE_TIME_DELAY_REQUEST]),
    isProtected: true
})
```

**Supported Actions:**
- `EXECUTE_TIME_DELAY_REQUEST` - Owner can request time-delayed message send

### cancelMessage Schema

```solidity
FunctionSchema({
    functionName: "cancelMessage",
    functionSelector: CANCEL_MESSAGE_SELECTOR,
    operationType: CANCEL_MESSAGE,
    operationName: "CANCEL_MESSAGE",
    supportedActionsBitmap: createBitmapFromActions([EXECUTE_TIME_DELAY_CANCEL]),
    isProtected: true
})
```

**Supported Actions:**
- `EXECUTE_TIME_DELAY_CANCEL` - Owner can cancel pending message

### approveMessageWithMetaTx Schema

```solidity
FunctionSchema({
    functionName: "approveMessageWithMetaTx",
    functionSelector: APPROVE_MESSAGE_META_SELECTOR,
    operationType: META_APPROVE_MESSAGE,
    operationName: "META_APPROVE_MESSAGE",
    supportedActionsBitmap: createBitmapFromActions([
        SIGN_META_APPROVE,
        EXECUTE_META_APPROVE
    ]),
    isProtected: true
})
```

**Supported Actions:**
- `SIGN_META_APPROVE` - Owner can sign meta-transaction (off-chain)
- `EXECUTE_META_APPROVE` - Broadcaster can execute meta-transaction (on-chain)

## Role Permission Details

### Owner Permissions

#### Permission 1: sendMessageRequest
```solidity
roleHashes[0] = OWNER_ROLE;
functionPermissions[0] = FunctionPermission({
    functionSelector: SEND_MESSAGE_REQUEST_SELECTOR,
    grantedActionsBitmap: createBitmapFromActions([EXECUTE_TIME_DELAY_REQUEST])
});
```

#### Permission 2: cancelMessage
```solidity
roleHashes[1] = OWNER_ROLE;
functionPermissions[1] = FunctionPermission({
    functionSelector: CANCEL_MESSAGE_SELECTOR,
    grantedActionsBitmap: createBitmapFromActions([EXECUTE_TIME_DELAY_CANCEL])
});
```

#### Permission 3: approveMessageWithMetaTx (Signer)
```solidity
roleHashes[2] = OWNER_ROLE;
functionPermissions[2] = FunctionPermission({
    functionSelector: APPROVE_MESSAGE_META_SELECTOR,
    grantedActionsBitmap: createBitmapFromActions([SIGN_META_APPROVE])
});
```

### Broadcaster Permissions

#### Permission 4: approveMessageWithMetaTx (Executor)
```solidity
roleHashes[3] = BROADCASTER_ROLE;
functionPermissions[3] = FunctionPermission({
    functionSelector: APPROVE_MESSAGE_META_SELECTOR,
    grantedActionsBitmap: createBitmapFromActions([EXECUTE_META_APPROVE])
});
```

## Design Patterns

### Library Pattern

The library pattern is used to:
- Reduce contract size (library code is deployed once)
- Separate configuration from implementation
- Enable code reuse across multiple contracts

### Static Data Pattern

All data is provided via `pure` functions:
- No storage variables
- No state changes
- Gas-efficient (no storage reads)
- Deterministic (same input = same output)

### Definition Loading Pattern

Definitions are loaded during initialization:
- Contract calls library functions
- Definitions are stored in state machine
- Runtime enforcement uses loaded definitions

## Security Considerations

### Protected Functions

All function schemas have `isProtected: true`, meaning:
- Functions cannot be removed from the state machine
- Prevents accidental or malicious removal
- Ensures contract integrity

### Role Separation

- **Owner** - Signs meta-transactions (off-chain)
- **Broadcaster** - Executes meta-transactions (on-chain)
- Prevents single point of failure
- Enables gasless user experience

### Selector Validation

Function selectors are computed at compile time:
- Prevents selector collisions
- Ensures correct function identification
- Validates function signatures

## Integration Points

### StateAbstraction

The library uses types from `StateAbstraction`:
- `FunctionSchema` - Function schema structure
- `FunctionPermission` - Permission structure
- `TxAction` - Transaction action enums
- `createBitmapFromActions()` - Bitmap creation utility

### IDefinition

The library implements `IDefinition` interface:
- `RolePermission` - Role permission structure
- Standard interface for definition libraries

### SecureOwnable

Definitions are loaded into `SecureOwnable`'s state machine:
- `_loadDefinitions()` - Loads schemas and permissions
- State machine enforces permissions at runtime

## Example Usage

### Getting Function Schemas

```solidity
StateAbstraction.FunctionSchema[] memory schemas = 
    MessengerDefinitions.getFunctionSchemas();

// schemas[0] = sendMessageRequest schema
// schemas[1] = cancelMessage schema
// schemas[2] = approveMessageWithMetaTx schema
```

### Getting Role Permissions

```solidity
IDefinition.RolePermission memory permissions = 
    MessengerDefinitions.getRolePermissions();

// permissions.roleHashes[0] = OWNER_ROLE
// permissions.roleHashes[1] = OWNER_ROLE
// permissions.roleHashes[2] = OWNER_ROLE
// permissions.roleHashes[3] = BROADCASTER_ROLE

// permissions.functionPermissions[0] = Owner can request messages
// permissions.functionPermissions[1] = Owner can cancel messages
// permissions.functionPermissions[2] = Owner can sign meta-txs
// permissions.functionPermissions[3] = Broadcaster can execute meta-txs
```

### Using Constants

```solidity
// Check operation type
if (txRecord.params.operationType == MessengerDefinitions.SEND_MESSAGE) {
    // Handle send message operation
}

// Check function selector
if (selector == MessengerDefinitions.SEND_MESSAGE_SELECTOR) {
    // Handle send message execution
}
```

## Summary

| Component | Purpose | Type |
|-----------|---------|------|
| **Operation Types** | Identify operation types | `bytes32` constants |
| **Function Selectors** | Identify functions | `bytes4` constants |
| **Function Schemas** | Define function behavior | `FunctionSchema[]` |
| **Role Permissions** | Define access control | `RolePermission` struct |

The `MessengerDefinitions` library provides a centralized, modular way to configure the `EnterpriseCrossChainMessenger` contract, reducing contract size and improving maintainability while enabling the Bloxchain security workflow.

