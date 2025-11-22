// SPDX-License-Identifier: Custom
pragma solidity ^0.8.25;

/**
 * @title MessageRequirements
 * @notice Struct for routing decisions between EIL native bridges and LayerZero
 */
library MessageRequirements {
    /**
     * @notice Message requirements for routing decisions
     * @param requiresFastFinality Whether fast finality is required (use LayerZero)
     * @param requiresGuaranteedDelivery Whether guaranteed delivery is required (use LayerZero executor)
     * @param isCostSensitive Whether operation is cost-sensitive (prefer EIL native)
     * @param isMultiChain Whether operation spans multiple chains (use LayerZero)
     * @param maxDelay Maximum acceptable delay in seconds
     * @param amount Transfer amount (for threshold-based decisions)
     */
    struct Requirements {
        bool requiresFastFinality;
        bool requiresGuaranteedDelivery;
        bool isCostSensitive;
        bool isMultiChain;
        uint256 maxDelay;
        uint256 amount;
    }
    
    /**
     * @notice Determine if native bridge should be used
     * @param chainId Target chain ID
     * @param req Message requirements
     * @param nativeBridgeChains Array of chain IDs that support native bridges
     * @return True if native bridge should be used
     */
    function shouldUseNativeBridge(
        uint256 chainId,
        Requirements memory req,
        uint256[] memory nativeBridgeChains
    ) internal pure returns (bool) {
        // Must be a native bridge chain
        bool isNativeBridgeChain = false;
        for (uint256 i = 0; i < nativeBridgeChains.length; i++) {
            if (nativeBridgeChains[i] == chainId) {
                isNativeBridgeChain = true;
                break;
            }
        }
        
        if (!isNativeBridgeChain) {
            return false; // Must use LayerZero for non-native chains
        }
        
        // If fast finality required, use LayerZero
        if (req.requiresFastFinality) {
            return false;
        }
        
        // If guaranteed delivery required, use LayerZero executor
        if (req.requiresGuaranteedDelivery) {
            return false;
        }
        
        // If multi-chain, use LayerZero
        if (req.isMultiChain) {
            return false;
        }
        
        // If can tolerate delay and cost-sensitive, use native bridge
        if (req.isCostSensitive && req.maxDelay >= 7 days) {
            return true;
        }
        
        // Default: use LayerZero for better UX
        return false;
    }
    
    /**
     * @notice Create default requirements for cost-sensitive operations
     */
    function createCostSensitiveRequirements(
        uint256 amount,
        uint256 maxDelay
    ) internal pure returns (Requirements memory) {
        return Requirements({
            requiresFastFinality: false,
            requiresGuaranteedDelivery: false,
            isCostSensitive: true,
            isMultiChain: false,
            maxDelay: maxDelay,
            amount: amount
        });
    }
    
    /**
     * @notice Create default requirements for time-sensitive operations
     */
    function createTimeSensitiveRequirements(
        uint256 amount
    ) internal pure returns (Requirements memory) {
        return Requirements({
            requiresFastFinality: true,
            requiresGuaranteedDelivery: true,
            isCostSensitive: false,
            isMultiChain: false,
            maxDelay: 1 hours,
            amount: amount
        });
    }
    
    /**
     * @notice Create default requirements for multi-chain operations
     */
    function createMultiChainRequirements(
        uint256 amount
    ) internal pure returns (Requirements memory) {
        return Requirements({
            requiresFastFinality: true,
            requiresGuaranteedDelivery: true,
            isCostSensitive: false,
            isMultiChain: true,
            maxDelay: 1 hours,
            amount: amount
        });
    }
}

