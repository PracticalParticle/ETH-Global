/**
 * Transaction types for cross-chain messaging
 */

export enum SecurityLevel {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  CRITICAL = 3,
}

export interface MessageRequirements {
  requiresFastFinality: boolean
  requiresGuaranteedDelivery: boolean
  isCostSensitive: boolean
  isMultiChain: boolean
  maxDelay: bigint
  amount: bigint
  requiresNativeSecurity: boolean
  requiresDisputeResolution: boolean
  securityLevel: SecurityLevel
}

export enum TransactionStatus {
  PENDING = 0,
  APPROVED = 1,
  EXECUTED = 2,
  CANCELLED = 3,
  EXPIRED = 4, // UI-only status for transactions past releaseTime without approval
}

export type RouterType = 'EIL' | 'LAYERZERO'

export interface RouterSelection {
  router: RouterType
  reasoning: string
  estimatedCost: string
  estimatedTime: string
}

export interface TransactionRecord {
  txId: bigint
  releaseTime: bigint
  status: TransactionStatus
  operationType: string
  targetChainId?: bigint
  payload?: string
  requirements?: MessageRequirements
  createdAt: bigint
  approvedAt?: bigint
  executedAt?: bigint
  cancelledAt?: bigint
}

export interface PendingTransaction extends TransactionRecord {
  timeRemaining: number // seconds
  progress: number // 0-100
  isExpired: boolean
  canCancel: boolean
  canApprove: boolean
}

