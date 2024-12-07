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

    bytes internal constant ZERO_BYTES = bytes("");
    IPoolManager public immutable manager;

    // Pool initialization flag
    mapping(PoolId => bool) public initialized;
    
    // Token addresses for the pool
    Currency public immutable token0;
    Currency public immutable token1;

    // Governance token for rewards
    IERC20 public immutable governanceToken;

    uint24 public constant FEE_TIER = 3000; // 0.3% fee tier
    uint256 public constant REWARD_AMOUNT = 100 * 1e18;
    uint256 public constant CLAIM_COOLDOWN = 24 hours;

    // Track LP positions and their ranges
    struct LiquidityPosition {
        bool isActive;
        int24 tickLower;
        int24 tickUpper;
        uint256 lastClaimTime;
    }

    // Target range for incentives
    struct IncentiveRange {
        int24 tickLower;
        int24 tickUpper;
    }

    // Mappings
    mapping(PoolId => mapping(address => LiquidityPosition)) public positions;
    mapping(PoolId => IncentiveRange) public incentiveRanges;

    event PoolInitialized(PoolId indexed poolId, uint160 sqrtPriceX96, int24 tickLower, int24 tickUpper);
    event LiquidityPositionUpdated(address indexed provider, PoolId indexed poolId, int24 tickLower, int24 tickUpper);
    event PositionDeactivated(address indexed provider, PoolId indexed poolId);
    event RewardsClaimed(address indexed provider, PoolId indexed poolId, uint256 amount);
    event IncentiveRangeUpdated(PoolId indexed poolId, int24 newTickLower, int24 newTickUpper);

    constructor(
        IPoolManager _poolManager,
        IERC20 _governanceToken,
        Currency _token0,
        Currency _token1
    ) BaseHook(_poolManager) {
        manager = _poolManager;
        governanceToken = _governanceToken;
        token0 = _token0;
        token1 = _token1;
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeSwap: false,
            afterSwap: false,
            beforeAddLiquidity: true,
            afterAddLiquidity: true,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeDonate: false,
            afterDonate: false,
            afterSwapReturnDelta: false,
            beforeSwapReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false,
            afterAddLiquidityReturnDelta: false
        });
    }

    function validateHookAddress(BaseHook _this) internal pure override {
        // Validation is handled by the factory
    }

    function beforeInitialize(
        address,
        PoolKey calldata key,
        uint160
    ) external override returns (bytes4) {
        initialized[key.toId()] = true;
        return BaseHook.beforeInitialize.selector;
    }

    function beforeAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external override returns (bytes4) {
        return BaseHook.beforeAddLiquidity.selector;
    }

    function afterAddLiquidity(
        address sender,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata params,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external override returns (bytes4, BalanceDelta) {
        _updatePosition(key.toId(), sender, params.tickLower, params.tickUpper);
        return (BaseHook.afterAddLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeRemoveLiquidity(
        address sender,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external override returns (bytes4) {
        _deactivatePosition(key.toId(), sender);
        return BaseHook.beforeRemoveLiquidity.selector;
    }

    function _updatePosition(PoolId poolId, address provider, int24 tickLower, int24 tickUpper) internal {
        positions[poolId][provider] = LiquidityPosition({
            isActive: true,
            tickLower: tickLower,
            tickUpper: tickUpper,
            lastClaimTime: block.timestamp
        });
        emit LiquidityPositionUpdated(provider, poolId, tickLower, tickUpper);
    }

    function _deactivatePosition(PoolId poolId, address provider) internal {
        positions[poolId][provider].isActive = false;
        emit PositionDeactivated(provider, poolId);
    }

    function initializePool(uint256 initialPrice, uint8 percentageRange) external returns (PoolId) {
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
        (int24 initialTickLower, int24 initialTickUpper) = getPriceTickRange(initialPrice, percentageRange);

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

    function getPriceTickRange(uint256 basePrice, uint8 percentageRange) public pure returns (int24 tickLower, int24 tickUpper) {
        require(percentageRange > 0 && percentageRange <= 100, "Invalid range percentage");
        
        // Calculate price range
        uint256 lowerPrice = basePrice * (100 - percentageRange) / 100;
        uint256 upperPrice = basePrice * (100 + percentageRange) / 100;
        
        return (TickMath.getTickAtSqrtPrice(calculateSqrtPriceX96(lowerPrice)), TickMath.getTickAtSqrtPrice(calculateSqrtPriceX96(upperPrice)));
    }

    function isInIncentivizedRange(PoolId poolId, int24 tickLower, int24 tickUpper) public view returns (bool) {
        IncentiveRange storage range = incentiveRanges[poolId];
        return tickLower >= range.tickLower && tickUpper <= range.tickUpper;
    }

    // Claim rewards if position is within range
    function claimRewards(PoolKey calldata key) external {
        PoolId poolId = key.toId();
        LiquidityPosition storage position = positions[poolId][msg.sender];
        require(position.isActive, "No active position");
        require(block.timestamp >= position.lastClaimTime + CLAIM_COOLDOWN, "Cooldown not elapsed");
        require(
            isInIncentivizedRange(poolId, position.tickLower, position.tickUpper),
            "Position not in incentivized range"
        );

        position.lastClaimTime = block.timestamp;
        governanceToken.transfer(msg.sender, REWARD_AMOUNT);

        emit RewardsClaimed(msg.sender, poolId, REWARD_AMOUNT);
    }

    function calculateSqrtPriceX96(uint256 price) internal pure returns (uint160) {
        return uint160(int160(int256(price)) << 96);
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