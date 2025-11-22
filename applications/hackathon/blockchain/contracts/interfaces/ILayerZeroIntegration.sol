// SPDX-License-Identifier: Custom
pragma solidity ^0.8.25;

/**
 * @title ILayerZeroIntegration
 * @notice Interface for LayerZero v2 integration
 * @dev Abstracts LayerZero's OApp and Endpoint interfaces
 */
interface ILayerZeroIntegration {
    // ============ LayerZero Types ============
    
    struct MessagingParams {
        uint32 dstEid;
        bytes32 receiver;
        bytes message;
        bytes options;
        bool payInLzToken;
    }
    
    struct MessagingFee {
        uint256 nativeFee;
        uint256 lzTokenFee;
    }
    
    struct MessagingReceipt {
        bytes32 guid;
        uint64 nonce;
        MessagingFee fee;
    }
    
    struct Origin {
        uint32 srcEid;
        bytes32 sender;
        uint64 nonce;
    }
    
    // ============ Events ============
    
    event PacketSent(bytes encodedPayload, bytes options, address sendLibrary);
    event PacketVerified(Origin origin, address receiver, bytes32 payloadHash);
    event PacketDelivered(Origin origin, address receiver);
    
    // ============ Functions ============
    
    /**
     * @notice Quote messaging fee
     * @param params Messaging parameters
     * @param sender Sender address
     * @return fee The messaging fee
     */
    function quote(
        MessagingParams calldata params,
        address sender
    ) external view returns (MessagingFee memory fee);
    
    /**
     * @notice Send cross-chain message
     * @param params Messaging parameters
     * @param refundAddress Address to receive refund
     * @return receipt The messaging receipt
     */
    function send(
        MessagingParams calldata params,
        address refundAddress
    ) external payable returns (MessagingReceipt memory receipt);
    
    /**
     * @notice Verify message
     * @param origin Message origin
     * @param receiver Receiver address
     * @param payloadHash Payload hash
     */
    function verify(
        Origin calldata origin,
        address receiver,
        bytes32 payloadHash
    ) external;
    
    /**
     * @notice Receive cross-chain message
     * @param origin Message origin
     * @param receiver Receiver address
     * @param guid Message GUID
     * @param message Message payload
     * @param extraData Extra data
     */
    function lzReceive(
        Origin calldata origin,
        address receiver,
        bytes32 guid,
        bytes calldata message,
        bytes calldata extraData
    ) external payable;
}

