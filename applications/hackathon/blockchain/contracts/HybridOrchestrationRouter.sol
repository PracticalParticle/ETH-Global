// SPDX-License-Identifier: Custom
pragma solidity ^0.8.25;

import "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppSender.sol";
import "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppReceiver.sol";
import "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";

import "./utils/MessageRequirements.sol";
import "./utils/ChainRegistry.sol";
import "./interfaces/IEILIntegration.sol";

/**
 * @title HybridOrchestrationRouter
 * @notice Smart router that chooses between EIL native bridges and LayerZero
 * @dev Routes messages based on requirements: cost, speed, chain support
 * 
 * Routing Logic:
 * - EIL Native Bridges: Cost-sensitive, L1↔L2, can tolerate 7-day delay
 * - LayerZero: Time-sensitive, guaranteed delivery, multi-chain, universal
 */
contract HybridOrchestrationRouter is OApp {
    using MessageRequirements for MessageRequirements.Requirements;
    
    // ============ Errors ============
    
    error InvalidChainId(uint256 chainId);
    error InvalidBridgeAddress(address bridge);
    error MessageRoutingFailed(uint256 chainId, bytes reason);
    
    // ============ State ============
    
    ChainRegistry public chainRegistry;
    
    // Native bridge connectors
    mapping(uint256 => address) public l1BridgeConnectors;  // chainId => L1 bridge
    mapping(uint256 => address) public l2BridgeConnectors;  // chainId => L2 bridge
    
    // Supported native bridge chains
    uint256[] public nativeBridgeChains;
    
    // Thresholds
    uint256 public constant LARGE_TRANSFER_THRESHOLD = 1_000_000 * 1e18; // 1M tokens
    uint256 public constant NATIVE_BRIDGE_DELAY = 7 days;
    
    // ============ Events ============
    
    event MessageRoutedViaNativeBridge(
        uint256 indexed chainId,
        bytes32 indexed messageId,
        bytes payload
    );
    
    event MessageRoutedViaLayerZero(
        uint32 indexed eid,
        bytes32 indexed guid,
        bytes payload
    );
    
    event NativeBridgeRegistered(uint256 indexed chainId, address l1Bridge, address l2Bridge);
    event NativeBridgeUnregistered(uint256 indexed chainId);
    
    // ============ Constructor ============
    
    constructor(
        address _endpoint,
        address _delegate,
        address _chainRegistry
    ) OApp(_endpoint, _delegate) {
        chainRegistry = ChainRegistry(_chainRegistry);
    }
    
    // ============ Configuration ============
    
    /**
     * @notice Register native bridge connectors for a chain
     * @param chainId The chain ID
     * @param l1Bridge L1 bridge connector address
     * @param l2Bridge L2 bridge connector address
     */
    function registerNativeBridge(
        uint256 chainId,
        address l1Bridge,
        address l2Bridge
    ) external onlyOwner {
        require(l1Bridge != address(0), "Invalid L1 bridge");
        require(l2Bridge != address(0), "Invalid L2 bridge");
        
        l1BridgeConnectors[chainId] = l1Bridge;
        l2BridgeConnectors[chainId] = l2Bridge;
        
        // Add to native bridge chains if not already present
        bool exists = false;
        for (uint256 i = 0; i < nativeBridgeChains.length; i++) {
            if (nativeBridgeChains[i] == chainId) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            nativeBridgeChains.push(chainId);
        }
        
        emit NativeBridgeRegistered(chainId, l1Bridge, l2Bridge);
    }
    
    /**
     * @notice Unregister native bridge
     * @param chainId The chain ID
     */
    function unregisterNativeBridge(uint256 chainId) external onlyOwner {
        delete l1BridgeConnectors[chainId];
        delete l2BridgeConnectors[chainId];
        
        // Remove from array
        for (uint256 i = 0; i < nativeBridgeChains.length; i++) {
            if (nativeBridgeChains[i] == chainId) {
                nativeBridgeChains[i] = nativeBridgeChains[nativeBridgeChains.length - 1];
                nativeBridgeChains.pop();
                break;
            }
        }
        
        emit NativeBridgeUnregistered(chainId);
    }
    
    // ============ Routing Functions ============
    
    /**
     * @notice Route message based on requirements
     * @param chainId Target chain ID
     * @param payload Message payload
     * @param req Message requirements
     * @return messageId Unique message identifier
     */
    function routeMessage(
        uint256 chainId,
        bytes memory payload,
        MessageRequirements.Requirements memory req
    ) external payable returns (bytes32 messageId) {
        if (MessageRequirements.shouldUseNativeBridge(chainId, req, nativeBridgeChains)) {
            return _routeViaNativeBridge(chainId, payload);
        } else {
            return _routeViaLayerZero(chainId, payload, req);
        }
    }
    
    /**
     * @notice Route via EIL native bridge
     * @param chainId Target chain ID
     * @param payload Message payload
     * @return messageId Message identifier
     */
    function _routeViaNativeBridge(
        uint256 chainId,
        bytes memory payload
    ) internal returns (bytes32 messageId) {
        address l2Bridge = l2BridgeConnectors[chainId];
        address l1Bridge = l1BridgeConnectors[chainId];
        
        require(l2Bridge != address(0), "Native bridge not registered");
        require(l1Bridge != address(0), "Native bridge not registered");
        
        messageId = keccak256(abi.encodePacked(chainId, payload, block.timestamp, msg.sender));
        
        // Encode envelope: (app, payload)
        bytes memory envelope = abi.encode(address(this), payload);
        
        // Encode forward call: forwardFromL2(target, envelope, gasLimit)
        bytes memory forwardCalldata = abi.encodeWithSignature(
            "forwardFromL2(address,bytes,uint256)",
            l1Bridge,
            envelope,
            200000 // gas limit
        );
        
        // Call L2 bridge to send message
        (bool success, bytes memory reason) = l2Bridge.call(
            abi.encodeWithSignature(
                "sendMessageToL1(address,bytes,uint256)",
                l1Bridge,
                forwardCalldata,
                200000
            )
        );
        
        if (!success) {
            revert MessageRoutingFailed(chainId, reason);
        }
        
        emit MessageRoutedViaNativeBridge(chainId, messageId, payload);
        return messageId;
    }
    
    /**
     * @notice Route via LayerZero
     * @param chainId Target chain ID
     * @param payload Message payload
     * @param req Message requirements
     * @return guid LayerZero message GUID
     */
    function _routeViaLayerZero(
        uint256 chainId,
        bytes memory payload,
        MessageRequirements.Requirements memory req
    ) internal returns (bytes32 guid) {
        uint32 eid = chainRegistry.getEndpointId(chainId);
        
        // Build options based on requirements
        bytes memory options = req.requiresGuaranteedDelivery
            ? _buildExecutorOptions()
            : _buildOptions();
        
        // Get peer address
        bytes32 receiver = _getPeerOrRevert(eid);
        
        // Quote fee
        MessagingFee memory fee = _quote(
            eid,
            payload,
            options,
            false // payInLzToken
        );
        
        // Send message
        MessagingReceipt memory receipt = _lzSend(
            eid,
            payload,
            options,
            fee,
            address(this)
        );
        
        guid = receipt.guid;
        
        emit MessageRoutedViaLayerZero(eid, guid, payload);
        return guid;
    }
    
    // ============ Helper Functions ============
    
    /**
     * @notice Build LayerZero options with executor
     * @return options Encoded options
     */
    function _buildExecutorOptions() internal pure returns (bytes memory) {
        // Simplified - in production, use proper OptionsBuilder
        // Executor option: optionType (uint16) = 1, gasLimit (uint128) = 200000
        // Note: Using uint128 for gas limit as per LayerZero v2 spec
        return abi.encodePacked(uint16(1), uint128(200000)); // executor option
    }
    
    /**
     * @notice Build standard LayerZero options
     * @return options Encoded options
     */
    function _buildOptions() internal pure returns (bytes memory) {
        return ""; // Empty options for standard delivery
    }
    
    /**
     * @notice Get all native bridge chains
     * @return Array of chain IDs
     */
    function getNativeBridgeChains() external view returns (uint256[] memory) {
        return nativeBridgeChains;
    }
    
    /**
     * @notice Check if chain supports native bridge
     * @param chainId Chain ID
     * @return True if supported
     */
    function supportsNativeBridge(uint256 chainId) external view returns (bool) {
        return l1BridgeConnectors[chainId] != address(0) && 
               l2BridgeConnectors[chainId] != address(0);
    }
    
    // ============ LayerZero Receiver ============
    
    /**
     * @notice Receive message from LayerZero
     * @param _origin Message origin
     * @param _guid Message GUID
     * @param _message Message payload
     * @param _executor Executor address
     * @param _extraData Extra data
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message,
        address _executor,
        bytes calldata _extraData
    ) internal override {
        // Messages are handled by EnterpriseCrossChainManager
        // This router just passes through
        // In production, you might want to emit events or handle routing here
    }
}

