# Contract Addresses - Testnet Networks

This document contains all deployed contract addresses needed for testing the Enterprise Cross-Chain Messaging System on testnet networks.

## 📋 Networks

- **Ethereum Sepolia** (Chain ID: 11155111)
- **Arbitrum Sepolia** (Chain ID: 421614)

---

## 🌉 LayerZero V2 Contracts

### Ethereum Sepolia Testnet

**Chain ID:** `11155111`  
**Endpoint ID (EID):** `40161`

| Contract | Address |
|----------|---------|
| **EndpointV2** | `0x6EDCE65403992e310A62460808c4b910D972f10f` |
| **SendUln302** | `0xcc1ae8Cf5D3904Cef3360A9532B477529b177cCE` |
| **ReceiveUln302** | `0xdAf00F5eE2158dD58E0d3857851c432E34A3A851` |
| **ReadLib1002** | `0x908E86e9cb3F16CC94AE7569Bf64Ce2CE04bbcBE` |
| **BlockedMessageLib** | `0x0c77d8d771ab35e2e184e7ce127f19ced31ff8c0` |
| **LZ Executor** | `0x718B92b5CB0a5552039B593faF724D182A881eDA` |
| **LZ Dead DVN** | `0x8b450b0acF56E1B0e25C581bB04FBAbeeb0644b8` |

**Usage:**
```javascript
const LAYERZERO_ENDPOINT_SEPOLIA = "0x6EDCE65403992e310A62460808c4b910D972f10f";
const SEPOLIA_EID = 40161;
```

---

### Arbitrum Sepolia Testnet

**Chain ID:** `421614`  
**Endpoint ID (EID):** `40231`

| Contract | Address |
|----------|---------|
| **EndpointV2** | `0x6EDCE65403992e310A62460808c4b910D972f10f` |
| **SendUln302** | `0x4f7cd4DA19ABB31b0eC98b9066B9e857B1bf9C0E` |
| **ReceiveUln302** | `0x75Db67CDab2824970131D5aa9CECfC9F69c69636` |
| **ReadLib1002** | `0x54320b901FDe49Ba98de821Ccf374BA4358a8bf6` |
| **BlockedMessageLib** | `0x0c77d8d771ab35e2e184e7ce127f19ced31ff8c0` |
| **LZ Executor** | `0x5Df3a1cEbBD9c8BA7F8dF51Fd632A9aef8308897` |
| **LZ Dead DVN** | `0xA85BE08A6Ce2771C730661766AACf2c8Bb24C611` |

**Usage:**
```javascript
const LAYERZERO_ENDPOINT_ARB_SEPOLIA = "0x6EDCE65403992e310A62460808c4b910D972f10f";
const ARB_SEPOLIA_EID = 40231;
```

---

## 🔗 EIL (Ethereum Interoperability Layer) Contracts

### ✅ Status: Deployed

EIL bridge connectors deployed for message-only cross-chain communication. These are the only EIL contracts needed for the POC.

### Ethereum Sepolia Testnet

**Chain ID:** `11155111`

| Contract | Address | Status | Constructor Params |
|----------|---------|--------|---------------------|
| **L1ArbitrumBridgeConnector** | `0x2Efeb9A8aa5d20D50f05Be721cCb64332dE2A6a2` | ✅ Deployed | `(ArbOutbox, ArbInbox)` |

**Required Native Bridge Addresses:**
- ArbOutbox: `0x65f07C7D521164a4d5DaC6eB8Fac8DA067A3B78F` ✅
- ArbInbox: `0xaAe29B0366299461418F5324a79Afc425BE5ae21` ✅

**Deployment Details:**
- Constructor: `L1ArbitrumBridgeConnector(0x65f07C7D521164a4d5DaC6eB8Fac8DA067A3B78F, 0xaAe29B0366299461418F5324a79Afc425BE5ae21)`
- Deployed: 2025-11-23
- Deployer: `0xcC88A0a9ceE5FDc446ED28c94f6D646E40e1193a`

### Arbitrum Sepolia Testnet

**Chain ID:** `421614`

| Contract | Address | Status | Constructor Params |
|----------|---------|--------|---------------------|
| **L2ArbitrumBridgeConnector** | `0xDFa250f671A60B64dD3cD625AD2056b9B4A9124F` | ✅ Deployed | `()` (none) |

**Deployment Details:**
- Constructor: `L2ArbitrumBridgeConnector()`
- Deployed: 2025-11-23
- Deployer: `0xcC88A0a9ceE5FDc446ED28c94f6D646E40e1193a`

---

## 🌐 Native Bridge Contracts

### Arbitrum Sepolia Testnet

**Chain ID:** `421614`

| Contract | Address | Network | Status |
|----------|---------|---------|--------|
| **ArbInbox** | `0xaAe29B0366299461418F5324a79Afc425BE5ae21` | Ethereum Sepolia | ✅ Found |
| **ArbOutbox** | `0x65f07C7D521164a4d5DaC6eB8Fac8DA067A3B78F` | Ethereum Sepolia | ✅ Found |
| **Bridge** | `0x38f918D0E9F1b721EDaA41302E399fa1B79333a9` | Ethereum Sepolia | ✅ Found |

**Note:** These are Arbitrum's native bridge contracts deployed on Ethereum Sepolia. The Inbox and Outbox are used by `L1ArbitrumBridgeConnector` for L1↔L2 message routing.

---

## 📝 Configuration Template

Use this template in your `.env` file or deployment scripts:

```env
# LayerZero Endpoints
LAYERZERO_ENDPOINT_SEPOLIA=0x6EDCE65403992e310A62460808c4b910D972f10f
LAYERZERO_ENDPOINT_ARB_SEPOLIA=0x6EDCE65403992e310A62460808c4b910D972f10f

# LayerZero Endpoint IDs
SEPOLIA_EID=40161
ARB_SEPOLIA_EID=40231

# EIL Contracts (TBD - to be deployed)
EIL_L1_ARB_BRIDGE_SEPOLIA=TBD
EIL_L2_ARB_BRIDGE_ARB_SEPOLIA=TBD

# Native Bridge Contracts (Arbitrum Sepolia)
ARB_INBOX_SEPOLIA=0xaAe29B0366299461418F5324a79Afc425BE5ae21
ARB_OUTBOX_SEPOLIA=0x65f07C7D521164a4d5DaC6eB8Fac8DA067A3B78F
ARB_BRIDGE_SEPOLIA=0x38f918D0E9F1b721EDaA41302E399fa1B79333a9
```

---

## 🔍 How to Find Missing Addresses

### LayerZero Addresses
- ✅ **Complete** - All LayerZero addresses provided above

### EIL Addresses
- ✅ **Deployed** - Bridge connectors successfully deployed
- L1ArbitrumBridgeConnector: `0x2Efeb9A8aa5d20D50f05Be721cCb64332dE2A6a2` (Ethereum Sepolia)
- L2ArbitrumBridgeConnector: `0xDFa250f671A60B64dD3cD625AD2056b9B4A9124F` (Arbitrum Sepolia)
- All required contracts are in `eil-contracts` repository

### Native Bridge Addresses

**Arbitrum:**
- ✅ **Complete** - All Arbitrum Sepolia native bridge addresses found above
- Official docs: https://docs.arbitrum.io/
- Arbitrum Sepolia explorer: https://sepolia.arbiscan.io/

---

## 📊 Quick Reference

### Chain ID to Endpoint ID Mapping

| Network | Chain ID | Endpoint ID (EID) |
|---------|----------|-------------------|
| Ethereum Sepolia | 11155111 | 40161 |
| Arbitrum Sepolia | 421614 | 40231 |

### Endpoint Addresses

Both testnets use the same EndpointV2 address: `0x6EDCE65403992e310A62460808c4b910D972f10f`

---

## ⚠️ Important Notes

1. **Address Verification**: Always verify addresses on block explorers before using in production
2. **Testnet Only**: These addresses are for testnet networks only. Do not use for mainnet
3. **Address Completeness**: Some addresses are truncated (`...`). Ensure you have the full 42-character address (0x + 40 hex chars)
4. **Updates**: This document should be updated as new addresses are discovered
5. **Security**: Never commit private keys or sensitive credentials to version control

---

## 🔗 Useful Links

- [LayerZero V2 Documentation](https://docs.layerzero.network/v2)
- [Arbitrum Documentation](https://docs.arbitrum.io/)
- [EIL Contracts Repository](../../../../eil-contracts)
- [EIL SDK Repository](../../../../eil-sdk)

---

## 🏗️ Deployed Hackathon Contracts

### ✅ Status: All Contracts Deployed and Initialized

All contracts for the Enterprise Cross-Chain Messaging System have been successfully deployed and initialized on both testnet networks.

---

### Ethereum Sepolia Testnet

**Chain ID:** `11155111`  
**Deployer:** `0xcC88A0a9ceE5FDc446ED28c94f6D646E40e1193a`  
**Deployed:** 2025-11-23 (Redeployed)

#### Core Contracts

| Contract | Address | Status |
|----------|---------|--------|
| **ChainRegistry** | `0x1Dd72CE024CFf6554eBfC01d8aFb43F106e98A46` | ✅ Deployed |
| **HybridOrchestrationRouter** | `0xdAe6ACa789552e6f9C1d8931b7af1a596823fC93` | ✅ Deployed |
| **EnterpriseCrossChainMessenger** | `0xc996252B45807D8dDa6531C936c30ACc456602fA` | ✅ Deployed & Initialized |
| **Implementation** (UUPS) | `0x2c9Afb22539160A2180F61617E93B50bb7918b0A` | ✅ Deployed |

#### Libraries

| Library | Address | Status |
|---------|---------|--------|
| **MessengerDefinitions** | `0x9d215755339F62772517989d6f4e254E24Fc799A` | ✅ Deployed |
| **SecureOwnableDefinitions** | `0x7205c4060E5674A5B2788E784004431F0eE42BcF` | ✅ Deployed |
| **StateAbstraction** | `0xEd2FBA5061911d6ee5543052004A38936385beF3` | ✅ Deployed |
| **StateAbstractionDefinitions** | `0xc4388eA0ccdBE9FBF54fc60148C63BEa6E339D34` | ✅ Deployed |

#### Initialization

- **Owner:** `0xcC88A0a9ceE5FDc446ED28c94f6D646E40e1193a`
- **Broadcaster:** `0xc4d7ccabc561c7d9360481404da8a80886a49277` ✅
- **Recovery:** `0xcC88A0a9ceE5FDc446ED28c94f6D646E40e1193a`
- **Initialized:** ✅ 2025-11-23

#### EIL Bridge Registration

- **Arbitrum Sepolia Chain ID:** `421614`
- **L1 Bridge Connector:** `0x2Efeb9A8aa5d20D50f05Be721cCb64332dE2A6a2` ✅ Registered
- **L2 Bridge Connector:** `0xDFa250f671A60B64dD3cD625AD2056b9B4A9124F` ✅ Registered

---

### Arbitrum Sepolia Testnet

**Chain ID:** `421614`  
**Deployer:** `0xcC88A0a9ceE5FDc446ED28c94f6D646E40e1193a`  
**Deployed:** 2025-11-23 (Redeployed)

#### Core Contracts

| Contract | Address | Status |
|----------|---------|--------|
| **ChainRegistry** | `0x8721414fC7d5149Ea42385d5c93D24712fAF2A10` | ✅ Deployed |
| **HybridOrchestrationRouter** | `0xd0056410C4725cFAD258805966e717986b52F98d` | ✅ Deployed |
| **EnterpriseCrossChainMessenger** | `0x6F30806b708412E0D44C1A59290b3583A03DB099` | ✅ Deployed & Initialized |
| **Implementation** (UUPS) | `0xfE86eC9C93176B9F4e241c9849e73a1Ef842A45B` | ✅ Deployed |

#### Libraries

| Library | Address | Status |
|---------|---------|--------|
| **MessengerDefinitions** | `0xDA63923333F4db51950f7B396f6DE3627fDF2Fa3` | ✅ Deployed |
| **SecureOwnableDefinitions** | `0x628E146782ff3D031b46095CcE6C04024bBdD5c5` | ✅ Deployed |
| **StateAbstraction** | `0xe312c2b95b2255e2Bf88c3B4CD37Ed85eEF124AE` | ✅ Deployed |
| **StateAbstractionDefinitions** | `0xAab14D6195CBbCB7d8752B1Ab5Bad3d7e73Ab14F` | ✅ Deployed |

#### Initialization

- **Owner:** `0xcC88A0a9ceE5FDc446ED28c94f6D646E40e1193a`
- **Broadcaster:** `0xc4d7ccabc561c7d9360481404da8a80886a49277` ✅
- **Recovery:** `0xcC88A0a9ceE5FDc446ED28c94f6D646E40e1193a`
- **Initialized:** ✅ 2025-11-23

---

## 🔗 Cross-Chain Configuration

### LayerZero Peer Addresses

✅ **Status: Configured** - Peer addresses have been set on both routers.

**Ethereum Sepolia Router (`0xdAe6ACa789552e6f9C1d8931b7af1a596823fC93`):**
- ✅ Peer for Arbitrum Sepolia (EID: 40231): `0xd0056410C4725cFAD258805966e717986b52F98d`
- Set at: 2025-11-23
- Transaction: `0xce96c8a71580cb977f700182439d1fd1e8bce148b231a4815c3e1a732b13fad9`

**Arbitrum Sepolia Router (`0xd0056410C4725cFAD258805966e717986b52F98d`):**
- ✅ Peer for Ethereum Sepolia (EID: 40161): `0xdAe6ACa789552e6f9C1d8931b7af1a596823fC93`
- Set at: 2025-11-23
- Transaction: `0xd4837bc6692fc9ee60d771af46636beb32c643c89c17891ab13828fca0f7a1ee`

### Chain Registry

Both networks have registered each other:
- ✅ Ethereum Sepolia → Arbitrum Sepolia (EID: 40231)
- ✅ Arbitrum Sepolia → Ethereum Sepolia (EID: 40161)

---

**Last Updated:** 2025-11-23  
**Status:** 
- ✅ LayerZero addresses complete
- ✅ Arbitrum native bridge addresses complete
- ✅ EIL bridge connector addresses deployed
- ✅ All hackathon contracts deployed and initialized
- ✅ LayerZero peer addresses configured for cross-chain messaging

