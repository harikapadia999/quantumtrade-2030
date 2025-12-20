// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title TradingVault
 * @dev Secure vault for managing user deposits and trading collateral
 */
contract TradingVault is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // User balances
    mapping(address => mapping(address => uint256)) public balances;
    
    // Total deposits per token
    mapping(address => uint256) public totalDeposits;
    
    // Supported tokens
    mapping(address => bool) public supportedTokens;
    
    // Trading engine address (authorized to execute trades)
    address public tradingEngine;
    
    // Events
    event Deposit(address indexed user, address indexed token, uint256 amount);
    event Withdrawal(address indexed user, address indexed token, uint256 amount);
    event Trade(address indexed user, address indexed token, uint256 amount, bool isDebit);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event TradingEngineUpdated(address indexed oldEngine, address indexed newEngine);

    constructor(address _tradingEngine) {
        tradingEngine = _tradingEngine;
    }

    modifier onlyTradingEngine() {
        require(msg.sender == tradingEngine, "Only trading engine");
        _;
    }

    /**
     * @dev Deposit tokens into the vault
     */
    function deposit(address token, uint256 amount) external nonReentrant whenNotPaused {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be greater than 0");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        balances[msg.sender][token] += amount;
        totalDeposits[token] += amount;

        emit Deposit(msg.sender, token, amount);
    }

    /**
     * @dev Deposit native currency (ETH)
     */
    function depositNative() external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Amount must be greater than 0");

        balances[msg.sender][address(0)] += msg.value;
        totalDeposits[address(0)] += msg.value;

        emit Deposit(msg.sender, address(0), msg.value);
    }

    /**
     * @dev Withdraw tokens from the vault
     */
    function withdraw(address token, uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(balances[msg.sender][token] >= amount, "Insufficient balance");

        balances[msg.sender][token] -= amount;
        totalDeposits[token] -= amount;

        if (token == address(0)) {
            // Withdraw native currency
            (bool success, ) = msg.sender.call{value: amount}("");
            require(success, "Transfer failed");
        } else {
            // Withdraw ERC20 token
            IERC20(token).safeTransfer(msg.sender, amount);
        }

        emit Withdrawal(msg.sender, token, amount);
    }

    /**
     * @dev Execute trade (called by trading engine)
     */
    function executeTrade(
        address user,
        address token,
        uint256 amount,
        bool isDebit
    ) external onlyTradingEngine nonReentrant {
        if (isDebit) {
            require(balances[user][token] >= amount, "Insufficient balance");
            balances[user][token] -= amount;
            totalDeposits[token] -= amount;
        } else {
            balances[user][token] += amount;
            totalDeposits[token] += amount;
        }

        emit Trade(user, token, amount, isDebit);
    }

    /**
     * @dev Get user balance for a token
     */
    function getBalance(address user, address token) external view returns (uint256) {
        return balances[user][token];
    }

    /**
     * @dev Get user balances for multiple tokens
     */
    function getBalances(address user, address[] calldata tokens) 
        external 
        view 
        returns (uint256[] memory) 
    {
        uint256[] memory userBalances = new uint256[](tokens.length);
        
        for (uint256 i = 0; i < tokens.length; i++) {
            userBalances[i] = balances[user][tokens[i]];
        }
        
        return userBalances;
    }

    /**
     * @dev Add supported token
     */
    function addToken(address token) external onlyOwner {
        require(!supportedTokens[token], "Token already supported");
        supportedTokens[token] = true;
        emit TokenAdded(token);
    }

    /**
     * @dev Remove supported token
     */
    function removeToken(address token) external onlyOwner {
        require(supportedTokens[token], "Token not supported");
        require(totalDeposits[token] == 0, "Token has deposits");
        supportedTokens[token] = false;
        emit TokenRemoved(token);
    }

    /**
     * @dev Update trading engine address
     */
    function updateTradingEngine(address newEngine) external onlyOwner {
        require(newEngine != address(0), "Invalid address");
        address oldEngine = tradingEngine;
        tradingEngine = newEngine;
        emit TradingEngineUpdated(oldEngine, newEngine);
    }

    /**
     * @dev Pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Emergency withdrawal (only owner, when paused)
     */
    function emergencyWithdraw(address token, uint256 amount) 
        external 
        onlyOwner 
        whenPaused 
    {
        if (token == address(0)) {
            (bool success, ) = owner().call{value: amount}("");
            require(success, "Transfer failed");
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
    }

    receive() external payable {
        balances[msg.sender][address(0)] += msg.value;
        totalDeposits[address(0)] += msg.value;
        emit Deposit(msg.sender, address(0), msg.value);
    }
}
