// SPDX-License-Identifier: Custom
pragma solidity ^0.8.25;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

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
contract EnterpriseCrossChainMessenger is SecureOwnable, UUPSUpgradeable {
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
    mapping(bytes32 => CrossChainMessage) private messages;
    mapping(bytes32 => bytes32) public messageIdToProtocol; // messageId => protocol identifier
    
    // Message counter for unique IDs
    uint256 private _messageCounter;
    
    // Routing fee tracking (messageKey => fee amount paid by broadcaster)
    // messageKey is hash of (targetChainId, payload, req) to link approval to execution
    mapping(bytes32 => uint256) public routingFees;
    
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
     * @dev Time lock period is hardcoded to 5 minutes (300 seconds)
     *      Event forwarder is disabled (address(0))
     * @param initialOwner Initial owner address
     * @param broadcaster Broadcaster address
     * @param recovery Recovery address
     * @param _router Hybrid orchestration router
     * @param _chainRegistry Chain registry
     */
    function initialize(
        address initialOwner,
        address broadcaster,
        address recovery,
        address _router,
        address _chainRegistry
    ) public initializer {
        // Initialize SecureOwnable with hardcoded values
        // Time lock period: 5 minutes (300 seconds)
        // Event forwarder: disabled (address(0))
        SecureOwnable.initialize(
            initialOwner,
            broadcaster,
            recovery,
            300, // 5 minutes in seconds
            address(0) // Event forwarder disabled
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
    
    // ============ UUPS Upgrade Authorization ============
    
    /**
     * @notice Authorize upgrade (UUPS pattern)
     * @dev Only owner can authorize upgrades
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    // ============ Message Sending (Bloxchain Workflow) ============
    
    /**
     * @notice Request to send a cross-chain message (time-delayed operation)
     * @dev Only owner can request. Creates a time-locked transaction that must be approved.
     *      Routing decision (EIL native bridge vs LayerZero) is automatically determined
     *      based on the MessageRequirements parameters.
     *      Note: Owner does not pay routing fees - broadcaster will pay when approving.
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
    ) external onlyOwner returns (StateAbstraction.TxRecord memory) {
        require(chainRegistry.isChainRegistered(targetChainId), "Chain not registered");
        require(payload.length > 0, "Empty payload");
        
        // Create execution options with message parameters
        bytes memory executionOptions = _createMessageExecutionOptions(
            targetChainId,
            payload,
            req
        );
        
        // Request time-delayed transaction (no value - broadcaster will pay fees)
        StateAbstraction.TxRecord memory txRecord = _requestStandardTransaction(
            msg.sender,
            address(this),
            0, // No ETH from owner - broadcaster pays routing fees
            MessengerDefinitions.SEND_MESSAGE,
            MessengerDefinitions.SEND_MESSAGE_SELECTOR,
            executionOptions
        );
        
        return txRecord;
    }
    
    /**
     * @notice Approve a pending message with meta-transaction (only broadcaster can execute)
     * @dev Can only approve BEFORE the time delay expires. After time delay, message cannot be approved.
     *      Broadcaster must send ETH to cover routing fees (LayerZero/EIL native bridge).
     * @param metaTx Meta transaction data
     * @return txRecord Updated transaction record
     */
    function approveMessageWithMetaTx(StateAbstraction.MetaTransaction memory metaTx) 
        external 
        payable
        onlyBroadcaster 
        returns (StateAbstraction.TxRecord memory) 
    {
        // Check that time delay has NOT expired yet
        StateAbstraction.TxRecord memory txRecord = metaTx.txRecord;
        require(
            block.timestamp < txRecord.releaseTime,
            "Cannot approve after time delay expired"
        );
        
        // Decode execution options to get message parameters
        // Execution options are wrapped in StandardExecutionOptions struct
        StateAbstraction.StandardExecutionOptions memory options = abi.decode(
            txRecord.params.executionOptions,
            (StateAbstraction.StandardExecutionOptions)
        );
        
        // Decode the actual parameters
        (uint256 targetChainId, bytes memory payload, MessageRequirements.Requirements memory req) = 
            abi.decode(
                options.params,
                (uint256, bytes, MessageRequirements.Requirements)
            );
        
        // Create message key to link approval fee to execution
        bytes32 messageKey = keccak256(abi.encode(
            block.chainid,
            targetChainId,
            payload,
            req
        ));
        
        // Store routing fee paid by broadcaster (will be used during execution)
        routingFees[messageKey] = msg.value;
        
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
     *      Uses routing fees stored by broadcaster during approval
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
        
        // Create message key to retrieve stored routing fee (same as in approveMessageWithMetaTx)
        bytes32 messageKey = keccak256(abi.encode(
            block.chainid,
            targetChainId,
            payload,
            req
        ));
        
        // Retrieve routing fee stored by broadcaster during approval
        uint256 storedFee = routingFees[messageKey];
        require(storedFee > 0, "Routing fee not provided by broadcaster");
        
        // Clear the stored fee to prevent reuse
        delete routingFees[messageKey];
        
        // Send message with broadcaster's fee
        _sendMessageWithFee(targetChainId, payload, req, storedFee);
    }
    
    /**
     * @notice Internal function to actually send the message with fee
     * @param targetChainId Target chain ID
     * @param payload Message payload
     * @param req Message requirements
     * @param fee Routing fee to use
     * @return messageId Unique message identifier
     */
    function _sendMessageWithFee(
        uint256 targetChainId,
        bytes memory payload,
        MessageRequirements.Requirements memory req,
        uint256 fee
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
        // Use the fee provided (from broadcaster)
        bytes32 routedMessageId = router.routeMessage{value: fee}(
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
    
    /**
     * @notice Internal function to actually send the message (wrapper for backward compatibility)
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
        // Use msg.value as fee (for backward compatibility, though should be 0)
        return _sendMessageWithFee(targetChainId, payload, req, msg.value);
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
        // Use sender check instead of status, since status defaults to PENDING (0)
        if (messages[messageId].sender != address(0)) {
            // Message already exists, update status if still pending
            if (messages[messageId].status == MessageStatus.PENDING) {
                messages[messageId].status = MessageStatus.DELIVERED;
                messages[messageId].deliveredAt = block.timestamp;
            }
            emit MessageDelivered(messageId, block.chainid, block.timestamp);
            return;
        }
        
        // Create message on destination chain (message doesn't exist yet)
        messages[messageId] = CrossChainMessage({
            sourceChainId: originalSourceChainId,
            targetChainId: block.chainid, // This is the destination chain
            sender: originalSender,
            payload: payload,
            status: MessageStatus.DELIVERED,
            messageId: messageId,
            routingProtocol: bytes32(0), // Protocol info not available on destination
            sentAt: 0, // Sent timestamp not available on destination
            deliveredAt: block.timestamp,
            securityLevel: securityLevel
        });
        
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
     * @notice Get message details (only owner on destination chain)
     * @dev Can only view messages on the destination chain where they were delivered
     * @param messageId Message ID
     * @return message Message details
     */
    function getMessage(bytes32 messageId) external view onlyOwner returns (CrossChainMessage memory) {
        CrossChainMessage memory message = messages[messageId];
        require(message.sender != address(0), "Message not found");
        // Only allow viewing on the destination chain
        require(
            message.targetChainId == block.chainid,
            "Message can only be viewed on destination chain"
        );
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

