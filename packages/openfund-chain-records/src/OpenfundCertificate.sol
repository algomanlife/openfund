// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.28;

import {RecorderAccess} from "./RecorderAccess.sol";

/// @title OpenfundCertificate
/// @notice Non-transferable (soulbound) ERC-721 certificates for Openfund
///         challenge milestones: challenge purchase, Free Trial start, phase 1
///         pass, final pass, Free Trial pass and payout. ERC-5192: every token
///         is locked from issue. Issued only by an Openfund recorder; the
///         holder never signs or pays. ADR 0063.
/// @dev Token ids are derived off-chain from the record key
///      (keccak256("cert:<kind>:<source uuid>")), so a retried issue of the
///      same certificate is a no-op instead of a duplicate token.
contract OpenfundCertificate is RecorderAccess {
    string public constant name = "Openfund Certificate";
    string public constant symbol = "OFCERT";

    uint8 public constant KIND_PURCHASE = 1;
    uint8 public constant KIND_TRIAL = 2;
    uint8 public constant KIND_STAGE_PASS = 3;
    uint8 public constant KIND_FINAL_PASS = 4;
    uint8 public constant KIND_TRIAL_PASS = 5;
    uint8 public constant KIND_PAYOUT = 6;

    uint8 public constant STATUS_ACTIVE = 0;
    uint8 public constant STATUS_PASSED = 1;
    uint8 public constant STATUS_FAILED = 2;
    uint8 public constant STATUS_EXPIRED = 3;
    uint8 public constant STATUS_REVOKED = 4;

    struct Certificate {
        uint8 kind;
        uint8 status;
        uint64 eventAt;
        uint64 issuedAt;
        bytes16 challengeId;
        /// account size (or payout amount) in US cents
        uint128 amountCents;
    }

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => Certificate) private _certificates;
    string public baseURI;
    uint256 public totalSupply;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    /// ERC-5192
    event Locked(uint256 tokenId);
    event CertificateIssued(
        uint256 indexed tokenId,
        address indexed holder,
        bytes16 indexed challengeId,
        uint8 kind,
        uint128 amountCents,
        uint64 eventAt
    );
    event CertificateStatusChanged(uint256 indexed tokenId, uint8 status);
    event BaseURISet(string baseURI);

    error Soulbound();
    error UnknownToken();
    error InvalidKind();
    error InvalidStatus();

    constructor(address initialOwner, string memory initialBaseURI) RecorderAccess(initialOwner) {
        baseURI = initialBaseURI;
        emit BaseURISet(initialBaseURI);
    }

    // ------------------------------------------------------------------
    // Recorder writes
    // ------------------------------------------------------------------

    /// @notice Issue a certificate. Re-issuing an existing token id is a
    ///         no-op (idempotent retries), never a revert.
    function issue(
        address to,
        uint256 tokenId,
        uint8 kind,
        bytes16 challengeId,
        uint128 amountCents,
        uint64 eventAt
    ) external onlyRecorder returns (bool issued) {
        if (to == address(0)) revert ZeroAddress();
        if (kind < KIND_PURCHASE || kind > KIND_PAYOUT) revert InvalidKind();
        if (_owners[tokenId] != address(0)) return false;
        _owners[tokenId] = to;
        unchecked {
            _balances[to] += 1;
            totalSupply += 1;
        }
        _certificates[tokenId] = Certificate({
            kind: kind,
            status: STATUS_ACTIVE,
            eventAt: eventAt,
            issuedAt: uint64(block.timestamp),
            challengeId: challengeId,
            amountCents: amountCents
        });
        emit Transfer(address(0), to, tokenId);
        emit Locked(tokenId);
        emit CertificateIssued(tokenId, to, challengeId, kind, amountCents, eventAt);
        return true;
    }

    /// @notice Record the outcome of the evaluation a certificate belongs to.
    function setStatus(uint256 tokenId, uint8 status) external onlyRecorder {
        if (_owners[tokenId] == address(0)) revert UnknownToken();
        if (status > STATUS_REVOKED) revert InvalidStatus();
        if (_certificates[tokenId].status == status) return;
        _certificates[tokenId].status = status;
        emit CertificateStatusChanged(tokenId, status);
    }

    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        baseURI = newBaseURI;
        emit BaseURISet(newBaseURI);
    }

    // ------------------------------------------------------------------
    // Reads
    // ------------------------------------------------------------------

    function certificate(uint256 tokenId) external view returns (Certificate memory) {
        if (_owners[tokenId] == address(0)) revert UnknownToken();
        return _certificates[tokenId];
    }

    function balanceOf(address holder) external view returns (uint256) {
        if (holder == address(0)) revert ZeroAddress();
        return _balances[holder];
    }

    function ownerOf(uint256 tokenId) external view returns (address holder) {
        holder = _owners[tokenId];
        if (holder == address(0)) revert UnknownToken();
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (_owners[tokenId] == address(0)) revert UnknownToken();
        string memory base = baseURI;
        return string.concat(base, _toHex(tokenId));
    }

    /// ERC-5192: every certificate is locked.
    function locked(uint256 tokenId) external view returns (bool) {
        if (_owners[tokenId] == address(0)) revert UnknownToken();
        return true;
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        if (_owners[tokenId] == address(0)) revert UnknownToken();
        return address(0);
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        return false;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 // ERC-165
            || interfaceId == 0x80ac58cd // ERC-721
            || interfaceId == 0x5b5e139f // ERC-721 Metadata
            || interfaceId == 0xb45a3c0e; // ERC-5192
    }

    // ------------------------------------------------------------------
    // Transfers and approvals are disabled (soulbound)
    // ------------------------------------------------------------------

    function approve(address, uint256) external pure {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) external pure {
        revert Soulbound();
    }

    function transferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert Soulbound();
    }

    /// @dev 0x-prefixed, 64-digit lowercase hex of a token id.
    function _toHex(uint256 value) private pure returns (string memory) {
        bytes memory out = new bytes(66);
        out[0] = "0";
        out[1] = "x";
        bytes16 digits = "0123456789abcdef";
        for (uint256 i = 65; i > 1; --i) {
            out[i] = digits[value & 0xf];
            value >>= 4;
        }
        return string(out);
    }
}
