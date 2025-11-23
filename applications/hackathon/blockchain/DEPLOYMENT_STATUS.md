# Deployment Status and Instructions

## Current Status

### ✅ Completed
- EIL Bridge Connectors deployed:
  - L1ArbitrumBridgeConnector: `0x2Efeb9A8aa5d20D50f05Be721cCb64332dE2A6a2` (Ethereum Sepolia)
  - L2ArbitrumBridgeConnector: `0xDFa250f671A60B64dD3cD625AD2056b9B4A9124F` (Arbitrum Sepolia)

### ⏳ Pending
- Hackathon contracts deployment (ChainRegistry, HybridOrchestrationRouter, EnterpriseCrossChainMessenger)
- Contract initialization
- EIL bridge connector registration in routers

## Deployment Instructions

### Prerequisites
1. Set environment variables in `.env` file:
```env
PRIVATE_KEY=0x...
SEPOLIA_RPC_URL=https://...
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
LAYERZERO_ENDPOINT=0x6EDCE65403992e310A62460808c4b910D972f10f
```

### Step 1: Deploy on Ethereum Sepolia
```bash
cd blockchain
LAYERZERO_ENDPOINT=0x6EDCE65403992e310A62460808c4b910D972f10f npm run deploy -- --network sepolia
```

### Step 2: Initialize on Ethereum Sepolia
```bash
npm run initialize -- --network sepolia
```

### Step 3: Deploy on Arbitrum Sepolia
```bash
LAYERZERO_ENDPOINT=0x6EDCE65403992e310A62460808c4b910D972f10f npm run deploy -- --network arbitrumSepolia
```

### Step 4: Initialize on Arbitrum Sepolia
```bash
npm run initialize -- --network arbitrumSepolia
```

## Expected Deployment Addresses

After deployment, addresses will be saved to:
- `deployments/sepolia-11155111.json`
- `deployments/arbitrumSepolia-421614.json`

## Configuration Issues

**Current Issue**: Hardhat 3.x configuration conflict with tsx loader.

**Workaround**: 
1. Ensure `hardhat.config.js` uses CommonJS syntax (require/module.exports)
2. If issues persist, try using `hardhat.config.cjs` instead
3. Or downgrade to Hardhat 2.x if needed

## Next Steps After Deployment

1. Update `docs/ADDRESSES.md` with deployed contract addresses
2. Set LayerZero peer addresses for cross-chain communication
3. Test message sending/receiving between chains

