/**
 * Contract addresses configuration
 * Source: applications/hackathon/blockchain/docs/ADDRESSES.md
 */

import { Address } from 'viem'

// ============================================================================
// LayerZero V2 Contracts
// ============================================================================

export const LAYERZERO_ENDPOINTS: Record<number, Address> = {
  // Ethereum Sepolia Testnet (Chain ID: 11155111, EID: 40161)
  11155111: '0x6EDCE65403992e310A62460808c4b910D972f10f' as Address,
  
  // Arbitrum Sepolia Testnet (Chain ID: 421614, EID: 40231)
  421614: '0x6EDCE65403992e310A62460808c4b910D972f10f' as Address,
}

export const LAYERZERO_SEND_ULN: Record<number, Address> = {
  11155111: '0xcc1ae8Cf5D3904Cef3360A9532B477529b177cCE' as Address,
  421614: '0x4f7cd4DA19ABB31b0eC98b9066B9e857B1bf9C0E' as Address,
}

export const LAYERZERO_RECEIVE_ULN: Record<number, Address> = {
  11155111: '0xdAf00F5eE2158dD58E0d3857851c432E34A3A851' as Address,
  421614: '0x75Db67CDab2824970131D5aa9CECfC9F69c69636' as Address,
}

export const LAYERZERO_READ_LIB: Record<number, Address> = {
  11155111: '0x908E86e9cb3F16CC94AE7569Bf64Ce2CE04bbcBE' as Address,
  421614: '0x54320b901FDe49Ba98de821Ccf374BA4358a8bf6' as Address,
}

export const LAYERZERO_BLOCKED_MESSAGE_LIB: Record<number, Address> = {
  11155111: '0x0c77d8d771ab35e2e184e7ce127f19ced31ff8c0' as Address,
  421614: '0x0c77d8d771ab35e2e184e7ce127f19ced31ff8c0' as Address,
}

export const LAYERZERO_EXECUTOR: Record<number, Address> = {
  11155111: '0x718B92b5CB0a5552039B593faF724D182A881eDA' as Address,
  421614: '0x5Df3a1cEbBD9c8BA7F8dF51Fd632A9aef8308897' as Address,
}

export const LAYERZERO_DEAD_DVN: Record<number, Address> = {
  11155111: '0x8b450b0acF56E1B0e25C581bB04FBAbeeb0644b8' as Address,
  421614: '0xA85BE08A6Ce2771C730661766AACf2c8Bb24C611' as Address,
}

// ============================================================================
// EIL (Ethereum Interoperability Layer) Contracts
// ============================================================================

export const EIL_BRIDGE_CONNECTORS: Record<number, Address> = {
  // L1 Arbitrum Bridge Connector on Ethereum Sepolia
  11155111: '0x2Efeb9A8aa5d20D50f05Be721cCb64332dE2A6a2' as Address,
  
  // L2 Arbitrum Bridge Connector on Arbitrum Sepolia
  421614: '0xDFa250f671A60B64dD3cD625AD2056b9B4A9124F' as Address,
}

// Native Arbitrum Bridge Contracts (on Ethereum Sepolia)
export const ARBITRUM_NATIVE_BRIDGE = {
  INBOX: '0xaAe29B0366299461418F5324a79Afc425BE5ae21' as Address,
  OUTBOX: '0x65f07C7D521164a4d5DaC6eB8Fac8DA067A3B78F' as Address,
  BRIDGE: '0x38f918D0E9F1b721EDaA41302E399fa1B79333a9' as Address,
}

// ============================================================================
// Hybrid Orchestration Router Addresses
// ============================================================================

export const ROUTER_ADDRESSES: Record<number, Address> = {
  // Ethereum Sepolia
  11155111: '0xdAe6ACa789552e6f9C1d8931b7af1a596823fC93' as Address,
  
  // Arbitrum Sepolia
  421614: '0xd0056410C4725cFAD258805966e717986b52F98d' as Address,
}

// ============================================================================
// Chain Registry Addresses
// ============================================================================

export const CHAIN_REGISTRY_ADDRESSES: Record<number, Address> = {
  // Ethereum Sepolia
  11155111: '0x1Dd72CE024CFf6554eBfC01d8aFb43F106e98A46' as Address,
  
  // Arbitrum Sepolia
  421614: '0x8721414fC7d5149Ea42385d5c93D24712fAF2A10' as Address,
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get LayerZero endpoint address for a chain
 */
export function getLayerZeroEndpoint(chainId: number): Address | undefined {
  return LAYERZERO_ENDPOINTS[chainId]
}

/**
 * Get EIL bridge connector address for a chain
 */
export function getEILBridgeConnector(chainId: number): Address | undefined {
  return EIL_BRIDGE_CONNECTORS[chainId]
}

/**
 * Get router address for a chain
 */
export function getRouterAddress(chainId: number): Address | undefined {
  return ROUTER_ADDRESSES[chainId]
}

/**
 * Get chain registry address for a chain
 */
export function getChainRegistryAddress(chainId: number): Address | undefined {
  return CHAIN_REGISTRY_ADDRESSES[chainId]
}

/**
 * Get peer router address for cross-chain communication
 * Based on configured peer addresses from ADDRESSES.md
 */
export function getPeerRouterAddress(chainId: number, targetChainId: number): Address | undefined {
  // Ethereum Sepolia -> Arbitrum Sepolia
  if (chainId === 11155111 && targetChainId === 421614) {
    return ROUTER_ADDRESSES[421614]
  }
  
  // Arbitrum Sepolia -> Ethereum Sepolia
  if (chainId === 421614 && targetChainId === 11155111) {
    return ROUTER_ADDRESSES[11155111]
  }
  
  return undefined
}

