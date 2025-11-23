/**
 * Contract configuration and ABI setup
 */

import { usePublicClient, useWalletClient } from 'wagmi'
import { Address } from 'viem'

// Contract addresses - configured from ADDRESSES.md
// These addresses are for the Enterprise Cross-Chain Messaging System
export const CONTRACT_ADDRESSES: Record<number, Address> = {
  // Ethereum Sepolia Testnet
  11155111: '0xc996252B45807D8dDa6531C936c30ACc456602fA' as Address, // EnterpriseCrossChainMessenger
  
  // Arbitrum Sepolia Testnet
  421614: '0x6F30806b708412E0D44C1A59290b3583A03DB099' as Address, // EnterpriseCrossChainMessenger
}

// Get contract address for current chain
export function getContractAddress(chainId: number): Address | undefined {
  return CONTRACT_ADDRESSES[chainId]
}

// Minimal ABI for EnterpriseCrossChainMessenger
// In production, import from a generated ABI file
export const ENTERPRISE_MESSENGER_ABI = [
  {
    name: 'sendMessageRequest',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'targetChainId', type: 'uint256' },
      { name: 'payload', type: 'bytes' },
      {
        name: 'req',
        type: 'tuple',
        components: [
          { name: 'requiresFastFinality', type: 'bool' },
          { name: 'requiresGuaranteedDelivery', type: 'bool' },
          { name: 'isCostSensitive', type: 'bool' },
          { name: 'isMultiChain', type: 'bool' },
          { name: 'maxDelay', type: 'uint256' },
          { name: 'amount', type: 'uint256' },
          { name: 'requiresNativeSecurity', type: 'bool' },
          { name: 'requiresDisputeResolution', type: 'bool' },
          { name: 'securityLevel', type: 'uint8' },
        ],
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'txId', type: 'uint256' },
          { name: 'releaseTime', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'params', type: 'tuple' },
          { name: 'message', type: 'bytes32' },
          { name: 'result', type: 'bytes' },
          { name: 'payment', type: 'tuple' },
        ],
      },
    ],
  },
  {
    name: 'cancelMessage',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'txId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'txId', type: 'uint256' },
          { name: 'releaseTime', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'params', type: 'tuple' },
          { name: 'message', type: 'bytes32' },
          { name: 'result', type: 'bytes' },
          { name: 'payment', type: 'tuple' },
        ],
      },
    ],
  },
  {
    name: 'approveMessageWithMetaTx',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'metaTx',
        type: 'tuple',
        components: [
          { name: 'txRecord', type: 'tuple' },
          { name: 'params', type: 'tuple' },
          { name: 'signature', type: 'bytes32' },
          { name: 'data', type: 'bytes' },
          { name: 'payment', type: 'tuple' },
          { name: 'handler', type: 'tuple' },
          { name: 'executionOptions', type: 'bytes' },
          { name: 'metaTxParams', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'txId', type: 'uint256' },
          { name: 'releaseTime', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'params', type: 'tuple' },
          { name: 'message', type: 'bytes32' },
          { name: 'result', type: 'bytes' },
          { name: 'payment', type: 'tuple' },
        ],
      },
    ],
  },
  {
    name: 'getTransaction',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'txId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'txId', type: 'uint256' },
          { name: 'releaseTime', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'params', type: 'tuple' },
          { name: 'message', type: 'bytes32' },
          { name: 'result', type: 'bytes' },
          { name: 'payment', type: 'tuple' },
        ],
      },
    ],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'getBroadcaster',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'router',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

// Hook to get contract instance
export function useMessengerContract(chainId: number | undefined) {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  if (!chainId || !publicClient) {
    return null
  }

  const address = getContractAddress(chainId)
  if (!address) {
    return null
  }

  return {
    address,
    publicClient,
    walletClient: walletClient || undefined,
    abi: ENTERPRISE_MESSENGER_ABI,
  }
}

