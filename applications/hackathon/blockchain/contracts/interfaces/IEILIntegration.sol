// SPDX-License-Identifier: Custom
pragma solidity ^0.8.25;

/**
 * @title IEILIntegration
 * @notice Interface for EIL Contracts integration
 * @dev Abstracts EIL's OriginSwapManager and DestinationSwapManager
 */
interface IEILIntegration {
    // ============ EIL Types ============
    
    struct AtomicSwapVoucherRequest {
        SourceSwapComponent origination;
        DestinationSwapComponent destination;
    }
    
    struct AtomicSwapVoucher {
        bytes32 requestId;
        address payable originationXlpAddress;
        DestinationSwapComponent voucherRequestDest;
        uint256 expiresAt;
        VoucherType voucherType;
        bytes xlpSignature;
    }
    
    struct SourceSwapComponent {
        address sender;
        uint256 senderNonce;
        uint256 chainId;
        address paymaster;
        Asset[] assets;
        AtomicSwapFeeRule feeRule;
        address[] allowedXlps;
    }
    
    struct DestinationSwapComponent {
        address sender;
        uint256 chainId;
        address paymaster;
        Asset[] assets;
        uint256 expiresAt;
        uint256 maxUserOpCost;
    }
    
    struct Asset {
        address erc20Token;
        uint256 amount;
    }
    
    struct AtomicSwapFeeRule {
        uint256 startFeePercentNumerator;
        uint256 feeIncreasePerSecond;
        uint256 maxFeePercentNumerator;
        uint256 unspentVoucherFee;
    }
    
    enum VoucherType {
        STANDARD,
        OVERRIDE,
        ALT,
        ALT_OVERRIDE
    }
    
    struct VoucherWithRequest {
        AtomicSwapVoucherRequest voucherRequest;
        AtomicSwapVoucher voucher;
    }
    
    // ============ Events ============
    
    event VoucherRequestCreated(
        bytes32 indexed id,
        address indexed sender,
        AtomicSwapVoucherRequest voucherRequest
    );
    
    event VoucherIssued(
        bytes32 indexed id,
        address indexed sender,
        uint256 indexed senderNonce,
        AtomicSwapVoucher voucher
    );
    
    event VoucherSpent(
        bytes32 indexed requestId,
        address indexed sender,
        address payable indexed originationXlpAddress,
        uint256 expiresAt,
        VoucherType voucherType
    );
    
    event UserDepositWithdrawn(
        bytes32 indexed requestId,
        address indexed sender,
        address indexed voucherIssuer
    );
    
    // ============ Origin Chain Functions ============
    
    /**
     * @notice Lock user deposit and create voucher request
     * @param voucherRequest The voucher request details
     */
    function lockUserDeposit(AtomicSwapVoucherRequest calldata voucherRequest) external payable;
    
    /**
     * @notice Issue vouchers for atomic swaps
     * @param vouchersWithRequests Array of vouchers with their requests
     */
    function issueVouchers(VoucherWithRequest[] calldata vouchersWithRequests) external;
    
    /**
     * @notice Withdraw from user deposit after voucher redemption
     * @param voucherRequests Array of voucher requests to withdraw
     */
    function withdrawFromUserDeposit(AtomicSwapVoucherRequest[] calldata voucherRequests) external;
    
    /**
     * @notice Cancel a voucher request
     * @param voucherRequest The voucher request to cancel
     */
    function cancelVoucherRequest(AtomicSwapVoucherRequest calldata voucherRequest) external;
    
    /**
     * @notice Get atomic swap metadata
     * @param requestId The request ID
     * @return metadata The swap metadata
     */
    function getAtomicSwapMetadata(bytes32 requestId) external view returns (bytes memory metadata);
    
    /**
     * @notice Get sender nonce
     * @param sender The sender address
     * @return The current nonce
     */
    function getSenderNonce(address sender) external view returns (uint256);
    
    // ============ Destination Chain Functions ============
    
    /**
     * @notice Withdraw from voucher on destination chain
     * @param voucherRequest The voucher request
     * @param voucher The voucher to redeem
     */
    function withdrawFromVoucher(
        AtomicSwapVoucherRequest memory voucherRequest,
        AtomicSwapVoucher memory voucher
    ) external;
    
    /**
     * @notice Get incoming atomic swap
     * @param requestId The request ID
     * @return The swap metadata
     */
    function getIncomingAtomicSwap(bytes32 requestId) external view returns (bytes memory);
}

