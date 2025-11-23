// SPDX-License-Identifier: Custom
pragma solidity ^0.8.25;

import "../../../../contracts/core/base/lib/StateAbstraction.sol";
import "../../../../contracts/interfaces/IDefinition.sol";

/**
 * @title MessengerDefinitions
 * @dev Library containing predefined definitions for EnterpriseCrossChainMessenger initialization
 * This library holds static data that can be used to initialize messenger contracts
 * without increasing the main contract size
 */
library MessengerDefinitions {
    
    // Operation Type Constants
    bytes32 public constant SEND_MESSAGE = keccak256("SEND_MESSAGE");
    bytes32 public constant CANCEL_MESSAGE = keccak256("CANCEL_MESSAGE");
    bytes32 public constant META_APPROVE_MESSAGE = keccak256("META_APPROVE_MESSAGE");
    
    // Function Selector Constants
    bytes4 public constant SEND_MESSAGE_SELECTOR = bytes4(keccak256("executeSendMessage(uint256,bytes,(bool,bool,bool,bool,uint256,uint256,bool,bool,uint8))"));
    
    // Time Delay Function Selectors
    bytes4 public constant SEND_MESSAGE_REQUEST_SELECTOR = bytes4(keccak256("sendMessageRequest(uint256,bytes,(bool,bool,bool,bool,uint256,uint256,bool,bool,uint8))"));
    bytes4 public constant CANCEL_MESSAGE_SELECTOR = bytes4(keccak256("cancelMessage(uint256)"));
    
    // Meta-transaction Function Selectors
    bytes4 public constant APPROVE_MESSAGE_META_SELECTOR = bytes4(keccak256("approveMessageWithMetaTx((uint256,uint256,uint8,(address,address,uint256,uint256,bytes32,uint8,bytes),bytes32,bytes,(address,uint256,address,uint256),(uint256,uint256,address,bytes4,uint256,uint256,address),bytes,bytes))"));
    
    /**
     * @dev Returns predefined function schemas
     * @return Array of function schema definitions
     */
    function getFunctionSchemas() public pure returns (StateAbstraction.FunctionSchema[] memory) {
        StateAbstraction.FunctionSchema[] memory schemas = new StateAbstraction.FunctionSchema[](3);
        
        // Time-delay function schemas
        StateAbstraction.TxAction[] memory timeDelayRequestActions = new StateAbstraction.TxAction[](1);
        timeDelayRequestActions[0] = StateAbstraction.TxAction.EXECUTE_TIME_DELAY_REQUEST;
        
        StateAbstraction.TxAction[] memory timeDelayCancelActions = new StateAbstraction.TxAction[](1);
        timeDelayCancelActions[0] = StateAbstraction.TxAction.EXECUTE_TIME_DELAY_CANCEL;
        
        // Meta-transaction function schemas
        StateAbstraction.TxAction[] memory metaTxApproveActions = new StateAbstraction.TxAction[](2);
        metaTxApproveActions[0] = StateAbstraction.TxAction.SIGN_META_APPROVE;
        metaTxApproveActions[1] = StateAbstraction.TxAction.EXECUTE_META_APPROVE;
        
        // Time-delay functions
        schemas[0] = StateAbstraction.FunctionSchema({
            functionName: "sendMessageRequest",
            functionSelector: SEND_MESSAGE_REQUEST_SELECTOR,
            operationType: SEND_MESSAGE,
            operationName: "SEND_MESSAGE",
            supportedActionsBitmap: StateAbstraction.createBitmapFromActions(timeDelayRequestActions),
            isProtected: true
        });
        
        schemas[1] = StateAbstraction.FunctionSchema({
            functionName: "cancelMessage",
            functionSelector: CANCEL_MESSAGE_SELECTOR,
            operationType: CANCEL_MESSAGE,
            operationName: "CANCEL_MESSAGE",
            supportedActionsBitmap: StateAbstraction.createBitmapFromActions(timeDelayCancelActions),
            isProtected: true
        });
        
        // Meta-transaction functions
        schemas[2] = StateAbstraction.FunctionSchema({
            functionName: "approveMessageWithMetaTx",
            functionSelector: APPROVE_MESSAGE_META_SELECTOR,
            operationType: META_APPROVE_MESSAGE,
            operationName: "META_APPROVE_MESSAGE",
            supportedActionsBitmap: StateAbstraction.createBitmapFromActions(metaTxApproveActions),
            isProtected: true
        });
        
        return schemas;
    }
    
    /**
     * @dev Returns predefined role hashes and their corresponding function permissions
     * @return RolePermission struct containing roleHashes and functionPermissions arrays
     */
    function getRolePermissions() public pure returns (IDefinition.RolePermission memory) {
        bytes32[] memory roleHashes;
        StateAbstraction.FunctionPermission[] memory functionPermissions;
        roleHashes = new bytes32[](4);
        functionPermissions = new StateAbstraction.FunctionPermission[](4);
        
        // Owner role permissions for time-delay operations
        StateAbstraction.TxAction[] memory ownerTimeDelayRequestActions = new StateAbstraction.TxAction[](1);
        ownerTimeDelayRequestActions[0] = StateAbstraction.TxAction.EXECUTE_TIME_DELAY_REQUEST;
        
        StateAbstraction.TxAction[] memory ownerTimeDelayCancelActions = new StateAbstraction.TxAction[](1);
        ownerTimeDelayCancelActions[0] = StateAbstraction.TxAction.EXECUTE_TIME_DELAY_CANCEL;
        
        // Owner role permissions for meta-transactions (signer)
        StateAbstraction.TxAction[] memory ownerMetaApproveActions = new StateAbstraction.TxAction[](1);
        ownerMetaApproveActions[0] = StateAbstraction.TxAction.SIGN_META_APPROVE;

        // Broadcaster role permissions for meta-transactions (executor)
        StateAbstraction.TxAction[] memory broadcasterMetaApproveActions = new StateAbstraction.TxAction[](1);
        broadcasterMetaApproveActions[0] = StateAbstraction.TxAction.EXECUTE_META_APPROVE;
     
        // Owner: Send Message Request
        roleHashes[0] = StateAbstraction.OWNER_ROLE;
        functionPermissions[0] = StateAbstraction.FunctionPermission({
            functionSelector: SEND_MESSAGE_REQUEST_SELECTOR,
            grantedActionsBitmap: StateAbstraction.createBitmapFromActions(ownerTimeDelayRequestActions)
        });
        
        // Owner: Cancel Message
        roleHashes[1] = StateAbstraction.OWNER_ROLE;
        functionPermissions[1] = StateAbstraction.FunctionPermission({
            functionSelector: CANCEL_MESSAGE_SELECTOR,
            grantedActionsBitmap: StateAbstraction.createBitmapFromActions(ownerTimeDelayCancelActions)
        });
        
        // Owner: Approve Message Meta (signer)
        roleHashes[2] = StateAbstraction.OWNER_ROLE;
        functionPermissions[2] = StateAbstraction.FunctionPermission({
            functionSelector: APPROVE_MESSAGE_META_SELECTOR,
            grantedActionsBitmap: StateAbstraction.createBitmapFromActions(ownerMetaApproveActions)
        });

        // Broadcaster: Approve Message Meta (executor)
        roleHashes[3] = StateAbstraction.BROADCASTER_ROLE;
        functionPermissions[3] = StateAbstraction.FunctionPermission({
            functionSelector: APPROVE_MESSAGE_META_SELECTOR,
            grantedActionsBitmap: StateAbstraction.createBitmapFromActions(broadcasterMetaApproveActions)
        });
        
        return IDefinition.RolePermission({
            roleHashes: roleHashes,
            functionPermissions: functionPermissions
        });
    }
}

