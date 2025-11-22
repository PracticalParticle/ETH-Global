// SPDX-License-Identifier: Custom
pragma solidity ^0.8.25;

/**
 * @title MessageRequirements
 * @notice Struct for routing decisions between EIL native bridges and LayerZero
 */
library MessageRequirements {
    /**
     * @notice Security level for routing decisions
     */
    enum SecurityLevel {
        LOW,      // Standard security
        MEDIUM,   // Enhanced security
        HIGH,     // High security requirements
        CRITICAL  // Maximum security
    }
    
    /**
     * @notice Message requirements for routing decisions
     * @param requiresFastFinality Whether fast finality is required (use LayerZero)
     * @param requiresGuaranteedDelivery Whether guaranteed delivery is required (use LayerZero executor)
     * @param isCostSensitive Whether operation is cost-sensitive (prefer EIL native)
     * @param isMultiChain Whether operation spans multiple chains (use LayerZero)
     * @param maxDelay Maximum acceptable delay in seconds
     * @param amount Transfer amount (for threshold-based decisions)
     * @param requiresNativeSecurity Whether native bridge security is required (prefer EIL native)
     * @param requiresDisputeResolution Whether dispute resolution mechanisms are required (prefer EIL)
     * @param securityLevel Security level requirement (LOW, MEDIUM, HIGH, CRITICAL)
     */
    struct Requirements {
        bool requiresFastFinality;
        bool requiresGuaranteedDelivery;
        bool isCostSensitive;
        bool isMultiChain;
        uint256 maxDelay;
        uint256 amount;
        bool requiresNativeSecurity;
        bool requiresDisputeResolution;
        SecurityLevel securityLevel;
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
        
        // Security requirements take precedence
        // If native security required, prefer EIL native (if available)
        if (req.requiresNativeSecurity && isNativeBridgeChain) {
            // Only use native if we can tolerate the delay
            if (req.maxDelay >= 7 days || !req.requiresFastFinality) {
                return true;
            }
        }
        
        // If dispute resolution required, prefer EIL native
        if (req.requiresDisputeResolution && isNativeBridgeChain) {
            // Only use native if we can tolerate the delay
            if (req.maxDelay >= 7 days || !req.requiresFastFinality) {
                return true;
            }
        }
        
        // Critical security level may require native security even with delay
        if (req.securityLevel == SecurityLevel.CRITICAL && isNativeBridgeChain) {
            // For critical operations, prefer native security if delay is acceptable
            if (req.maxDelay >= 7 days || !req.requiresFastFinality) {
                return true;
            }
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
            amount: amount,
            requiresNativeSecurity: false,
            requiresDisputeResolution: false,
            securityLevel: SecurityLevel.LOW
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
            amount: amount,
            requiresNativeSecurity: false,
            requiresDisputeResolution: false,
            securityLevel: SecurityLevel.MEDIUM
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
            amount: amount,
            requiresNativeSecurity: false,
            requiresDisputeResolution: false,
            securityLevel: SecurityLevel.MEDIUM
        });
    }
    
    /**
     * @notice Create default requirements for security-sensitive operations
     * @param amount Transfer amount
     * @param maxDelay Maximum acceptable delay
     * @param securityLevel Security level requirement
     */
    function createSecuritySensitiveRequirements(
        uint256 amount,
        uint256 maxDelay,
        SecurityLevel securityLevel
    ) internal pure returns (Requirements memory) {
        bool requiresNative = securityLevel >= SecurityLevel.HIGH;
        bool requiresDispute = securityLevel >= SecurityLevel.HIGH;
        
        return Requirements({
            requiresFastFinality: false, // Security over speed
            requiresGuaranteedDelivery: true,
            isCostSensitive: false,
            isMultiChain: false,
            maxDelay: maxDelay,
            amount: amount,
            requiresNativeSecurity: requiresNative,
            requiresDisputeResolution: requiresDispute,
            securityLevel: securityLevel
        });
    }
    
    /**
     * @notice Create default requirements for critical operations
     * @param amount Transfer amount
     */
    function createCriticalSecurityRequirements(
        uint256 amount
    ) internal pure returns (Requirements memory) {
        return Requirements({
            requiresFastFinality: false, // Security is priority
            requiresGuaranteedDelivery: true,
            isCostSensitive: false,
            isMultiChain: false,
            maxDelay: 7 days, // Can wait for native security
            amount: amount,
            requiresNativeSecurity: true,
            requiresDisputeResolution: true,
            securityLevel: SecurityLevel.CRITICAL
        });
    }
}

