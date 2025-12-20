// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LiquidityPool
 * @dev Automated market maker (AMM) liquidity pool for trading
 */
contract LiquidityPool is ERC20, ReentrancyGuard, Ownable {
    IERC20 public immutable token0;
    IERC20 public immutable token1;

    uint256 public reserve0;
    uint256 public reserve1;

    uint256 public constant MINIMUM_LIQUIDITY = 10**3;
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public feeRate = 30; // 0.3%

    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );
    event Sync(uint256 reserve0, uint256 reserve1);

    constructor(
        address _token0,
        address _token1,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) {
        token0 = IERC20(_token0);
        token1 = IERC20(_token1);
    }

    /**
     * @dev Add liquidity to the pool
     */
    function addLiquidity(
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min,
        address to
    ) external nonReentrant returns (uint256 liquidity) {
        (uint256 amount0, uint256 amount1) = _calculateOptimalAmounts(
            amount0Desired,
            amount1Desired,
            amount0Min,
            amount1Min
        );

        token0.transferFrom(msg.sender, address(this), amount0);
        token1.transferFrom(msg.sender, address(this), amount1);

        liquidity = _mint(to, amount0, amount1);
    }

    /**
     * @dev Remove liquidity from the pool
     */
    function removeLiquidity(
        uint256 liquidity,
        uint256 amount0Min,
        uint256 amount1Min,
        address to
    ) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        require(balanceOf(msg.sender) >= liquidity, "Insufficient liquidity");

        uint256 _totalSupply = totalSupply();
        amount0 = (liquidity * reserve0) / _totalSupply;
        amount1 = (liquidity * reserve1) / _totalSupply;

        require(amount0 >= amount0Min, "Insufficient amount0");
        require(amount1 >= amount1Min, "Insufficient amount1");

        _burn(msg.sender, liquidity);

        token0.transfer(to, amount0);
        token1.transfer(to, amount1);

        _update(
            token0.balanceOf(address(this)),
            token1.balanceOf(address(this))
        );

        emit Burn(msg.sender, amount0, amount1, to);
    }

    /**
     * @dev Swap tokens
     */
    function swap(
        uint256 amount0Out,
        uint256 amount1Out,
        address to
    ) external nonReentrant {
        require(amount0Out > 0 || amount1Out > 0, "Insufficient output amount");
        require(amount0Out < reserve0 && amount1Out < reserve1, "Insufficient liquidity");

        uint256 balance0Before = token0.balanceOf(address(this));
        uint256 balance1Before = token1.balanceOf(address(this));

        if (amount0Out > 0) token0.transfer(to, amount0Out);
        if (amount1Out > 0) token1.transfer(to, amount1Out);

        uint256 balance0After = token0.balanceOf(address(this));
        uint256 balance1After = token1.balanceOf(address(this));

        uint256 amount0In = balance0After > balance0Before - amount0Out
            ? balance0After - (balance0Before - amount0Out)
            : 0;
        uint256 amount1In = balance1After > balance1Before - amount1Out
            ? balance1After - (balance1Before - amount1Out)
            : 0;

        require(amount0In > 0 || amount1In > 0, "Insufficient input amount");

        // Verify constant product formula with fee
        uint256 balance0Adjusted = (balance0After * FEE_DENOMINATOR) - (amount0In * feeRate);
        uint256 balance1Adjusted = (balance1After * FEE_DENOMINATOR) - (amount1In * feeRate);

        require(
            balance0Adjusted * balance1Adjusted >= 
            reserve0 * reserve1 * (FEE_DENOMINATOR ** 2),
            "K invariant violated"
        );

        _update(balance0After, balance1After);

        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }

    /**
     * @dev Get amount out for a given amount in
     */
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        public
        view
        returns (uint256 amountOut)
    {
        require(amountIn > 0, "Insufficient input amount");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");

        uint256 amountInWithFee = amountIn * (FEE_DENOMINATOR - feeRate);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * FEE_DENOMINATOR) + amountInWithFee;
        
        amountOut = numerator / denominator;
    }

    /**
     * @dev Get amount in for a given amount out
     */
    function getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut)
        public
        view
        returns (uint256 amountIn)
    {
        require(amountOut > 0, "Insufficient output amount");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");

        uint256 numerator = reserveIn * amountOut * FEE_DENOMINATOR;
        uint256 denominator = (reserveOut - amountOut) * (FEE_DENOMINATOR - feeRate);
        
        amountIn = (numerator / denominator) + 1;
    }

    /**
     * @dev Calculate optimal amounts for adding liquidity
     */
    function _calculateOptimalAmounts(
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min
    ) private view returns (uint256 amount0, uint256 amount1) {
        if (reserve0 == 0 && reserve1 == 0) {
            (amount0, amount1) = (amount0Desired, amount1Desired);
        } else {
            uint256 amount1Optimal = (amount0Desired * reserve1) / reserve0;
            
            if (amount1Optimal <= amount1Desired) {
                require(amount1Optimal >= amount1Min, "Insufficient amount1");
                (amount0, amount1) = (amount0Desired, amount1Optimal);
            } else {
                uint256 amount0Optimal = (amount1Desired * reserve0) / reserve1;
                require(amount0Optimal <= amount0Desired, "Invalid amount0");
                require(amount0Optimal >= amount0Min, "Insufficient amount0");
                (amount0, amount1) = (amount0Optimal, amount1Desired);
            }
        }
    }

    /**
     * @dev Mint liquidity tokens
     */
    function _mint(address to, uint256 amount0, uint256 amount1) 
        private 
        returns (uint256 liquidity) 
    {
        uint256 _totalSupply = totalSupply();

        if (_totalSupply == 0) {
            liquidity = sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            _mint(address(1), MINIMUM_LIQUIDITY); // Lock minimum liquidity
        } else {
            liquidity = min(
                (amount0 * _totalSupply) / reserve0,
                (amount1 * _totalSupply) / reserve1
            );
        }

        require(liquidity > 0, "Insufficient liquidity minted");
        _mint(to, liquidity);

        _update(
            token0.balanceOf(address(this)),
            token1.balanceOf(address(this))
        );

        emit Mint(msg.sender, amount0, amount1);
    }

    /**
     * @dev Update reserves
     */
    function _update(uint256 balance0, uint256 balance1) private {
        reserve0 = balance0;
        reserve1 = balance1;
        emit Sync(reserve0, reserve1);
    }

    /**
     * @dev Add supported token
     */
    function addSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = true;
        emit TokenAdded(token);
    }

    /**
     * @dev Remove supported token
     */
    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
        emit TokenRemoved(token);
    }

    /**
     * @dev Update trading engine
     */
    function updateTradingEngine(address newEngine) external onlyOwner {
        require(newEngine != address(0), "Invalid address");
        address oldEngine = tradingEngine;
        tradingEngine = newEngine;
        emit TradingEngineUpdated(oldEngine, newEngine);
    }

    /**
     * @dev Update fee rate
     */
    function updateFeeRate(uint256 newFeeRate) external onlyOwner {
        require(newFeeRate <= 100, "Fee too high"); // Max 1%
        feeRate = newFeeRate;
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

    // Math helpers
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function min(uint256 x, uint256 y) internal pure returns (uint256) {
        return x < y ? x : y;
    }
}
