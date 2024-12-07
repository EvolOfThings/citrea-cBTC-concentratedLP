// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "v4-periphery/src/base/hooks/BaseHook.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";

contract ConcentratedIncentivesHook is BaseHook {
    using PoolIdLibrary for PoolKey;

    // Pool initialization flag
    mapping(PoolId => bool) public initialized;
    
    // Token addresses for the pool
    Currency public immutable token0;
    Currency public immutable token1;
    uint24 public constant FEE_TIER = 3000; // 0.3% fee tier

    // Track LP positions and their ranges
    struct LiquidityPosition {
        bool isActive;
        int24 tickLower;
        int24 tickUpper;
        uint256 lastClaimTime; // for governance token rewards
    }

    // Target range for incentives
    struct IncentiveRange {
        int24 tickLower;
        int24 tickUpper;
    }

    // Mappings
    mapping(PoolId => mapping(address => LiquidityPosition)) public positions;
    mapping(PoolId => IncentiveRange) public incentiveRanges;
    
    // Fixed reward amount per claim
    uint256 public constant REWARD_AMOUNT = 100 * 1e18;
    uint256 public constant CLAIM_COOLDOWN = 24 hours;

    // Governance token for rewards
    IERC20 public immutable governanceToken;

    event PoolInitialized(PoolId indexed poolId, uint160 sqrtPriceX96, int24 tickLower, int24 tickUpper);
    event LiquidityPositionUpdated(address indexed provider, PoolId indexed poolId, int24 tickLower, int24 tickUpper);
    event RewardsClaimed(address indexed provider, PoolId indexed poolId, uint256 amount);
    event IncentiveRangeUpdated(PoolId indexed poolId, int24 newTickLower, int24 newTickUpper);

    constructor(
        IPoolManager _poolManager, 
        IERC20 _governanceToken, 
        Currency _token0, 
        Currency _token1
    ) BaseHook(_poolManager) {
        token0 = _token0;
        token1 = _token1;
        governanceToken = _governanceToken;
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize: false,
            beforeAddLiquidity: true,
            afterAddLiquidity: true,
            beforeRemoveLiquidity: true,
            afterRemoveLiquidity: false,
            beforeSwap: false,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeAddLiquidityReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function beforeInitialize(
        address sender, 
        PoolKey calldata key, 
        uint160 sqrtPriceX96
    ) external override returns (bytes4) {
        // Mark pool as initialized
        initialized[key.toId()] = true;
        return BaseHook.beforeInitialize.selector;
    }

    function afterAddLiquidity(
        address sender,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata params,
        BalanceDelta,
        bytes calldata hookData
    ) external override returns (bytes4) {
        PoolId poolId = key.toId();
        positions[poolId][sender] = LiquidityPosition({
            isActive: true,
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            lastClaimTime: 0
        });

        emit LiquidityPositionUpdated(sender, poolId, params.tickLower, params.tickUpper);
        return BaseHook.afterAddLiquidity.selector;
    }

    function beforeRemoveLiquidity(
        address sender,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external override returns (bytes4) {
        PoolId poolId = key.toId();
        positions[poolId][sender].isActive = false;
        return BaseHook.beforeRemoveLiquidity.selector;
    }

    // initialize Pool function with percentage range, called externally after deploying the contract
    function initializePool(
        uint256 initialPrice, 
        uint8 percentageRange
        ) external returns (PoolId) {
        PoolKey memory poolKey = PoolKey({
            currency0: token0,
            currency1: token1,
            fee: FEE_TIER, //lpFee
            tickSpacing: 60,
            hooks: IHooks(address(this)) // hookContract
        });
        
        // generates a unique identifier for the pool based on its key properties 
        // and that can be used to reference this specific pool.
        PoolId poolId = poolKey.toId();
        require(!initialized[poolId], "Pool already initialized");

        // Convert price to sqrtPriceX96 format
        uint160 sqrtPriceX96 = calculateSqrtPriceX96(initialPrice);
        (int24 initialTickLower, int24 initialTickUpper) = getPriceTickRange(
            initialPrice,
            percentageRange
        );


        poolManager.initialize(poolKey, sqrtPriceX96); // Here's where we set the initial price
        initialized[poolId] = true;
        
        // Set initial incentive range
        incentiveRanges[poolId] = IncentiveRange({
            tickLower: initialTickLower,
            tickUpper: initialTickUpper
        });

        emit PoolInitialized(poolId, sqrtPriceX96, initialTickLower, initialTickUpper);
        return poolId;
    }

    // function to calculate sqrtPriceX96 from regular price
    function calculateSqrtPriceX96(uint256 price) public pure returns (uint160) {
        // price = price of token0(cBTC) in terms of token1(USDC)
        // if cBTC = 40,000 USDC, price = 40,000
        
        // square root of the price
        uint256 sqrtPrice = sqrt(price);
        
        // Multiply by 2^96 and convert to uint160
        return uint160((sqrtPrice * (1 << 96)) / (1 << 48));
    }

    // function to calculate square root
    function sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        
        uint256 result = 1;
        uint256 x1 = x;
        uint256 x2 = x;
        
        while (x1 > result) {
            x1 = result;
            x2 = (x2 + (x / x2)) >> 1;
            result = x2;
        }
        
        return result;
    }

    function getPriceTickRange(uint256 basePrice, uint8 percentageRange) public pure returns (int24 tickLower, int24 tickUpper) {
        require(percentageRange > 0 && percentageRange <= 100, "Invalid range percentage");
        
        // Calculate price range
        uint256 lowerPrice = basePrice * (100 - percentageRange) / 100;
        uint256 upperPrice = basePrice * (100 + percentageRange) / 100;
        
        // Convert to sqrt price X96 format
        uint160 sqrtPriceLowerX96 = calculateSqrtPriceX96(lowerPrice);
        uint160 sqrtPriceUpperX96 = calculateSqrtPriceX96(upperPrice);
        
        // Get nearest valid ticks
        tickLower = TickMath.getTickAtSqrtRatio(sqrtPriceLowerX96);
        tickUpper = TickMath.getTickAtSqrtRatio(sqrtPriceUpperX96);
    }

    // Check if position is within incentivized range and returns true or false
    function isInIncentivizedRange(
        PoolId poolId,
        int24 tickLower,
        int24 tickUpper
    ) public view returns (bool) {
        IncentiveRange memory range = incentiveRanges[poolId];
        return tickLower >= range.tickLower && tickUpper <= range.tickUpper;
    }

    // Claim rewards if position is within range
    function claimRewards(PoolKey calldata key) external {
        PoolId poolId = key.toId();
        LiquidityPosition storage position = positions[poolId][msg.sender];
        
        require(position.isActive, "Not an active liquidity provider");
        require(
            block.timestamp >= position.lastClaimTime + CLAIM_COOLDOWN,
            "Cooldown period not met"
        );
        require(
            isInIncentivizedRange(poolId, position.tickLower, position.tickUpper),
            "Position not in incentivized range"
        );

        position.lastClaimTime = block.timestamp;
        require(
            governanceToken.transfer(msg.sender, REWARD_AMOUNT),
            "Reward transfer failed"
        );

        emit RewardsClaimed(msg.sender, poolId, REWARD_AMOUNT);
    }

    // Admin function to update incentive range
    function updateIncentiveRange(
        PoolKey calldata key,
        int24 newTickLower,
        int24 newTickUpper
    ) external {
        // Add access control as needed
        require(newTickLower < newTickUpper, "Invalid range");
        
        PoolId poolId = key.toId();
        incentiveRanges[poolId] = IncentiveRange({
            tickLower: newTickLower,
            tickUpper: newTickUpper
        });

        emit IncentiveRangeUpdated(poolId, newTickLower, newTickUpper);
    }
}