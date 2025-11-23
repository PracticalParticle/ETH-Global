/**
 * Contract interaction utilities for EnterpriseCrossChainMessenger
 */

import { Address, encodeFunctionData, Hex, bytesToHex } from 'viem'
import { MessageRequirements, TransactionRecord, TransactionStatus } from '../types/transaction'
import { ENTERPRISE_MESSENGER_ABI } from './contracts'
import { getRouterSelection } from './routerSelection'

export interface SendMessageRequestParams {
  targetChainId: number
  payload: string
  requirements: MessageRequirements
}

export interface CancelMessageParams {
  txId: bigint
}

// MetaTransaction type - complex structure from contract
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MetaTransaction = any

export interface ApproveMessageParams {
  metaTx: MetaTransaction
  value: bigint // ETH value for routing fees
}

/**
 * Encode message requirements to contract format
 * Returns as object to match viem's tuple encoding expectations
 */
function encodeRequirements(req: MessageRequirements): {
  requiresFastFinality: boolean
  requiresGuaranteedDelivery: boolean
  isCostSensitive: boolean
  isMultiChain: boolean
  maxDelay: bigint
  amount: bigint
  requiresNativeSecurity: boolean
  requiresDisputeResolution: boolean
  securityLevel: number
} {
  return {
    requiresFastFinality: req.requiresFastFinality,
    requiresGuaranteedDelivery: req.requiresGuaranteedDelivery,
    isCostSensitive: req.isCostSensitive,
    isMultiChain: req.isMultiChain,
    maxDelay: req.maxDelay,
    amount: req.amount,
    requiresNativeSecurity: req.requiresNativeSecurity,
    requiresDisputeResolution: req.requiresDisputeResolution,
    securityLevel: req.securityLevel,
  }
}

/**
 * Prepare sendMessageRequest transaction
 */
export function prepareSendMessageRequest(
  contractAddress: Address,
  params: SendMessageRequestParams
) {
  const { targetChainId, payload, requirements } = params
  
  // Encode payload as bytes
  const payloadBytes = payload ? new TextEncoder().encode(payload) : new Uint8Array(0)
  const payloadHex = bytesToHex(payloadBytes) as Hex
  
  // Encode requirements as object (viem expects tuples as objects with named properties)
  const requirementsTuple = encodeRequirements(requirements)
  
  const data = encodeFunctionData({
    abi: ENTERPRISE_MESSENGER_ABI,
    functionName: 'sendMessageRequest',
    args: [BigInt(targetChainId), payloadHex, requirementsTuple],
  })

  return {
    to: contractAddress,
    data,
    value: 0n, // No value - broadcaster pays routing fees
  }
}

/**
 * Prepare cancelMessage transaction
 */
export function prepareCancelMessage(
  contractAddress: Address,
  params: CancelMessageParams
) {
  const { txId } = params

  const data = encodeFunctionData({
    abi: ENTERPRISE_MESSENGER_ABI,
    functionName: 'cancelMessage',
    args: [txId],
  })

  return {
    to: contractAddress,
    data,
    value: 0n,
  }
}

/**
 * Prepare approveMessageWithMetaTx transaction
 */
export function prepareApproveMessage(
  contractAddress: Address,
  params: ApproveMessageParams
) {
  const { metaTx, value } = params

  const data = encodeFunctionData({
    abi: ENTERPRISE_MESSENGER_ABI,
    functionName: 'approveMessageWithMetaTx',
    args: [metaTx],
  })

  return {
    to: contractAddress,
    data,
    value, // Broadcaster pays routing fees
  }
}

/**
 * Decode transaction record from contract response
 */
export function decodeTransactionRecord(_result: Hex): TransactionRecord {
  // This is a simplified decoder - in production, use proper ABI decoding
  // The actual structure is complex with nested tuples
  // For now, return a placeholder structure
  // In real implementation, decode using decodeFunctionResult from viem
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void _result
  
  return {
    txId: 0n,
    releaseTime: 0n,
    status: TransactionStatus.PENDING,
    operationType: '',
    createdAt: 0n,
  }
}

/**
 * Get router selection for given parameters
 */
export async function getRouterSelectionForMessage(
  _chainId: number,
  targetChainId: number,
  requirements: MessageRequirements,
  nativeBridgeChains: number[]
) {
  return getRouterSelection(targetChainId, requirements, nativeBridgeChains)
}

/**
 * Check if transaction has expired
 */
export function isTransactionExpired(
  releaseTime: bigint,
  currentTime: number
): boolean {
  return currentTime >= Number(releaseTime)
}

/**
 * Calculate time remaining until release time
 */
export function getTimeRemaining(
  releaseTime: bigint,
  currentTime: number
): number {
  const remaining = Number(releaseTime) - currentTime
  return Math.max(0, remaining)
}

/**
 * Calculate progress percentage for time lock
 */
export function getTimeLockProgress(
  _createdAt: bigint,
  releaseTime: bigint,
  currentTime: number,
  timeLockPeriod: number
): number {
  if (timeLockPeriod === 0) return 100
  
  const startTime = Number(releaseTime) - timeLockPeriod
  const elapsed = currentTime - startTime
  const progress = (elapsed / timeLockPeriod) * 100
  
  return Math.min(100, Math.max(0, progress))
}

