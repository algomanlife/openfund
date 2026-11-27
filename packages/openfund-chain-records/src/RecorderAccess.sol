// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

/// @title RecorderAccess
/// @notice Owner plus a set of recorder addresses (one operator key per
///         Openfund region). Only recorders write records; only the owner
///         manages recorders. ADR 0063.
abstract contract RecorderAccess {
    address public owner;
    address public pendingOwner;
    mapping(address => bool) public recorders;

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event RecorderSet(address indexed recorder, bool allowed);

    error NotOwner();
    error NotRecorder();
    error ZeroAddress();

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRecorder() {
        if (!recorders[msg.sender]) revert NotRecorder();
        _;
    }

    function setRecorder(address recorder, bool allowed) external onlyOwner {
        if (recorder == address(0)) revert ZeroAddress();
        recorders[recorder] = allowed;
        emit RecorderSet(recorder, allowed);
    }

    /// @notice Two-step ownership transfer: the new owner must accept.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }
}
