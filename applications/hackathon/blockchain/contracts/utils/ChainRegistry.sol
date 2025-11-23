// SPDX-License-Identifier: Custom
pragma solidity ^0.8.25;

/**
 * @title ChainRegistry
 * @notice Registry for mapping chain IDs to LayerZero endpoint IDs
 * @dev Provides chain ID to endpoint ID conversion for LayerZero
 */
contract ChainRegistry {
    // ============ Errors ============
    
    error ChainNotRegistered(uint256 chainId);
    error InvalidEndpointId(uint32 eid);
    error ChainAlreadyRegistered(uint256 chainId);
    
    // ============ State ============
    
    mapping(uint256 => uint32) public chainIdToEid;
    mapping(uint32 => uint256) public eidToChainId;
    uint256[] public registeredChains;
    
    // ============ Events ============
    
    event ChainRegistered(uint256 indexed chainId, uint32 indexed eid);
    event ChainUnregistered(uint256 indexed chainId, uint32 indexed eid);
    
    // ============ Functions ============
    
    /**
     * @notice Register a chain ID to endpoint ID mapping
     * @param chainId The chain ID
     * @param eid The LayerZero endpoint ID
     */
    function registerChain(uint256 chainId, uint32 eid) external {
        require(chainIdToEid[chainId] == 0, "Chain already registered");
        require(eidToChainId[eid] == 0, "Endpoint ID already registered");
        
        chainIdToEid[chainId] = eid;
        eidToChainId[eid] = chainId;
        registeredChains.push(chainId);
        
        emit ChainRegistered(chainId, eid);
    }
    
    /**
     * @notice Unregister a chain
     * @param chainId The chain ID to unregister
     */
    function unregisterChain(uint256 chainId) external {
        uint32 eid = chainIdToEid[chainId];
        require(eid != 0, "Chain not registered");
        
        delete chainIdToEid[chainId];
        delete eidToChainId[eid];
        
        // Remove from array
        for (uint256 i = 0; i < registeredChains.length; i++) {
            if (registeredChains[i] == chainId) {
                registeredChains[i] = registeredChains[registeredChains.length - 1];
                registeredChains.pop();
                break;
            }
        }
        
        emit ChainUnregistered(chainId, eid);
    }
    
    /**
     * @notice Get endpoint ID for chain ID
     * @param chainId The chain ID
     * @return eid The endpoint ID
     */
    function getEndpointId(uint256 chainId) external view returns (uint32 eid) {
        eid = chainIdToEid[chainId];
        if (eid == 0) {
            revert ChainNotRegistered(chainId);
        }
        return eid;
    }
    
    /**
     * @notice Get chain ID for endpoint ID
     * @param eid The endpoint ID
     * @return chainId The chain ID
     */
    function getChainId(uint32 eid) external view returns (uint256 chainId) {
        chainId = eidToChainId[eid];
        if (chainId == 0) {
            revert InvalidEndpointId(eid);
        }
        return chainId;
    }
    
    /**
     * @notice Check if chain is registered
     * @param chainId The chain ID
     * @return True if registered
     */
    function isChainRegistered(uint256 chainId) external view returns (bool) {
        return chainIdToEid[chainId] != 0;
    }
    
    /**
     * @notice Get all registered chains
     * @return Array of chain IDs
     */
    function getAllRegisteredChains() external view returns (uint256[] memory) {
        return registeredChains;
    }
}

