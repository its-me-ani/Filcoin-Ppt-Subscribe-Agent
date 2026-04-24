// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PPTToken (Park Pro Token)
 * @notice ERC-20 reward token for the PPT invoice and SafeRoads ecosystem.
 *         Only the linked MedInvoiceContract may mint new tokens.
 *         The link is one-way and can only be set once by the owner.
 *
 * Deploy order:
 *   1. Deploy PPTToken(initialSupply, maxSupply)
 *   2. Deploy MedInvoiceContract(tokenAddress, mintCap)
 *   3. Call token.setMedInvoiceContract(invoiceAddress)  ← one-time, irreversible
 *   4. Call token.approve(invoiceAddress, fundAmount)    ← so owner can fund via fundContract()
 */
contract PPTToken is ERC20, ERC20Burnable, ERC20Pausable, Ownable {

    // ─── State ────────────────────────────────────────────────────
    address public medInvoiceContract;
    uint256 public immutable maxSupply;

    // ─── Events ───────────────────────────────────────────────────
    event InvoiceContractSet(address indexed invoiceContract);
    event Minted(address indexed to, uint256 amount);

    // ─── Constructor ──────────────────────────────────────────────
    /**
     * @param initialSupply Tokens minted to deployer (in whole tokens, e.g. 1000000)
     * @param _maxSupply    Hard cap in whole tokens. Must be >= initialSupply.
     */
    constructor(uint256 initialSupply, uint256 _maxSupply)
        ERC20("Park Pro Token", "PPT")
        Ownable(msg.sender)
    {
        require(_maxSupply >= initialSupply, "maxSupply < initialSupply");
        maxSupply = _maxSupply * 10 ** decimals();
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    // ─── Mint (invoice contract only) ────────────────────────────
    /**
     * @notice Mint PPT. Only callable by the linked MedInvoiceContract.
     * @param to     Recipient address
     * @param amount Amount in wei (18 decimals)
     */
    function mint(address to, uint256 amount) external whenNotPaused {
        require(msg.sender == medInvoiceContract, "Only invoice contract");
        require(to != address(0), "Mint to zero address");
        require(totalSupply() + amount <= maxSupply, "Max supply exceeded");
        _mint(to, amount);
        emit Minted(to, amount);
    }

    // ─── Owner: link invoice contract (one-time) ──────────────────
    /**
     * @notice Permanently links the invoice contract. Cannot be changed after set.
     * @param _medInvoiceContract Address of the deployed MedInvoiceContract
     */
    function setMedInvoiceContract(address _medInvoiceContract) external onlyOwner {
        require(medInvoiceContract == address(0), "Already set — deploy new token");
        require(_medInvoiceContract != address(0), "Zero address");
        medInvoiceContract = _medInvoiceContract;
        emit InvoiceContractSet(_medInvoiceContract);
    }

    // ─── Owner: pause / unpause ───────────────────────────────────
    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ─── Overrides ────────────────────────────────────────────────
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }
}
