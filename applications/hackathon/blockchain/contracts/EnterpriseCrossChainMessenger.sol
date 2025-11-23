// SPDX-License-Identifier: Custom
pragma solidity ^0.8.25;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// Bloxchain imports
import "../../../../contracts/core/access/SecureOwnable.sol";
import "../../../../contracts/utils/SharedValidation.sol";
import "../../../../contracts/interfaces/IDefinition.sol";
import "./utils/MessengerDefinitions.sol";

import "./HybridOrchestrationRouter.sol";
import "./utils/MessageRequirements.sol";
import "./utils/ChainRegistry.sol";

/**
 * @title EnterpriseCrossChainMessenger
 * @notice Simplified cross-chain messaging system for POC
 * @dev Demonstrates smart routing between EIL native bridges and LayerZero
 *      based on message requirements. Message-only (no token transfers).
 * 
 * Features:
 * - Smart routing: EIL native bridges (cost-effective, L1↔L2) vs LayerZero (universal, fast)
 * - Requirement-based routing: Cost, speed, security, chain support
 * - Message tracking and status
 * - Bidirectional messaging support
 * - Bloxchain security: Multi-signature workflows, time-locked operations, secure ownership
 * 
 * @custom:security-contact security@particlecrypto.com
 */
contract EnterpriseCrossChainMessenger is SecureOwnable {
    using MessageRequirements for MessageRequirements.Requirements;
    using SharedValidation for *;
    
    // ============ Errors ============
    
    error InvalidChainId(uint256 chainId);
    error MessageNotFound(bytes32 messageId);
    error InvalidMessageStatus(bytes32 messageId, MessageStatus expected, MessageStatus actual);
    error UnauthorizedRouter(address caller);
    
    // ============ Types ============
    
    enum MessageStatus {
        PENDING,      // Message sent, waiting for delivery
        DELIVERED,    // Message received on destination
        FAILED,       // Message delivery failed
        PROCESSED     // Message processed on destination
    }
    
    struct CrossChainMessage {
        uint256 sourceChainId;
        uint256 targetChainId;
        address sender;
        bytes payload;
        MessageStatus status;
        bytes32 messageId;
        bytes32 routingProtocol; // "EIL" or "LAYERZERO"
        uint256 sentAt;
        uint256 deliveredAt;
        MessageRequirements.SecurityLevel securityLevel;
    }
    
    // ============ State ============
    
    HybridOrchestrationRouter public router;
    ChainRegistry public chainRegistry;
    
    // Message tracking
    mapping(bytes32 => CrossChainMessage) public messages;
    mapping(bytes32 => bytes32) public messageIdToProtocol; // messageId => protocol identifier
    
    // Message counter for unique IDs
    uint256 private _messageCounter;
    
    // ============ Events ============
    
    event MessageSent(
        bytes32 indexed messageId,
        uint256 indexed sourceChainId,
        uint256 indexed targetChainId,
        address sender,
        bytes32 routingProtocol,
        MessageRequirements.SecurityLevel securityLevel
    );
    
    event MessageDelivered(
        bytes32 indexed messageId,
        uint256 indexed targetChainId,
        uint256 deliveredAt
    );
    
    event MessageProcessed(
        bytes32 indexed messageId,
        uint256 indexed targetChainId,
        bytes result
    );
    
    event MessageFailed(
        bytes32 indexed messageId,
        uint256 indexed targetChainId,
        string reason
    );
    
    // ============ Initialization ============
    
    /**
     * @notice Initialize the contract
     * @param initialOwner Initial owner address
     * @param broadcaster Broadcaster address
     * @param recovery Recovery address
     * @param timeLockPeriodSec Time lock period in seconds
     * @param eventForwarder Event forwarder address
     * @param _router Hybrid orchestration router
     * @param _chainRegistry Chain registry
     */
    function initialize(
        address initialOwner,
        address broadcaster,
        address recovery,
        uint256 timeLockPeriodSec,
        address eventForwarder,
        address _router,
        address _chainRegistry
    ) public initializer {
        // Initialize SecureOwnable
        SecureOwnable.initialize(
            initialOwner,
            broadcaster,
            recovery,
            timeLockPeriodSec,
            eventForwarder
        );
        
        // Validate and set integration contracts
        require(_router != address(0), "Invalid router");
        require(_chainRegistry != address(0), "Invalid chain registry");
        
        router = HybridOrchestrationRouter(_router);
        chainRegistry = ChainRegistry(_chainRegistry);
        
        // Load Messenger-specific definitions
        IDefinition.RolePermission memory permissions = 
            MessengerDefinitions.getRolePermissions();
        _loadDefinitions(
            MessengerDefinitions.getFunctionSchemas(),
            permissions.roleHashes,
            permissions.functionPermissions
        );
    }
    
    // ============ Message Sending (Bloxchain Workflow) ============
    
    /**
     * @notice Request to send a cross-chain message (time-delayed operation)
     * @dev Only owner can request. Creates a time-locked transaction that must be approved.
     *      Routing decision (EIL native bridge vs LayerZero) is automatically determined
     *      based on the MessageRequirements parameters.
     * 
     * @param targetChainId Target chain ID
     * @param payload Message payload (arbitrary bytes)
     * @param req Message requirements for routing decision
     * @return txRecord Transaction record with txId
     */
    function sendMessageRequest(
        uint256 targetChainId,
        bytes memory payload,
        MessageRequirements.Requirements memory req
    ) external onlyOwner payable returns (StateAbstraction.TxRecord memory) {
        require(chainRegistry.isChainRegistered(targetChainId), "Chain not registered");
        require(payload.length > 0, "Empty payload");
        
        // Create execution options with message parameters
        bytes memory executionOptions = _createMessageExecutionOptions(
            targetChainId,
            payload,
            req
        );
        
        // Request time-delayed transaction
        StateAbstraction.TxRecord memory txRecord = _requestStandardTransaction(
            msg.sender,
            address(this),
            msg.value, // Forward ETH for routing fees
            MessengerDefinitions.SEND_MESSAGE,
            MessengerDefinitions.SEND_MESSAGE_SELECTOR,
            executionOptions
        );
        
        return txRecord;
    }
    
    /**
     * @notice Approve a pending message with meta-transaction (only broadcaster can execute)
     * @dev Can only approve BEFORE the time delay expires. After time delay, message cannot be approved.
     * @param metaTx Meta transaction data
     * @return txRecord Updated transaction record
     */
    function approveMessageWithMetaTx(StateAbstraction.MetaTransaction memory metaTx) 
        external 
        onlyBroadcaster 
        returns (StateAbstraction.TxRecord memory) 
    {
        // Check that time delay has NOT expired yet
        StateAbstraction.TxRecord memory txRecord = metaTx.txRecord;
        require(
            block.timestamp < txRecord.releaseTime,
            "Cannot approve after time delay expired"
        );
        
        return _approveTransactionWithMetaTx(
            metaTx,
            txRecord.params.operationType,
            MessengerDefinitions.APPROVE_MESSAGE_META_SELECTOR,
            StateAbstraction.TxAction.EXECUTE_META_APPROVE
        );
    }
    
    /**
     * @notice Cancel a pending message request (only owner)
     * @param txId The transaction ID to cancel
     * @return txRecord Updated transaction record
     */
    function cancelMessage(uint256 txId) external onlyOwner returns (StateAbstraction.TxRecord memory) {
        StateAbstraction.TxRecord memory existing = getTransaction(txId);
        StateAbstraction.TxRecord memory updated = _cancelTransaction(txId, existing.params.operationType);
        return updated;
    }
    
    /**
     * @notice Execute sending a message (internal execution function)
     * @dev Called by the state machine after approval
     * @param targetChainId Target chain ID
     * @param payload Message payload
     * @param req Message requirements
     */
    function executeSendMessage(
        uint256 targetChainId,
        bytes memory payload,
        MessageRequirements.Requirements memory req
    ) external payable {
        SharedValidation.validateInternalCallInternal(address(this));
        _sendMessage(targetChainId, payload, req);
    }
    
    /**
     * @notice Internal function to actually send the message
     * @param targetChainId Target chain ID
     * @param payload Message payload
     * @param req Message requirements
     * @return messageId Unique message identifier
     */
    function _sendMessage(
        uint256 targetChainId,
        bytes memory payload,
        MessageRequirements.Requirements memory req
    ) internal returns (bytes32 messageId) {
        // Generate unique message ID
        messageId = keccak256(abi.encodePacked(
            block.chainid,
            targetChainId,
            msg.sender,
            payload,
            block.timestamp,
            _messageCounter++
        ));
        
        // Determine routing protocol based on requirements
        uint256[] memory nativeBridgeChains = router.getNativeBridgeChains();
        bool useNativeBridge = MessageRequirements.shouldUseNativeBridge(
            targetChainId,
            req,
            nativeBridgeChains
        );
        
        bytes32 protocolId = useNativeBridge 
            ? keccak256("EIL") 
            : keccak256("LAYERZERO");
        
        // Encode message with metadata
        bytes memory messagePayload = abi.encode(
            messageId,
            block.chainid,
            owner(), // Use owner as sender (since owner requested it)
            payload,
            req.securityLevel
        );
        
        // Route message via HybridOrchestrationRouter
        // Router will automatically choose EIL native bridge or LayerZero based on requirements
        bytes32 routedMessageId = router.routeMessage{value: msg.value}(
            targetChainId,
            messagePayload,
            req
        );
        
        // Store message
        messages[messageId] = CrossChainMessage({
            sourceChainId: block.chainid,
            targetChainId: targetChainId,
            sender: owner(),
            payload: payload,
            status: MessageStatus.PENDING,
            messageId: messageId,
            routingProtocol: protocolId,
            sentAt: block.timestamp,
            deliveredAt: 0,
            securityLevel: req.securityLevel
        });
        
        messageIdToProtocol[messageId] = protocolId;
        
        emit MessageSent(
            messageId,
            block.chainid,
            targetChainId,
            owner(),
            protocolId,
            req.securityLevel
        );
    }
    
    /**
     * @notice Create execution options for message sending
     * @param targetChainId Target chain ID
     * @param payload Message payload
     * @param req Message requirements
     * @return executionOptions Encoded execution options
     */
    function _createMessageExecutionOptions(
        uint256 targetChainId,
        bytes memory payload,
        MessageRequirements.Requirements memory req
    ) internal pure returns (bytes memory) {
        bytes memory executionData = abi.encode(
            targetChainId,
            payload,
            req
        );
        
        return StateAbstraction.createStandardExecutionOptions(
            MessengerDefinitions.SEND_MESSAGE_SELECTOR,
            executionData
        );
    }
    
    // ============ Message Receiving ============
    
    /**
     * @notice Handle incoming message from HybridOrchestrationRouter
     * @dev Called by router when message is received via LayerZero or EIL native bridge
     * @param sourceChainId Source chain ID
     * @param messagePayload Encoded message with metadata
     */
    function handleIncomingMessage(
        uint256 sourceChainId,
        bytes memory messagePayload
    ) external {
        require(msg.sender == address(router), "Unauthorized router");
        
        // Decode message
        (
            bytes32 messageId,
            uint256 originalSourceChainId,
            address originalSender,
            bytes memory payload,
            MessageRequirements.SecurityLevel securityLevel
        ) = abi.decode(messagePayload, (bytes32, uint256, address, bytes, MessageRequirements.SecurityLevel));
        
        // Verify source chain matches
        require(sourceChainId == originalSourceChainId, "Source chain mismatch");
        
        // Check if message already exists (idempotency)
        if (messages[messageId].status != MessageStatus.PENDING) {
            // Message already processed, but we can still emit event
            emit MessageDelivered(messageId, block.chainid, block.timestamp);
            return;
        }
        
        // Update message status
        CrossChainMessage storage message = messages[messageId];
        message.status = MessageStatus.DELIVERED;
        message.deliveredAt = block.timestamp;
        
        emit MessageDelivered(messageId, block.chainid, block.timestamp);
    }
    
    /**
     * @notice Process a delivered message (execute payload)
     * @param messageId Message ID to process
     * @param targetContract Target contract address (optional, can be address(0))
     * @param callData Calldata to execute (optional, can be empty)
     * @return success Whether processing succeeded
     * @return result Return data from execution
     */
    function processMessage(
        bytes32 messageId,
        address targetContract,
        bytes memory callData
    ) external returns (bool success, bytes memory result) {
        CrossChainMessage storage message = messages[messageId];
        
        require(message.status == MessageStatus.DELIVERED, "Message not delivered");
        
        // If target contract is provided, execute call
        if (targetContract != address(0) && callData.length > 0) {
            (success, result) = targetContract.call(callData);
            require(success, "Message processing failed");
        }
        
        // Update status
        message.status = MessageStatus.PROCESSED;
        
        emit MessageProcessed(messageId, block.chainid, result);
        
        return (success, result);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get message details (only owner)
     * @param messageId Message ID
     * @return message Message details
     */
    function getMessage(bytes32 messageId) external view onlyOwner returns (CrossChainMessage memory) {
        CrossChainMessage memory message = messages[messageId];
        require(message.sender != address(0), "Message not found");
        return message;
    }
    
    /**
     * @notice Get routing protocol for a message
     * @param messageId Message ID
     * @return protocol Protocol identifier ("EIL" or "LAYERZERO")
     */
    function getMessageProtocol(bytes32 messageId) external view returns (bytes32) {
        bytes32 protocol = messageIdToProtocol[messageId];
        require(protocol != bytes32(0), "Message not found");
        return protocol;
    }
    
    /**
     * @notice Check if message was routed via EIL
     * @param messageId Message ID
     * @return True if routed via EIL native bridge
     */
    function isEILMessage(bytes32 messageId) external view returns (bool) {
        bytes32 protocol = messageIdToProtocol[messageId];
        return protocol == keccak256("EIL");
    }
    
    /**
     * @notice Check if message was routed via LayerZero
     * @param messageId Message ID
     * @return True if routed via LayerZero
     */
    function isLayerZeroMessage(bytes32 messageId) external view returns (bool) {
        bytes32 protocol = messageIdToProtocol[messageId];
        return protocol == keccak256("LAYERZERO");
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Update router address (only owner)
     * @param _router New router address
     */
    function setRouter(address _router) external onlyOwner {
        require(_router != address(0), "Invalid router");
        router = HybridOrchestrationRouter(_router);
    }
    
    /**
     * @notice Update chain registry address (only owner)
     * @param _chainRegistry New chain registry address
     */
    function setChainRegistry(address _chainRegistry) external onlyOwner {
        require(_chainRegistry != address(0), "Invalid chain registry");
        chainRegistry = ChainRegistry(_chainRegistry);
    }
}

