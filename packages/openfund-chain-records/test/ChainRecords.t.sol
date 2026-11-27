// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {OpenfundCertificate} from "../src/OpenfundCertificate.sol";
import {OpenfundTradeLedger} from "../src/OpenfundTradeLedger.sol";
import {RecorderAccess} from "../src/RecorderAccess.sol";

/// Minimal Foundry cheatcode surface (no forge-std dependency).
interface Vm {
    function prank(address) external;
    function expectRevert(bytes4) external;
    function expectEmit(bool, bool, bool, bool) external;
    function warp(uint256) external;
}

contract ChainRecordsTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant OWNER = address(0xA11CE);
    address constant RECORDER = address(0xB0B);
    address constant TRADER = address(0xCAFE);
    address constant STRANGER = address(0xD00D);
    bytes16 constant CHALLENGE = bytes16(0x11111111111111111111111111111111);
    bytes16 constant POSITION = bytes16(0x22222222222222222222222222222222);

    OpenfundCertificate cert;
    OpenfundTradeLedger ledger;

    event TradeRecorded(bytes16 indexed challengeId, bytes16 indexed positionId, uint8 indexed action, OpenfundTradeLedger.Trade trade);

    function setUp() public {
        cert = new OpenfundCertificate(OWNER, "https://openfi.cloud/chain/certificates/");
        ledger = new OpenfundTradeLedger(OWNER);
        vm.prank(OWNER);
        cert.setRecorder(RECORDER, true);
        vm.prank(OWNER);
        ledger.setRecorder(RECORDER, true);
    }

    function _eq(uint256 a, uint256 b, string memory what) internal pure {
        require(a == b, what);
    }

    // ---------------------------------------------------------------- certificate

    function test_issueMintsALockedToken() public {
        /* evaluate the constant BEFORE prank: prank applies to the next call */
        uint8 kind = cert.KIND_TRIAL();
        vm.prank(RECORDER);
        bool issued = cert.issue(TRADER, 7, kind, CHALLENGE, 2_500_000, 1_700_000_000);
        require(issued, "issued");
        require(cert.ownerOf(7) == TRADER, "owner");
        _eq(cert.balanceOf(TRADER), 1, "balance");
        _eq(cert.totalSupply(), 1, "supply");
        require(cert.locked(7), "locked");
        OpenfundCertificate.Certificate memory c = cert.certificate(7);
        _eq(c.kind, kind, "kind");
        _eq(c.amountCents, 2_500_000, "amount");
        require(c.challengeId == CHALLENGE, "challenge");
        _eq(c.status, cert.STATUS_ACTIVE(), "status");
    }

    function test_reissueIsANoOp() public {
        vm.prank(RECORDER);
        cert.issue(TRADER, 7, 1, CHALLENGE, 100, 1);
        vm.prank(RECORDER);
        bool again = cert.issue(STRANGER, 7, 2, CHALLENGE, 999, 2);
        require(!again, "second issue must be a no-op");
        require(cert.ownerOf(7) == TRADER, "owner unchanged");
        _eq(cert.totalSupply(), 1, "supply unchanged");
        _eq(cert.certificate(7).amountCents, 100, "data unchanged");
    }

    function test_onlyRecordersIssue() public {
        vm.prank(STRANGER);
        vm.expectRevert(RecorderAccess.NotRecorder.selector);
        cert.issue(TRADER, 1, 1, CHALLENGE, 1, 1);
    }

    function test_invalidKindReverts() public {
        vm.prank(RECORDER);
        vm.expectRevert(OpenfundCertificate.InvalidKind.selector);
        cert.issue(TRADER, 1, 9, CHALLENGE, 1, 1);
    }

    function test_transfersAndApprovalsAreDisabled() public {
        vm.prank(RECORDER);
        cert.issue(TRADER, 7, 1, CHALLENGE, 1, 1);
        vm.prank(TRADER);
        vm.expectRevert(OpenfundCertificate.Soulbound.selector);
        cert.transferFrom(TRADER, STRANGER, 7);
        vm.prank(TRADER);
        vm.expectRevert(OpenfundCertificate.Soulbound.selector);
        cert.safeTransferFrom(TRADER, STRANGER, 7);
        vm.prank(TRADER);
        vm.expectRevert(OpenfundCertificate.Soulbound.selector);
        cert.approve(STRANGER, 7);
        vm.prank(TRADER);
        vm.expectRevert(OpenfundCertificate.Soulbound.selector);
        cert.setApprovalForAll(STRANGER, true);
        require(cert.getApproved(7) == address(0), "no approval");
        require(!cert.isApprovedForAll(TRADER, STRANGER), "no operator");
    }

    function test_statusUpdates() public {
        vm.prank(RECORDER);
        cert.issue(TRADER, 7, 1, CHALLENGE, 1, 1);
        uint8 failed = cert.STATUS_FAILED();
        vm.prank(RECORDER);
        cert.setStatus(7, failed);
        _eq(cert.certificate(7).status, failed, "status");
        vm.prank(RECORDER);
        vm.expectRevert(OpenfundCertificate.UnknownToken.selector);
        cert.setStatus(8, failed);
        vm.prank(RECORDER);
        vm.expectRevert(OpenfundCertificate.InvalidStatus.selector);
        cert.setStatus(7, 9);
    }

    function test_tokenURIAndInterfaces() public {
        vm.prank(RECORDER);
        cert.issue(TRADER, 255, 1, CHALLENGE, 1, 1);
        require(
            keccak256(bytes(cert.tokenURI(255)))
                == keccak256(bytes("https://openfi.cloud/chain/certificates/0x00000000000000000000000000000000000000000000000000000000000000ff")),
            "tokenURI"
        );
        require(cert.supportsInterface(0x80ac58cd), "721");
        require(cert.supportsInterface(0x5b5e139f), "metadata");
        require(cert.supportsInterface(0xb45a3c0e), "5192");
        require(cert.supportsInterface(0x01ffc9a7), "165");
        require(!cert.supportsInterface(0xffffffff), "none");
    }

    function test_ownerManagesRecordersAndOwnership() public {
        vm.prank(STRANGER);
        vm.expectRevert(RecorderAccess.NotOwner.selector);
        cert.setRecorder(STRANGER, true);
        vm.prank(OWNER);
        cert.setRecorder(RECORDER, false);
        vm.prank(RECORDER);
        vm.expectRevert(RecorderAccess.NotRecorder.selector);
        cert.issue(TRADER, 1, 1, CHALLENGE, 1, 1);
        vm.prank(OWNER);
        cert.transferOwnership(STRANGER);
        require(cert.owner() == OWNER, "not yet transferred");
        vm.prank(RECORDER);
        vm.expectRevert(RecorderAccess.NotOwner.selector);
        cert.acceptOwnership();
        vm.prank(STRANGER);
        cert.acceptOwnership();
        require(cert.owner() == STRANGER, "transferred");
    }

    // ---------------------------------------------------------------- ledger

    function _trade(bytes32 id, uint8 action) internal pure returns (OpenfundTradeLedger.Trade memory t) {
        t.recordId = id;
        t.challengeId = CHALLENGE;
        t.positionId = POSITION;
        t.action = action;
        t.long = true;
        t.leverage = 20;
        t.at = 1_700_000_000;
        t.market = "BTC/USD";
        t.quantity = 15_000_000_000; // 1.5
        t.entryPrice = 600_000_000_000_000; // 60000
        t.stopLoss = 590_000_000_000_000;
        t.exitReason = "";
    }

    function test_recordEmitsAndIsWriteOnce() public {
        OpenfundTradeLedger.Trade memory t = _trade(keccak256("trade:open:1"), 1);
        vm.expectEmit(true, true, true, true);
        emit TradeRecorded(CHALLENGE, POSITION, 1, t);
        vm.prank(RECORDER);
        require(ledger.record(t), "written");
        require(ledger.recorded(t.recordId), "recorded");
        _eq(ledger.recordCount(), 1, "count");
        vm.prank(RECORDER);
        require(!ledger.record(t), "second write is a no-op");
        _eq(ledger.recordCount(), 1, "count unchanged");
    }

    function test_everyActionIsAccepted() public {
        for (uint8 a = 1; a <= 4; a++) {
            vm.prank(RECORDER);
            require(ledger.record(_trade(keccak256(abi.encode(a)), a)), "action");
        }
        _eq(ledger.recordCount(), 4, "four records");
    }

    function test_invalidActionAndStrangerRevert() public {
        vm.prank(RECORDER);
        vm.expectRevert(OpenfundTradeLedger.InvalidAction.selector);
        ledger.record(_trade(keccak256("x"), 0));
        vm.prank(RECORDER);
        vm.expectRevert(OpenfundTradeLedger.InvalidAction.selector);
        ledger.record(_trade(keccak256("y"), 5));
        vm.prank(STRANGER);
        vm.expectRevert(RecorderAccess.NotRecorder.selector);
        ledger.record(_trade(keccak256("z"), 1));
    }
}
