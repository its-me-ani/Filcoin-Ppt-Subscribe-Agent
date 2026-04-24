// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title InvoiceRegistry
 * @notice On-chain anchor for Agentic Invoice Co-Pilot.
 *         Stores CID + content hash + payment metadata, and records payment
 *         receipts from agentic rails (x402, MPP, ERC-8004).
 * @dev    Designed as the single anchor contract for the MVP. Dispute
 *         resolution is stubbed for future milestones.
 */
contract InvoiceRegistry {
    enum Status { None, Anchored, Paid, Disputed, Resolved }

    struct Invoice {
        bytes32 invoiceHash; // keccak256 of canonical JSON
        string  cid;         // IPFS/Filecoin CID
        address issuer;
        address payer;       // address(0) if unknown at anchor time
        uint256 amount;      // in micro-units (see frontend serialisation)
        address token;       // address(0) == native
        Status  status;
        uint64  createdAt;
    }

    mapping(bytes32 => Invoice) public invoices;
    mapping(address => bytes32[]) public issuedBy;
    mapping(address => bytes32[]) public billedTo;

    event Anchored(
        bytes32 indexed id,
        address indexed issuer,
        address indexed payer,
        string cid,
        bytes32 invoiceHash,
        uint256 amount,
        address token,
        uint64 createdAt
    );
    event Paid(bytes32 indexed id, address indexed payer, string rail, bytes32 txRef);
    event Disputed(bytes32 indexed id, address indexed by, string reason);
    event Resolved(bytes32 indexed id, address indexed by, Status newStatus);

    error InvoiceExists();
    error InvoiceMissing();
    error NotParticipant();
    error InvalidStatus();

    /**
     * @notice Anchor a new invoice. id = keccak256(abi.encodePacked(cid)).
     */
    function anchor(
        string calldata cid,
        bytes32 invoiceHash,
        address payer,
        uint256 amount,
        address token
    ) external returns (bytes32 id) {
        id = keccak256(abi.encodePacked(cid));
        if (invoices[id].status != Status.None) revert InvoiceExists();

        uint64 ts = uint64(block.timestamp);
        invoices[id] = Invoice({
            invoiceHash: invoiceHash,
            cid: cid,
            issuer: msg.sender,
            payer: payer,
            amount: amount,
            token: token,
            status: Status.Anchored,
            createdAt: ts
        });
        issuedBy[msg.sender].push(id);
        if (payer != address(0)) billedTo[payer].push(id);

        emit Anchored(id, msg.sender, payer, cid, invoiceHash, amount, token, ts);
    }

    /**
     * @notice Record a payment receipt (from any rail) against an anchored invoice.
     *         Open to issuer, payer, or an authorised agent — in the MVP we
     *         trust msg.sender; add an access-control hook for production.
     */
    function markPaid(bytes32 id, string calldata rail, bytes32 txRef) external {
        Invoice storage inv = invoices[id];
        if (inv.status == Status.None) revert InvoiceMissing();
        if (inv.status != Status.Anchored) revert InvalidStatus();
        inv.status = Status.Paid;
        emit Paid(id, msg.sender, rail, txRef);
    }

    function dispute(bytes32 id, string calldata reason) external {
        Invoice storage inv = invoices[id];
        if (inv.status == Status.None) revert InvoiceMissing();
        if (msg.sender != inv.issuer && msg.sender != inv.payer) revert NotParticipant();
        inv.status = Status.Disputed;
        emit Disputed(id, msg.sender, reason);
    }

    function resolve(bytes32 id, Status newStatus) external {
        Invoice storage inv = invoices[id];
        if (inv.status != Status.Disputed) revert InvalidStatus();
        if (newStatus != Status.Paid && newStatus != Status.Resolved) revert InvalidStatus();
        if (msg.sender != inv.issuer && msg.sender != inv.payer) revert NotParticipant();
        inv.status = newStatus;
        emit Resolved(id, msg.sender, newStatus);
    }

    function getInvoice(bytes32 id) external view returns (Invoice memory) {
        return invoices[id];
    }

    function listIssued(address user) external view returns (bytes32[] memory) {
        return issuedBy[user];
    }

    function listBilled(address user) external view returns (bytes32[] memory) {
        return billedTo[user];
    }
}
