// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {PPTToken} from "./PPTToken.sol";

/**
 * @title MedInvoiceContract
 * @notice Invoice filing + subscription system powered by PPT token.
 *
 * Subscription model (reward):
 *   - Users call subscribe() and RECEIVE 10 PPT from the contract.
 *   - The contract must be pre-funded by the owner via fundContract().
 *   - Subscribed users can then mint additional PPT (capped).
 *
 * To switch to a PAYMENT model (users pay to subscribe):
 *   Replace pptToken.transfer(msg.sender, SUBSCRIPTION_AMOUNT) in subscribe()
 *   with pptToken.transferFrom(msg.sender, address(this), SUBSCRIPTION_AMOUNT)
 *   and add: require(pptToken.approve(address(this), SUBSCRIPTION_AMOUNT))
 *   on the frontend before calling subscribe().
 *
 * Deploy order:
 *   1. Deploy PPTToken(initialSupply, maxSupply)
 *   2. Deploy MedInvoiceContract(tokenAddress, mintCap)
 *   3. token.setMedInvoiceContract(invoiceAddress)
 *   4. token.approve(invoiceAddress, fundAmount)  ← from owner wallet
 *   5. invoice.fundContract(fundAmount)           ← pulls PPT into contract
 */
contract MedInvoiceContract is Ownable, ReentrancyGuard {

    // ─── State ────────────────────────────────────────────────────
    PPTToken public immutable pptToken;
    uint256  public immutable deployedChainId;

    // File storage per user
    mapping(address => string[]) private fileList;

    // Organisation registry
    mapping(address => string) public organisations;

    // Subscription tracking
    mapping(address => uint256) public subscriptionEndTimes;

    // Mint tracking
    uint256 public totalMintedByUsers;
    uint256 public mintCap;

    // ─── Constants ───────────────────────────────────────────────
    uint256 public constant SUBSCRIPTION_AMOUNT = 10  * 10**18;  // 10 PPT reward per subscription
    uint256 public constant SUBSCRIPTION_PERIOD = 365 days;
    uint256 public constant MAX_MINT_PER_TX      = 100 * 10**18; // 100 PPT per mintToken() call
    uint256 public constant MIN_BALANCE_TO_ACCESS = 1;            // 1 wei PPT to read/write files

    // ─── Events ───────────────────────────────────────────────────
    event FileSaved(address indexed user, string file, uint256 timestamp);
    event FileDeleted(address indexed user, uint256 index, uint256 timestamp);
    event NewSubscription(address indexed subscriber, uint256 endTime);
    event SubscriptionRenewed(address indexed subscriber, uint256 newEndTime);
    event OrgSubscribed(address indexed org, string email, uint256 endTime);
    event TokensMinted(address indexed user, uint256 amount);
    event ContractFunded(address indexed funder, uint256 amount);
    event MintCapUpdated(uint256 oldCap, uint256 newCap);
    event TokensWithdrawn(address indexed to, uint256 amount);

    // ─── Modifiers ────────────────────────────────────────────────
    modifier onlyCorrectChain() {
        require(block.chainid == deployedChainId, "Wrong chain for this contract");
        _;
    }

    modifier holdsToken() {
        require(
            pptToken.balanceOf(msg.sender) >= MIN_BALANCE_TO_ACCESS,
            "Must hold PPT to access"
        );
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────
    /**
     * @param _pptToken Address of deployed PPTToken contract
     * @param _mintCap  Global cap on user-mintable tokens (in wei, 18 decimals)
     *                  Example: 500_000 * 1e18 for a 500k PPT user mint pool
     */
    constructor(address _pptToken, uint256 _mintCap) Ownable(msg.sender) {
        require(_pptToken != address(0), "Zero token address");
        pptToken       = PPTToken(_pptToken);
        mintCap        = _mintCap;
        deployedChainId = block.chainid;
    }

    // ═══════════════════════════════════════════════════════════════
    //  FILE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Save an invoice file reference. Caller must hold >= 1 wei PPT.
     * @param file IPFS CID or encrypted file reference string
     */
    function saveFile(string memory file)
        external
        holdsToken
        onlyCorrectChain
    {
        require(bytes(file).length > 0, "File cannot be empty");
        fileList[msg.sender].push(file);
        emit FileSaved(msg.sender, file, block.timestamp);
    }

    /**
     * @notice Delete a file by index (swap-and-pop, changes order).
     * @param index Position in the caller's file array
     */
    function deleteFile(uint256 index) external onlyCorrectChain {
        uint256 len = fileList[msg.sender].length;
        require(index < len, "Index out of range");
        // Swap with last element then pop
        fileList[msg.sender][index] = fileList[msg.sender][len - 1];
        fileList[msg.sender].pop();
        emit FileDeleted(msg.sender, index, block.timestamp);
    }

    /**
     * @notice Get all file references for the caller.
     */
    function getFiles()
        external
        view
        holdsToken
        returns (string[] memory)
    {
        return fileList[msg.sender];
    }

    /**
     * @notice Get number of files saved by the caller (no token required).
     */
    function getFileCount() external view returns (uint256) {
        return fileList[msg.sender].length;
    }

    /**
     * @notice Get a single file by index.
     */
    function getFile(uint256 index)
        external
        view
        holdsToken
        returns (string memory)
    {
        require(index < fileList[msg.sender].length, "Index out of range");
        return fileList[msg.sender][index];
    }

    // ═══════════════════════════════════════════════════════════════
    //  TOKEN QUERIES
    // ═══════════════════════════════════════════════════════════════

    function getUserTokens() external view returns (uint256) {
        return pptToken.balanceOf(msg.sender);
    }

    function getContractBalance() external view returns (uint256) {
        return pptToken.balanceOf(address(this));
    }

    // ═══════════════════════════════════════════════════════════════
    //  SUBSCRIPTION
    // ═══════════════════════════════════════════════════════════════

    function isSubscribed(address user) public view returns (bool) {
        return subscriptionEndTimes[user] > block.timestamp;
    }

    function getSubscriptionDetails()
        external
        view
        returns (bool active, uint256 endTime, uint256 remaining)
    {
        endTime   = subscriptionEndTimes[msg.sender];
        active    = endTime > block.timestamp;
        remaining = active ? endTime - block.timestamp : 0;
    }

    function getSubscriptionEndDate(address user)
        external
        view
        returns (uint256)
    {
        return subscriptionEndTimes[user];
    }

    /**
     * @notice Subscribe and receive 10 PPT reward from the contract.
     *         Contract must have been pre-funded by owner via fundContract().
     *         One subscription per address — use renewSubscription() after expiry.
     */
    function subscribe() external nonReentrant onlyCorrectChain {
        require(!isSubscribed(msg.sender), "Already subscribed");
        require(subscriptionEndTimes[msg.sender] == 0, "Use renewSubscription()");
        _processSubscription(msg.sender);
        emit NewSubscription(msg.sender, subscriptionEndTimes[msg.sender]);
    }

    /**
     * @notice Renew an expired subscription and receive another 10 PPT reward.
     */
    function renewSubscription() external nonReentrant onlyCorrectChain {
        require(!isSubscribed(msg.sender), "Subscription still active");
        require(subscriptionEndTimes[msg.sender] > 0, "Must subscribe first");
        _processSubscription(msg.sender);
        emit SubscriptionRenewed(msg.sender, subscriptionEndTimes[msg.sender]);
    }

    /**
     * @notice Owner subscribes an organisation wallet and sends 10 PPT reward.
     *         Used for targeted early distribution to partner organisations.
     * @param user     Organisation wallet address
     * @param orgEmail Organisation email for registry
     */
    function orgSubscribe(address user, string memory orgEmail)
        external
        onlyOwner
        nonReentrant
    {
        require(user != address(0), "Zero address");
        require(!isSubscribed(user), "Already subscribed");
        require(bytes(orgEmail).length > 0, "Empty email");
        organisations[user] = orgEmail;
        _processSubscription(user);
        emit OrgSubscribed(user, orgEmail, subscriptionEndTimes[user]);
    }

    /// @dev Shared subscription logic. Reverts if contract is underfunded.
    function _processSubscription(address user) internal {
        require(
            pptToken.balanceOf(address(this)) >= SUBSCRIPTION_AMOUNT,
            "Contract underfunded — owner must call fundContract()"
        );
        subscriptionEndTimes[user] = block.timestamp + SUBSCRIPTION_PERIOD;
        require(pptToken.transfer(user, SUBSCRIPTION_AMOUNT), "PPT transfer failed");
    }

    // ═══════════════════════════════════════════════════════════════
    //  TOKEN MINTING (subscribed users)
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Mint PPT tokens. Requires active subscription.
     *         Capped per transaction (MAX_MINT_PER_TX) and globally (mintCap).
     * @param amount Amount to mint in wei (max 100 PPT = 100 * 1e18 per call)
     */
    function mintToken(uint256 amount) external onlyCorrectChain {
        require(isSubscribed(msg.sender), "Active subscription required");
        require(amount > 0, "Amount must be > 0");
        require(amount <= MAX_MINT_PER_TX, "Exceeds 100 PPT per-tx limit");
        require(
            totalMintedByUsers + amount <= mintCap,
            "Global mint cap reached"
        );
        totalMintedByUsers += amount;
        pptToken.mint(msg.sender, amount);
        emit TokensMinted(msg.sender, amount);
    }

    // ═══════════════════════════════════════════════════════════════
    //  OWNER CONTROLS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Fund the contract with PPT for subscription rewards.
     *         Owner must first approve this contract on the token:
     *         token.approve(invoiceAddress, amount)
     * @param amount Amount in wei to pull from owner into contract
     */
    function fundContract(uint256 amount) external onlyOwner {
        require(amount > 0, "Zero amount");
        require(
            pptToken.transferFrom(msg.sender, address(this), amount),
            "Fund transfer failed — did you approve first?"
        );
        emit ContractFunded(msg.sender, amount);
    }

    /**
     * @notice Update the global mint cap for user minting.
     * @param newCap Must be >= totalMintedByUsers
     */
    function setMintCap(uint256 newCap) external onlyOwner {
        require(newCap >= totalMintedByUsers, "Cannot set below already minted");
        emit MintCapUpdated(mintCap, newCap);
        mintCap = newCap;
    }

    /**
     * @notice Withdraw PPT from contract to owner wallet.
     * @param amount Amount in wei
     */
    function withdrawTokens(uint256 amount) external onlyOwner {
        require(amount > 0, "Zero amount");
        require(
            pptToken.balanceOf(address(this)) >= amount,
            "Insufficient contract balance"
        );
        require(pptToken.transfer(owner(), amount), "Withdrawal failed");
        emit TokensWithdrawn(owner(), amount);
    }
}
