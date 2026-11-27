// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {RecorderAccess} from "./RecorderAccess.sol";

/// @title OpenfundTradeLedger
/// @notice Public record of every position event on an Openfund challenge
///         or Free Trial account: open, stop-loss / take-profit change,
///         partial close and close. Records are events (no per-position
///         contract); `recorded` makes every record id write-once, so a
///         retried transaction never duplicates a record. ADR 0063.
/// @dev Decimal values are fixed point with 10 decimals (the scale of the
///      Openfund database); 0 means "not set" for stopLoss / takeProfit.
contract OpenfundTradeLedger is RecorderAccess {
    uint8 public constant ACTION_OPEN = 1;
    uint8 public constant ACTION_MODIFY = 2;
    uint8 public constant ACTION_PARTIAL_CLOSE = 3;
    uint8 public constant ACTION_CLOSE = 4;

    uint8 public constant DECIMALS = 10;

    struct Trade {
        /// keccak256 of the Openfund record key; write-once
        bytes32 recordId;
        /// the challenge (stage) the account belongs to, uuid bytes
        bytes16 challengeId;
        /// the position, uuid bytes; a partial close is its own slice position
        bytes16 positionId;
        /// parent position of a partial-close slice, else zero
        bytes16 parentPositionId;
        uint8 action;
        bool long;
        uint32 leverage;
        uint64 at;
        string market;
        int256 quantity;
        int256 entryPrice;
        int256 exitPrice;
        int256 stopLoss;
        int256 takeProfit;
        int256 realizedPnl;
        string exitReason;
    }

    mapping(bytes32 => bool) public recorded;
    uint256 public recordCount;

    event TradeRecorded(
        bytes16 indexed challengeId,
        bytes16 indexed positionId,
        uint8 indexed action,
        Trade trade
    );

    error InvalidAction();

    constructor(address initialOwner) RecorderAccess(initialOwner) {}

    /// @return written false when the record id was already recorded
    function record(Trade calldata trade) external onlyRecorder returns (bool written) {
        if (trade.action < ACTION_OPEN || trade.action > ACTION_CLOSE) revert InvalidAction();
        if (recorded[trade.recordId]) return false;
        recorded[trade.recordId] = true;
        unchecked {
            recordCount += 1;
        }
        emit TradeRecorded(trade.challengeId, trade.positionId, trade.action, trade);
        return true;
    }
}
