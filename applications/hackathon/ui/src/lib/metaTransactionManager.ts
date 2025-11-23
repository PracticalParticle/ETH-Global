/**
 * Meta-transaction manager with localStorage persistence
 */

import { Address } from 'viem';
import { MetaTransaction } from '../../../../../sdk/typescript/interfaces/lib.index';

export interface StoredMetaTransaction {
  txId: string;
  signedMetaTx: MetaTransaction;
  metadata: {
    contractAddress: Address;
    chainId: number;
    createdAt: number;
    expiresAt: number;
    operationType: string;
    signerAddress: Address;
  };
}

const STORAGE_KEY_PREFIX = 'messenger_meta_tx_';
const STORAGE_INDEX_KEY = 'messenger_meta_tx_index';

/**
 * Get storage key for a specific transaction
 */
function getStorageKey(txId: string): string {
  return `${STORAGE_KEY_PREFIX}${txId}`;
}

/**
 * Get all stored transaction IDs
 */
function getStoredTxIds(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_INDEX_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Update the index of stored transaction IDs
 */
function updateTxIndex(txIds: string[]): void {
  try {
    localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(txIds));
  } catch (error) {
    console.error('Failed to update transaction index:', error);
  }
}

/**
 * Store a signed meta-transaction
 */
export function storeSignedMetaTx(
  txId: bigint,
  signedMetaTx: MetaTransaction,
  metadata: Omit<StoredMetaTransaction['metadata'], 'createdAt' | 'expiresAt'>
): void {
  try {
    const txIdString = txId.toString();
    const now = Date.now();
    const expiresAt = Number(signedMetaTx.params.deadline) * 1000; // Convert from seconds to milliseconds

    const stored: StoredMetaTransaction = {
      txId: txIdString,
      signedMetaTx,
      metadata: {
        ...metadata,
        createdAt: now,
        expiresAt,
      },
    };

    localStorage.setItem(getStorageKey(txIdString), JSON.stringify(stored, (_key, value) => {
      // Convert BigInt values to strings for JSON serialization
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }));

    // Update index
    const txIds = getStoredTxIds();
    if (!txIds.includes(txIdString)) {
      txIds.push(txIdString);
      updateTxIndex(txIds);
    }
  } catch (error) {
    console.error('Failed to store signed meta-transaction:', error);
    throw new Error('Failed to store signed meta-transaction in localStorage');
  }
}

/**
 * Get a stored signed meta-transaction
 */
export function getSignedMetaTx(txId: bigint): StoredMetaTransaction | null {
  try {
    const txIdString = txId.toString();
    const stored = localStorage.getItem(getStorageKey(txIdString));
    
    if (!stored) {
      return null;
    }

      const parsed = JSON.parse(stored, (_key, value) => {
        // Convert string values back to BigInt where needed
        // Note: We can't check key here since JSON.parse reviver doesn't provide full path
        // BigInt conversion will be handled by the SDK when using the meta-transaction
        return value;
      }) as StoredMetaTransaction;
      
      // Convert BigInt fields manually
      if (parsed.signedMetaTx?.txRecord?.txId && typeof parsed.signedMetaTx.txRecord.txId === 'string') {
        parsed.signedMetaTx.txRecord.txId = BigInt(parsed.signedMetaTx.txRecord.txId);
      }
      if (parsed.signedMetaTx?.txRecord?.releaseTime && typeof parsed.signedMetaTx.txRecord.releaseTime === 'string') {
        parsed.signedMetaTx.txRecord.releaseTime = BigInt(parsed.signedMetaTx.txRecord.releaseTime);
      }

    // Check if expired
    if (parsed.metadata.expiresAt < Date.now()) {
      removeSignedMetaTx(txId);
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('Failed to get signed meta-transaction:', error);
    return null;
  }
}

/**
 * Remove a stored signed meta-transaction
 */
export function removeSignedMetaTx(txId: bigint): void {
  try {
    const txIdString = txId.toString();
    localStorage.removeItem(getStorageKey(txIdString));

    // Update index
    const txIds = getStoredTxIds();
    const filtered = txIds.filter(id => id !== txIdString);
    updateTxIndex(filtered);
  } catch (error) {
    console.error('Failed to remove signed meta-transaction:', error);
  }
}

/**
 * Get all stored signed meta-transactions
 */
export function getAllSignedMetaTxs(
  contractAddress?: Address,
  chainId?: number
): StoredMetaTransaction[] {
  try {
    const txIds = getStoredTxIds();
    const now = Date.now();
    const results: StoredMetaTransaction[] = [];

    for (const txIdString of txIds) {
      const stored = localStorage.getItem(getStorageKey(txIdString));
      if (!stored) continue;

      try {
        const parsed = JSON.parse(stored, (_key, value) => {
          // BigInt conversion handled separately
          return value;
        }) as StoredMetaTransaction;
        
        // Convert BigInt fields manually
        if (parsed.signedMetaTx?.txRecord?.txId && typeof parsed.signedMetaTx.txRecord.txId === 'string') {
          parsed.signedMetaTx.txRecord.txId = BigInt(parsed.signedMetaTx.txRecord.txId);
        }
        if (parsed.signedMetaTx?.txRecord?.releaseTime && typeof parsed.signedMetaTx.txRecord.releaseTime === 'string') {
          parsed.signedMetaTx.txRecord.releaseTime = BigInt(parsed.signedMetaTx.txRecord.releaseTime);
        }

        // Filter by contract address and chain ID if provided
        if (contractAddress && parsed.metadata.contractAddress.toLowerCase() !== contractAddress.toLowerCase()) {
          continue;
        }
        if (chainId && parsed.metadata.chainId !== chainId) {
          continue;
        }

        // Check if expired
        if (parsed.metadata.expiresAt < now) {
          removeSignedMetaTx(BigInt(parsed.txId));
          continue;
        }

        results.push(parsed);
      } catch (error) {
        console.error(`Failed to parse stored meta-transaction ${txIdString}:`, error);
        // Remove corrupted entry
        localStorage.removeItem(getStorageKey(txIdString));
      }
    }

    return results;
  } catch (error) {
    console.error('Failed to get all signed meta-transactions:', error);
    return [];
  }
}

/**
 * Clean up expired meta-transactions
 */
export function cleanupExpiredMetaTxs(): number {
  try {
    const txIds = getStoredTxIds();
    const now = Date.now();
    let cleaned = 0;

    for (const txIdString of txIds) {
      const stored = localStorage.getItem(getStorageKey(txIdString));
      if (!stored) continue;

      try {
        const parsed = JSON.parse(stored) as StoredMetaTransaction;
        if (parsed.metadata.expiresAt < now) {
          removeSignedMetaTx(BigInt(parsed.txId));
          cleaned++;
        }
      } catch {
        // Remove corrupted entry
        localStorage.removeItem(getStorageKey(txIdString));
        cleaned++;
      }
    }

    return cleaned;
  } catch (error) {
    console.error('Failed to cleanup expired meta-transactions:', error);
    return 0;
  }
}

/**
 * Clear all stored meta-transactions
 */
export function clearAllMetaTxs(): void {
  try {
    const txIds = getStoredTxIds();
    for (const txIdString of txIds) {
      localStorage.removeItem(getStorageKey(txIdString));
    }
    localStorage.removeItem(STORAGE_INDEX_KEY);
  } catch (error) {
    console.error('Failed to clear all meta-transactions:', error);
  }
}

