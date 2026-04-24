// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title Erc8004AgentPayments (MVP stub)
 * @notice Minimal reference implementation of an agent-initiated settlement
 *         contract following the ERC-8004 shape. For the prototype we allow a
 *         whitelisted agent address to settle invoices on behalf of a payer.
 * @dev    Pairs with InvoiceRegistry — after `settle` succeeds, the backend
 *         calls registry.markPaid(invoiceId, "erc8004", txHash).
 */
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract Erc8004AgentPayments {
    address public admin;
    address public token; // settlement token (e.g. USDC)
    mapping(address => bool) public authorisedAgents;

    event AgentAuthorised(address indexed agent, bool allowed);
    event Settled(bytes32 indexed invoiceId, address indexed agent, uint256 amount, address payee);

    error NotAdmin();
    error NotAgent();
    error TransferFailed();

    constructor(address _token) {
        admin = msg.sender;
        token = _token;
        authorisedAgents[msg.sender] = true;
    }

    function setAgent(address agent, bool allowed) external {
        if (msg.sender != admin) revert NotAdmin();
        authorisedAgents[agent] = allowed;
        emit AgentAuthorised(agent, allowed);
    }

    /**
     * @notice Agent-initiated settlement. The agent must hold a prior allowance
     *         from the payer on the settlement token.
     */
    function settle(bytes32 invoiceId, uint256 amount, address payee) external returns (bytes32 txRef) {
        if (!authorisedAgents[msg.sender]) revert NotAgent();
        bool ok = IERC20(token).transferFrom(msg.sender, payee, amount);
        if (!ok) revert TransferFailed();
        emit Settled(invoiceId, msg.sender, amount, payee);
        return keccak256(abi.encodePacked(invoiceId, amount, payee, block.timestamp));
    }
}
