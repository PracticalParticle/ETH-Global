import { Chain } from 'wagmi/chains'
import {
  // Mainnets
  mainnet,
  arbitrum,
  optimism,
  base,
  polygon,
  avalanche,
  bsc,
  zkSync,
  linea,
  scroll,
  mantle,
  celo,
  gnosis,
  fantom,
  // Testnets
  sepolia,
  arbitrumSepolia,
  optimismSepolia,
  baseSepolia,
  polygonAmoy,
  bscTestnet,
  avalancheFuji,
} from 'wagmi/chains'

// LayerZero Endpoint IDs (EIDs) mapping
// Common LayerZero endpoint IDs
export const LAYERZERO_EIDS: Record<number, number> = {
  // Mainnets
  // Ethereum Mainnet
  1: 30101,
  // Arbitrum
  42161: 30110,
  // Optimism
  10: 30111,
  // Base
  8453: 30184,
  // Polygon
  137: 30109,
  // Avalanche
  43114: 30106,
  // BSC
  56: 30102,
  // zkSync Era
  324: 30165,
  // Linea
  59144: 30173,
  // Scroll
  534352: 30170,
  // Mantle
  5000: 30181,
  // Celo
  42220: 30125,
  // Gnosis
  100: 30145,
  // Fantom
  250: 30112,
  
  // Testnets
  // Sepolia
  11155111: 40161,

  // Arbitrum Sepolia
  421614: 40231,
  // Optimism Sepolia
  11155420: 40232,
  // Base Sepolia
  84532: 40245,
  // Polygon Amoy
  80002: 40267,
  // BSC Testnet
  97: 40102,
  // Avalanche Fuji
  43113: 40106,
}

export interface ChainInfo {
  chain: Chain
  eid: number
  logoUrl?: string
  nativeToken: string
}

// Get chain info with LayerZero EID
export function getChainInfo(chainId: number): ChainInfo | null {
  const eid = LAYERZERO_EIDS[chainId]
  if (!eid) return null

  // This will be populated from wagmi chains
  return {
    chain: {} as Chain,
    eid,
    nativeToken: 'ETH', // Default, will be overridden
  }
}

// Get chain logo URL (using common CDN)
export function getChainLogoUrl(chainId: number): string {
  const logos: Record<number, string> = {
    // Mainnets
    1: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    42161: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png',
    10: 'https://cryptologos.cc/logos/optimism-op-logo.png',
    8453: 'https://cryptologos.cc/logos/base-base-logo.png',
    137: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
    43114: 'https://cryptologos.cc/logos/avalanche-avax-logo.png',
    56: 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
    324: 'https://cryptologos.cc/logos/zksync-zksync-logo.png',
    59144: 'https://cryptologos.cc/logos/linea-linea-logo.png',
    534352: 'https://cryptologos.cc/logos/scroll-scroll-logo.png',
    5000: 'https://cryptologos.cc/logos/mantle-mantle-logo.png',
    42220: 'https://cryptologos.cc/logos/celo-celo-logo.png',
    100: 'https://cryptologos.cc/logos/gnosis-gno-logo.png',
    250: 'https://cryptologos.cc/logos/fantom-ftm-logo.png',
    
    // Testnets
    11155111: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    17000: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    421614: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png',
    11155420: 'https://cryptologos.cc/logos/optimism-op-logo.png',
    84532: 'https://cryptologos.cc/logos/base-base-logo.png',
    80002: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
    97: 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
    43113: 'https://cryptologos.cc/logos/avalanche-avax-logo.png',
  }
  return logos[chainId] || 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
}

// Get native token symbol from chain object
// This is a helper that can be used when you only have chainId
// Otherwise, use chain.nativeCurrency.symbol directly
export function getNativeTokenSymbol(chainId: number): string {
  const chain = LAYERZERO_CHAINS.find(c => c.id === chainId)
  return chain?.nativeCurrency.symbol || 'ETH'
}

// Testnet chain IDs
const TESTNET_CHAIN_IDS = new Set([
  11155111, // Sepolia

  421614,   // Arbitrum Sepolia
  11155420, // Optimism Sepolia
  84532,    // Base Sepolia
  80002,    // Polygon Amoy
  97,       // BSC Testnet
  43113,    // Avalanche Fuji
])

// Check if a chain is a testnet
export function isTestnet(chainId: number): boolean {
  return TESTNET_CHAIN_IDS.has(chainId)
}

// All LayerZero-supported chains imported directly from wagmi
export const LAYERZERO_CHAINS: readonly Chain[] = [
  // Mainnets
  mainnet,
  arbitrum,
  optimism,
  base,
  polygon,
  avalanche,
  bsc,
  zkSync,
  linea,
  scroll,
  mantle,
  celo,
  gnosis,
  fantom,
  // Testnets
  sepolia,
  arbitrumSepolia,
  optimismSepolia,
  baseSepolia,
  polygonAmoy,
  bscTestnet,
  avalancheFuji,
] as const

// Get all chains from wagmi that have LayerZero support
export function getAllLayerZeroChains(): Chain[] {
  return [...LAYERZERO_CHAINS]
}

