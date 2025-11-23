/**
 * Hook for EnterpriseCrossChainMessenger operations using SDK
 */

import { useState, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi';
import { Address, Hex, keccak256, toHex, parseEventLogs } from 'viem';
import { EnterpriseCrossChainMessengerSDK, MessageRequirements } from '../lib/messengerSDK';
import { MetaTransactionSigner, MetaTransactionBuilder } from '../../../../../sdk/typescript/utils/metaTx/metaTransaction';
import { TxAction } from '../../../../../sdk/typescript/types/lib.index';
import { storeSignedMetaTx, getSignedMetaTx, removeSignedMetaTx } from '../lib/metaTransactionManager';
import { handleContractError, retryWithBackoff } from '../lib/errorHandler';
import { getContractAddress } from '../lib/contracts';
import { MessageRequirements as UIMessageRequirements } from '../types/transaction';
import { MESSENGER_ABI } from '../lib/messengerSDK';

// Function selector for approveMessageWithMetaTx
const APPROVE_MESSAGE_META_SELECTOR = toHex(keccak256(toHex('approveMessageWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes32,bytes,(address,uint256,address,uint256),(uint256,uint256,address,bytes4,uint256,uint256,address),bytes,bytes))')).slice(0, 10));

export function useMessengerOperations(contractAddress?: Address) {
  const { address: connectedAddress } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get contract address
  const messengerAddress = contractAddress || (chainId ? getContractAddress(chainId) : undefined);

  // Get chain for SDK
  const chain = publicClient?.chain || undefined;

  // Create SDK instance
  const getSDK = useCallback((): EnterpriseCrossChainMessengerSDK | null => {
    if (!messengerAddress || !publicClient || !chain) return null;
    return new EnterpriseCrossChainMessengerSDK(
      publicClient,
      walletClient || undefined,
      messengerAddress,
      chain
    );
  }, [messengerAddress, publicClient, walletClient, chain]);

  /**
   * Send message request (owner only)
   */
  const sendMessageRequest = useCallback(async (
    targetChainId: number,
    payload: string,
    requirements: UIMessageRequirements
  ): Promise<bigint> => {
    if (!connectedAddress || !walletClient) {
      throw new Error('Wallet not connected');
    }

    const sdk = getSDK();
    if (!sdk) {
      throw new Error('SDK not initialized. Please ensure you are connected to a supported chain.');
    }

    // Skip owner check - the contract will revert with a clear error if user is not owner
    // This avoids RPC timeout issues and lets the contract handle the validation

    setIsLoading(true);
    setError(null);

    try {
      // Convert UI requirements to SDK format
      const sdkRequirements: MessageRequirements = {
        requiresFastFinality: requirements.requiresFastFinality,
        requiresGuaranteedDelivery: requirements.requiresGuaranteedDelivery,
        isCostSensitive: requirements.isCostSensitive,
        isMultiChain: requirements.isMultiChain,
        maxDelay: requirements.maxDelay,
        amount: requirements.amount,
        requiresNativeSecurity: requirements.requiresNativeSecurity,
        requiresDisputeResolution: requirements.requiresDisputeResolution,
        securityLevel: requirements.securityLevel,
      };

      // Encode payload as hex
      const payloadBytes = payload ? new TextEncoder().encode(payload) : new Uint8Array(0);
      const payloadHex = toHex(payloadBytes) as Hex;

      const result = await retryWithBackoff(async () => {
        return await sdk.sendMessageRequest(
          BigInt(targetChainId),
          payloadHex,
          sdkRequirements,
          { from: connectedAddress }
        );
      });

      // Wait for transaction receipt
      const receipt = await result.wait();

      // Extract txId from TransactionRequested event
      let txId: bigint | null = null;
      
      if (receipt && receipt.logs) {
        try {
          const logs = parseEventLogs({
            abi: MESSENGER_ABI,
            logs: receipt.logs,
            eventName: 'TransactionRequested',
          }) as unknown as Array<{ args: { txId: bigint; requester: Address; operationType: Hex; releaseTime: bigint } }>;
          
          if (logs.length > 0 && logs[0].args?.txId) {
            txId = logs[0].args.txId;
          }
        } catch (parseError) {
          console.warn('Failed to parse TransactionRequested event:', parseError);
          // Fallback: try to get txId from the transaction record returned by the contract
          // The contract returns a TxRecord, but we need to decode it from the receipt
        }
      }

      if (!txId) {
        throw new Error('Failed to extract transaction ID from receipt. Transaction may have failed.');
      }

      return txId;
    } catch (err: unknown) {
      // Extract full error message including nested properties
      let fullErrorMessage = '';
      if (err instanceof Error) {
        fullErrorMessage = err.message;
        
        // Try to get the full message from originalError if it exists
        const errObj = err as unknown as Record<string, unknown>;
        if (errObj.originalError && typeof errObj.originalError === 'object') {
          const originalError = errObj.originalError as Error;
          if (originalError.message && originalError.message.length > fullErrorMessage.length) {
            fullErrorMessage = originalError.message;
          }
        }
        
        // Try to extract revert reason from the message
        const revertMatch = fullErrorMessage.match(/revert[^:]*:\s*(.+?)(?:\n|Contract Call:|$)/is);
        if (revertMatch) {
          const revertReason = revertMatch[1].trim();
          console.error('Contract revert reason:', revertReason);
          fullErrorMessage = revertReason;
        }
      } else {
        fullErrorMessage = String(err);
      }
      
      // Log the full error for debugging
      console.error('Error in sendMessageRequest:', {
        error: err,
        fullMessage: fullErrorMessage,
        errorType: err instanceof Error ? err.constructor.name : typeof err,
      });
      
      const errorInfo = handleContractError(err);
      console.log('Error info:', errorInfo);
      setError(errorInfo.userMessage);
      
      // For RPC errors, don't include the technical error message
      // For other errors, include it for debugging
      if (errorInfo.code === 'RPC_FETCH_ERROR') {
        throw new Error(errorInfo.userMessage);
      }
      
      // For contract reverts, include the actual revert reason if we extracted it
      if (errorInfo.code === 'TRANSACTION_REVERTED' && fullErrorMessage && fullErrorMessage !== errorInfo.userMessage) {
        throw new Error(`${errorInfo.userMessage}\n\nRevert reason: ${fullErrorMessage}`);
      }
      
      // Include original error message in thrown error for better debugging
      throw new Error(errorInfo.userMessage);
    } finally {
      setIsLoading(false);
    }
  }, [connectedAddress, walletClient, getSDK]);

  /**
   * Cancel message (owner only)
   */
  const cancelMessage = useCallback(async (txId: bigint): Promise<void> => {
    if (!connectedAddress || !walletClient) {
      throw new Error('Wallet not connected');
    }

    const sdk = getSDK();
    if (!sdk) {
      throw new Error('SDK not initialized');
    }

    setIsLoading(true);
    setError(null);

    try {
      await retryWithBackoff(async () => {
        return await sdk.cancelMessage(txId, { from: connectedAddress });
      });
    } catch (err: unknown) {
      const errorInfo = handleContractError(err);
      setError(errorInfo.userMessage);
      throw new Error(errorInfo.userMessage);
    } finally {
      setIsLoading(false);
    }
  }, [connectedAddress, walletClient, getSDK]);

  /**
   * Sign meta-transaction for approval (owner signs, stores in localStorage)
   */
  const signMetaTransaction = useCallback(async (
    txId: bigint
  ): Promise<void> => {
    if (!connectedAddress || !walletClient || !messengerAddress || !publicClient || !chain) {
      throw new Error('Wallet not connected or SDK not initialized');
    }

    setIsLoading(true);
    setError(null);

    try {
      const sdk = getSDK();
      if (!sdk) {
        throw new Error('SDK not initialized');
      }

      // Get transaction record (for validation, not used directly in signing)
      await sdk.getTransaction(txId);

      // Get signer nonce
      const nonce = await sdk.getSignerNonce(connectedAddress);

      // Create meta-transaction parameters
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now
      const maxGasPrice = BigInt(100_000_000_000); // 100 gwei

      const metaTxParams = MetaTransactionBuilder.createMetaTxParams(
        messengerAddress,
        APPROVE_MESSAGE_META_SELECTOR,
        TxAction.SIGN_META_APPROVE,
        deadline,
        maxGasPrice,
        connectedAddress,
        BigInt(chainId),
        nonce
      );

      // Create unsigned meta-transaction
      const signer = new MetaTransactionSigner(
        publicClient,
        walletClient,
        messengerAddress,
        chain
      );

      const unsignedMetaTx = await signer.createUnsignedMetaTransactionForExisting(
        txId,
        metaTxParams
      );

      // Sign with wallet
      // For wallet signing, we need to use personal_sign
      // The message hash is in unsignedMetaTx.message
      const signature = await walletClient.signMessage({
        message: { raw: unsignedMetaTx.message },
      });

      // Create signed meta-transaction
      const signedMetaTx = await signer.createSignedMetaTransactionWithSignature(
        unsignedMetaTx,
        signature
      );

      // Store in localStorage
      storeSignedMetaTx(txId, signedMetaTx, {
        contractAddress: messengerAddress,
        chainId,
        operationType: 'SEND_MESSAGE',
        signerAddress: connectedAddress,
      });

      setError(null);
    } catch (err: unknown) {
      const errorInfo = handleContractError(err);
      setError(errorInfo.userMessage);
      throw new Error(errorInfo.userMessage);
    } finally {
      setIsLoading(false);
    }
  }, [connectedAddress, walletClient, messengerAddress, publicClient, chain, chainId, getSDK]);

  /**
   * Broadcast signed meta-transaction (broadcaster only)
   */
  const broadcastMetaTransaction = useCallback(async (
    txId: bigint,
    routingFee: bigint = 0n
  ): Promise<void> => {
    if (!connectedAddress || !walletClient) {
      throw new Error('Wallet not connected');
    }

    const sdk = getSDK();
    if (!sdk) {
      throw new Error('SDK not initialized');
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get signed meta-transaction from localStorage
      const stored = getSignedMetaTx(txId);
      if (!stored) {
        throw new Error('Signed meta-transaction not found. Please sign it first.');
      }

      // Check if expired
      if (stored.metadata.expiresAt < Date.now()) {
        removeSignedMetaTx(txId);
        throw new Error('Signed meta-transaction has expired. Please sign again.');
      }

      // Broadcast the meta-transaction
      await retryWithBackoff(async () => {
        return await sdk.approveMessageWithMetaTx(
          stored.signedMetaTx,
          routingFee,
          { from: connectedAddress }
        );
      });

      // Remove from localStorage after successful broadcast
      removeSignedMetaTx(txId);

      setError(null);
    } catch (err: unknown) {
      const errorInfo = handleContractError(err);
      setError(errorInfo.userMessage);
      throw new Error(errorInfo.userMessage);
    } finally {
      setIsLoading(false);
    }
  }, [connectedAddress, walletClient, getSDK]);

  return {
    sendMessageRequest,
    cancelMessage,
    signMetaTransaction,
    broadcastMetaTransaction,
    isLoading,
    error,
  };
}

