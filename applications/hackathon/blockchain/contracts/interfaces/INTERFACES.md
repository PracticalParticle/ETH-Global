# Interface Documentation

## Overview

This document explains the two main interfaces used for integrating EIL and LayerZero protocols.

## IEILIntegration

**Purpose:** Interface for interacting with EIL (Ethereum Interoperability Layer) contracts.

**Based On:** EIL's `OriginSwapManager` and `DestinationSwapManager` contracts.

### Key Types

- **AtomicSwapVoucherRequest** - Request for an atomic swap
- **AtomicSwapVoucher** - Voucher signed by XLP (Cross-chain Liquidity Provider)
- **SourceSwapComponent** - Origin chain swap details
- **DestinationSwapComponent** - Destination chain swap details
- **Asset** - Token address and amount

### Key Functions

**Origin Chain:**
- `lockUserDeposit()` - Lock user funds and create voucher request
- `withdrawFromUserDeposit()` - Withdraw funds after voucher redemption
- `cancelVoucherRequest()` - Cancel a swap request

**Destination Chain:**
- `withdrawFromVoucher()` - Redeem voucher and receive tokens

### What It Does

Handles atomic cross-chain token swaps using EIL's voucher system. Users lock funds on origin chain, XLPs issue vouchers, and users redeem vouchers on destination chain.

---

## ILayerZeroIntegration

**Purpose:** Interface for LayerZero v2 cross-chain messaging.

**Based On:** LayerZero's `ILayerZeroEndpointV2` contract.

### Key Types

- **MessagingParams** - Message parameters (destination, receiver, payload, options)
- **MessagingFee** - Native and LZ token fees
- **MessagingReceipt** - Receipt with GUID and nonce
- **Origin** - Message origin (source chain, sender, nonce)

### Key Functions

- `quote()` - Get messaging fee estimate
- `send()` - Send cross-chain message
- `verify()` - Verify message authenticity
- `lzReceive()` - Receive cross-chain message

### What It Does

Sends arbitrary messages between chains. LayerZero handles verification and delivery. Messages are just bytes - you define what they contain.

---

## How They Work Together

```
┌─────────────────────────────────────┐
│  IEILIntegration                    │
│  ✅ Handles token transfers         │
│  ✅ Atomic swap execution           │
└──────────────┬──────────────────────┘
               │
               │ Coordination
               ▼
┌─────────────────────────────────────┐
│  ILayerZeroIntegration               │
│  ✅ Sends coordination messages     │
│  ✅ Fast cross-chain communication  │
└─────────────────────────────────────┘
```

**Example Flow:**
1. Use **EIL** to lock tokens on origin chain
2. Use **LayerZero** to send coordination message to destination
3. Use **EIL** to redeem voucher and receive tokens on destination

---

## Why Use Interfaces?

- **Abstraction** - Hide implementation details
- **Flexibility** - Swap implementations easily
- **Testing** - Use mocks for testing
- **Decoupling** - Your code doesn't depend on specific contract versions

---

## Summary

| Interface | Purpose | Protocol |
|-----------|---------|----------|
| **IEILIntegration** | Token transfers & atomic swaps | EIL |
| **ILayerZeroIntegration** | Cross-chain messaging | LayerZero v2 |

Both interfaces are abstractions of real protocol contracts, making integration simpler and more flexible.

