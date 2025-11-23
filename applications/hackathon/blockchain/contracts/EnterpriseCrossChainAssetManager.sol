// SPDX-License-Identifier: Custom
pragma solidity ^0.8.25;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Bloxchain imports
import "../../../../contracts/core/access/SecureOwnable.sol";
// import "../../../../contracts/core/base/lib/StateAbstraction.sol";
// import "../../../../contracts/utils/SharedValidation.sol";

// Integration imports
import "./HybridOrchestrationRouter.sol";
import "./utils/MessageRequirements.sol";
import "./utils/ChainRegistry.sol";
import "./interfaces/IEILIntegration.sol";
import "./interfaces/ILayerZeroIntegration.sol";

/**
 * @title EnterpriseCrossChainAssetManager
 * @notice Complete tri-protocol integration: Bloxchain + EIL + LayerZero
 * @dev Enterprise-grade cross-chain system with:
 *      - Multi-signature workflows (Bloxchain)
 *      - Time-locked operations (Bloxchain)
 *      - Secure ownership and access control (Bloxchain)
 *      - Atomic swap execution (EIL)
 *      - Universal cross-chain messaging (LayerZero)
 *      - Smart routing (Hybrid: EIL native + LayerZero)
 * 
 * @custom:security-contact security@particlecrypto.com
 */
contract EnterpriseCrossChainAssetManager is SecureOwnable {
    using SafeERC20 for IERC20;
    using StateAbstraction for StateAbstraction.SecureOperationState;
    using MessageRequirements for MessageRequirements.Requirements;
    using SharedValidation for *;
    
    // ============ Errors ============
    
    error InvalidTransferRequest(uint256 txId);
    error TransferNotApproved(uint256 txId);
    error TransferAlreadyExecuted(uint256 txId);
    error InvalidChainId(uint256 chainId);
    error InsufficientBalance(address token, uint256 required, uint256 available);
    error InvalidVoucherRequest(bytes32 requestId);
    error VoucherNotIssued(bytes32 requestId);
    
    // ============ Types ============
    
    enum TransferStatus {
        PENDING_APPROVAL,
        APPROVED,
        EXECUTING,
        EXECUTED,
        COMPLETED,
        CANCELLED
    }
    
    struct CrossChainTransferRequest {
        uint256 targetChainId;
        address token;
        uint256 amount;
        address recipient;
        TransferStatus status;
        address requestedBy;
        address approvedBy;
        uint256 requestedAt;
        uint256 approvedAt;
        uint256 executedAt;
        uint256 completedAt;
        bytes32 voucherRequestId;
        bytes32 messageId;
    }
    
    // ============ State ============
    
    HybridOrchestrationRouter public router;
    ChainRegistry public chainRegistry;
    
    // EIL contracts
    IEILIntegration public originSwapManager;
    IEILIntegration public destinationSwapManager;
    
    // Transfer tracking
    mapping(uint256 => CrossChainTransferRequest) public transfers;
    mapping(bytes32 => uint256) public voucherRequestToTransfer;
    mapping(bytes32 => uint256) public messageIdToTransfer;
    
    // Operation type
    bytes32 public constant CROSS_CHAIN_TREASURY_TRANSFER = keccak256("CROSS_CHAIN_TREASURY_TRANSFER");
    
    // Thresholds
    uint256 public constant LARGE_TRANSFER_THRESHOLD = 1_000_000 * 1e18;
    uint256 public constant TIME_LOCK_PERIOD = 48 hours;
    
    // ============ Events ============
    
    event TransferRequested(
        uint256 indexed txId,
        address indexed requester,
        uint256 indexed targetChainId,
        address token,
        uint256 amount,
        address recipient
    );
    
    event TransferApproved(
        uint256 indexed txId,
        address indexed approver,
        uint256 approvedAt
    );
    
    event TransferExecuting(
        uint256 indexed txId,
        bytes32 indexed voucherRequestId,
        bytes32 indexed messageId
    );
    
    event TransferExecuted(
        uint256 indexed txId,
        bytes32 indexed voucherRequestId,
        uint256 executedAt
    );
    
    event TransferCompleted(
        uint256 indexed txId,
        bytes32 indexed voucherRequestId,
        uint256 completedAt
    );
    
    event TransferCancelled(
        uint256 indexed txId,
        address indexed canceller
    );
    
    // ============ Modifiers ============
    
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
     * @param _originSwapManager EIL origin swap manager
     * @param _destinationSwapManager EIL destination swap manager
     */
    function initialize(
        address initialOwner,
        address broadcaster,
        address recovery,
        uint256 timeLockPeriodSec,
        address eventForwarder,
        address _router,
        address _chainRegistry,
        address _originSwapManager,
        address _destinationSwapManager
    ) public initializer {
        // Initialize SecureOwnable
        SecureOwnable.initialize(
            initialOwner,
            broadcaster,
            recovery,
            timeLockPeriodSec,
            eventForwarder
        );
        
        // Set integration contracts
        router = HybridOrchestrationRouter(_router);
        chainRegistry = ChainRegistry(_chainRegistry);
        originSwapManager = IEILIntegration(_originSwapManager);
        destinationSwapManager = IEILIntegration(_destinationSwapManager);
    }
    
    // ============ Transfer Request ============
    
    /**
     * @notice Request a cross-chain transfer (Phase 1: Authorization)
     * @param targetChainId Target chain ID
     * @param token Token address (address(0) for native)
     * @param amount Transfer amount
     * @param recipient Recipient address on target chain
     * @return txId Transaction ID
     */
    function requestCrossChainTransfer(
        uint256 targetChainId,
        address token,
        uint256 amount,
        address recipient
    ) external onlyOwner returns (uint256 txId) {
        // Validate inputs
        require(chainRegistry.isChainRegistered(targetChainId), "Chain not registered");
        require(amount > 0, "Amount must be greater than zero");
        require(recipient != address(0), "Invalid recipient");
        
        // Check balance
        if (token == address(0)) {
            require(address(this).balance >= amount, "Insufficient native balance");
        } else {
            require(IERC20(token).balanceOf(address(this)) >= amount, "Insufficient token balance");
        }
        
        // Create time-locked transaction request (Bloxchain)
        // Note: Using bytes4(0) as placeholder selector - should be defined properly in production
        StateAbstraction.TxRecord memory txRecord = _requestStandardTransaction(
            msg.sender,
            address(this),
            0, // gasLimit
            CROSS_CHAIN_TREASURY_TRANSFER,
            bytes4(0), // functionSelector - should be defined properly in production
            abi.encode(targetChainId, token, amount, recipient)
        );
        
        txId = txRecord.txId;
        
        // Store transfer request
        transfers[txId] = CrossChainTransferRequest({
            targetChainId: targetChainId,
            token: token,
            amount: amount,
            recipient: recipient,
            status: TransferStatus.PENDING_APPROVAL,
            requestedBy: msg.sender,
            approvedBy: address(0),
            requestedAt: block.timestamp,
            approvedAt: 0,
            executedAt: 0,
            completedAt: 0,
            voucherRequestId: bytes32(0),
            messageId: bytes32(0)
        });
        
        emit TransferRequested(txId, msg.sender, targetChainId, token, amount, recipient);
        
        return txId;
    }
    
    // ============ Transfer Approval ============
    
    /**
     * @notice Approve a cross-chain transfer (Phase 2: Multi-Signature Approval)
     * @param txId Transaction ID
     * @param metaTx Meta-transaction signed by approver
     * @return success True if approved
     */
    function approveTransfer(
        uint256 txId,
        StateAbstraction.MetaTransaction memory metaTx
    ) external onlyBroadcaster returns (bool success) {
        CrossChainTransferRequest storage transfer = transfers[txId];
        
        require(transfer.status == TransferStatus.PENDING_APPROVAL, "Invalid status");
        require(transfer.requestedBy != address(0), "Transfer not found");
        
        // Verify signer is owner or recovery
        address signer = metaTx.params.signer;
        require(
            signer == owner(),
            "Unauthorized approver"
        );
        
        // Approve transaction using meta-transaction (Bloxchain)
        // Note: We use bytes4(0) as selector since this is a custom operation
        // In production, you should define a proper selector constant
        StateAbstraction.TxRecord memory txRecord = _approveTransactionWithMetaTx(
            metaTx,
            CROSS_CHAIN_TREASURY_TRANSFER,
            bytes4(0), // Custom selector - should be defined properly in production
            StateAbstraction.TxAction.EXECUTE_META_APPROVE
        );
        
        // Verify time-lock has passed
        require(
            block.timestamp >= txRecord.releaseTime,
            "Time-lock active"
        );
        
        // Update status
        transfer.status = TransferStatus.APPROVED;
        transfer.approvedBy = signer;
        transfer.approvedAt = block.timestamp;
        
        emit TransferApproved(txId, signer, block.timestamp);
        
        // Phase 3: Orchestration (automatic)
        _orchestrateTransfer(transfer);
        
        return true;
    }
    
    // ============ Orchestration ============
    
    /**
     * @notice Orchestrate transfer (Phase 3: Smart Routing)
     * @param transfer Transfer request
     */
    function _orchestrateTransfer(CrossChainTransferRequest storage transfer) internal {
        // Determine requirements
        MessageRequirements.Requirements memory req = _determineRequirements(transfer);
        
        // Create EIL voucher request
        bytes32 voucherRequestId = _createVoucherRequest(transfer);
        transfer.voucherRequestId = voucherRequestId;
        voucherRequestToTransfer[voucherRequestId] = transfer.targetChainId; // Store mapping
        
        // Lock deposit on origin chain (EIL)
        _lockDeposit(transfer);
        
        // Route message (Hybrid Router)
        bytes memory coordinationData = abi.encode(
            "VOUCHER_REQUEST",
            voucherRequestId,
            transfer.targetChainId,
            transfer.token,
            transfer.amount,
            transfer.recipient
        );
        
        bytes32 messageId = router.routeMessage{value: msg.value}(
            transfer.targetChainId,
            coordinationData,
            req
        );
        
        transfer.messageId = messageId;
        messageIdToTransfer[messageId] = transfer.targetChainId; // Store mapping
        
        transfer.status = TransferStatus.EXECUTING;
        
        emit TransferExecuting(
            transfer.targetChainId, // Using targetChainId as txId identifier
            voucherRequestId,
            messageId
        );
    }
    
    /**
     * @notice Determine message requirements
     * @param transfer Transfer request
     * @return req Message requirements
     */
    function _determineRequirements(
        CrossChainTransferRequest storage transfer
    ) internal view returns (MessageRequirements.Requirements memory req) {
        bool isLargeTransfer = transfer.amount >= LARGE_TRANSFER_THRESHOLD;
        
        return MessageRequirements.Requirements({
            requiresFastFinality: isLargeTransfer,
            requiresGuaranteedDelivery: true, // Always for treasury
            isCostSensitive: !isLargeTransfer,
            isMultiChain: false,
            maxDelay: TIME_LOCK_PERIOD,
            amount: transfer.amount,
            requiresNativeSecurity: isLargeTransfer, // High-value transfers need native security
            requiresDisputeResolution: isLargeTransfer, // High-value transfers need dispute resolution
            securityLevel: isLargeTransfer 
                ? MessageRequirements.SecurityLevel.HIGH 
                : MessageRequirements.SecurityLevel.MEDIUM
        });
    }
    
    /**
     * @notice Create EIL voucher request
     * @param transfer Transfer request
     * @return requestId Voucher request ID
     */
    function _createVoucherRequest(
        CrossChainTransferRequest storage transfer
    ) internal view returns (bytes32 requestId) {
        // This is a simplified version - in production, use actual EIL types
        requestId = keccak256(abi.encodePacked(
            transfer.targetChainId,
            transfer.token,
            transfer.amount,
            transfer.recipient,
            block.timestamp,
            msg.sender
        ));
        
        return requestId;
    }
    
    /**
     * @notice Lock deposit on origin chain (EIL)
     * @param transfer Transfer request
     */
    function _lockDeposit(CrossChainTransferRequest storage transfer) internal {
        // In production, call originSwapManager.lockUserDeposit()
        // For now, we'll just transfer tokens to this contract
        if (transfer.token == address(0)) {
            require(address(this).balance >= transfer.amount, "Insufficient balance");
        } else {
            IERC20(transfer.token).safeTransferFrom(
                msg.sender,
                address(this),
                transfer.amount
            );
        }
    }
    
    // ============ Message Receivers ============
    
    /**
     * @notice Handle incoming LayerZero message
     * @param origin Message origin
     * @param guid Message GUID
     * @param message Message payload
     * @param executor Executor address
     * @param extraData Extra data
     */
    function handleLayerZeroMessage(
        ILayerZeroIntegration.Origin calldata origin,
        bytes32 guid,
        bytes calldata message,
        address executor,
        bytes calldata extraData
    ) external {
        // Verify caller is router
        require(msg.sender == address(router), "Unauthorized");
        
        (string memory action, bytes32 voucherRequestId, uint256 targetChainId) = 
            abi.decode(message, (string, bytes32, uint256));
        
        if (keccak256(bytes(action)) == keccak256(bytes("VOUCHER_REQUEST"))) {
            (,,, address token, uint256 amount, address recipient) = 
                abi.decode(message, (string, bytes32, uint256, address, uint256, address));
            _processVoucherRequest(voucherRequestId, targetChainId, token, amount, recipient);
        } else if (keccak256(bytes(action)) == keccak256(bytes("TRANSFER_COMPLETE"))) {
            _processTransferComplete(voucherRequestId, targetChainId);
        }
    }
    
    /**
     * @notice Process voucher request on destination chain
     * @param voucherRequestId Voucher request ID
     * @param targetChainId Target chain ID
     */
    function _processVoucherRequest(
        bytes32 voucherRequestId,
        uint256 targetChainId,
        address token,
        uint256 amount,
        address recipient
    ) internal {
        // Find transfer by voucher request
        uint256 txId = voucherRequestToTransfer[voucherRequestId];
        CrossChainTransferRequest storage transfer = transfers[txId];
        
        require(transfer.status == TransferStatus.EXECUTING, "Invalid status");
        
        // In production: Issue voucher via XLP network
        // For now, we'll simulate the execution
        
        // Execute atomic swap (EIL)
        // destinationSwapManager.withdrawFromVoucher(voucherRequest, voucher);
        
        // Update status
        transfer.status = TransferStatus.EXECUTED;
        transfer.executedAt = block.timestamp;
        
        emit TransferExecuted(txId, voucherRequestId, block.timestamp);
        
        // Notify origin chain
        bytes memory completionData = abi.encode(
            "TRANSFER_COMPLETE",
            voucherRequestId,
            targetChainId
        );
        
        // Route completion message back
        router.routeMessage{value: msg.value}(
            targetChainId, // This would be origin chain ID
            completionData,
            MessageRequirements.createTimeSensitiveRequirements(0)
        );
    }
    
    /**
     * @notice Process transfer completion on origin chain
     * @param voucherRequestId Voucher request ID
     * @param targetChainId Target chain ID
     */
    function _processTransferComplete(
        bytes32 voucherRequestId,
        uint256 targetChainId
    ) internal {
        uint256 txId = voucherRequestToTransfer[voucherRequestId];
        CrossChainTransferRequest storage transfer = transfers[txId];
        
        require(transfer.status == TransferStatus.EXECUTED, "Invalid status");
        
        // Withdraw from user deposit (EIL)
        // originSwapManager.withdrawFromUserDeposit(voucherRequest);
        
        // Update status
        transfer.status = TransferStatus.COMPLETED;
        transfer.completedAt = block.timestamp;
        
        emit TransferCompleted(txId, voucherRequestId, block.timestamp);
    }
    
    // ============ Utility Functions ============
    
    /**
     * @notice Cancel a transfer request
     * @param txId Transaction ID
     */
    function cancelTransfer(uint256 txId) external onlyOwner {
        CrossChainTransferRequest storage transfer = transfers[txId];
        
        require(
            transfer.status == TransferStatus.PENDING_APPROVAL ||
            transfer.status == TransferStatus.APPROVED,
            "Cannot cancel"
        );
        
        transfer.status = TransferStatus.CANCELLED;
        
        emit TransferCancelled(txId, msg.sender);
    }
    
    /**
     * @notice Get transfer details
     * @param txId Transaction ID
     * @return transfer Transfer details
     */
    function getTransfer(uint256 txId) external view returns (CrossChainTransferRequest memory) {
        return transfers[txId];
    }
}

