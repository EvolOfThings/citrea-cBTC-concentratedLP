// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.24;

// import {Test} from "forge-std/Test.sol";
// import {ConcentratedIncentivesHook} from "../src/ConcentratedIncentivesHook.sol";
// import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
// import {PoolKey} from "v4-core/src/types/PoolKey.sol";
// import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
// import {Currency} from "v4-core/src/types/Currency.sol";
// import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
// import {MockERC20} from "./mocks/MockERC20.sol";
// import {PoolManager} from "v4-core/src/PoolManager.sol";
// import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import {BaseHook} from "v4-periphery/src/base/hooks/BaseHook.sol";
// import {Constants} from "v4-core/src/test/utils/Constants.sol";
// import {TickMath} from "v4-core/src/libraries/TickMath.sol";
// import {Hooks} from "v4-core/src/libraries/Hooks.sol";

// contract TestConcentratedIncentivesHook is ConcentratedIncentivesHook {
//     constructor(
//         IPoolManager _poolManager,
//         IERC20 _governanceToken,
//         Currency _token0,
//         Currency _token1
//     ) ConcentratedIncentivesHook(_poolManager, _governanceToken, _token0, _token1) {}

//     function validateHookAddress(BaseHook _this) internal pure override {}
// }

// contract ConcentratedIncentivesHookTest is Test {
//     using PoolIdLibrary for PoolKey;

//     bytes constant ZERO_BYTES = bytes("");
//     IPoolManager public manager;
//     TestConcentratedIncentivesHook public hook;
//     MockERC20 public token0;
//     MockERC20 public token1;
//     MockERC20 public governanceToken;
//     PoolKey poolKey;
//     PoolId poolId;
//     uint256 constant INITIAL_PRICE = 1000;
//     uint8 constant RANGE_PERCENTAGE = 10;

//     function setUp() public {
//         // Deploy tokens
//         token0 = new MockERC20("Token0", "TK0", 18);
//         token1 = new MockERC20("Token1", "TK1", 18);
//         governanceToken = new MockERC20("Governance", "GOV", 18);

//         // Deploy manager
//         manager = new PoolManager(address(this));

//         // Ensure token0 has lower address than token1
//         if (address(token0) > address(token1)) {
//             (token0, token1) = (token1, token0);
//         }

//         // Deploy hook
//         hook = new TestConcentratedIncentivesHook(
//             manager,
//             governanceToken,
//             Currency.wrap(address(token0)),
//             Currency.wrap(address(token1))
//         );

//         // Setup pool key
//         poolKey = PoolKey({
//             currency0: Currency.wrap(address(token0)),
//             currency1: Currency.wrap(address(token1)),
//             fee: 3000,
//             tickSpacing: 60,
//             hooks: IHooks(address(hook))
//         });

//         // Mint tokens
//         token0.mint(address(this), 10000e18);
//         token1.mint(address(this), 10000e18);
//         governanceToken.mint(address(hook), 10000e18);

//         // Approve tokens
//         token0.approve(address(manager), type(uint256).max);
//         token1.approve(address(manager), type(uint256).max);
//     }

//     function test_initializePool() public {
//         poolId = hook.initializePool(INITIAL_PRICE, RANGE_PERCENTAGE);
//         assertTrue(hook.initialized(poolId), "Pool should be initialized");
//     }

//     function test_addLiquidity() public {
//         // First initialize the pool
//         poolId = hook.initializePool(INITIAL_PRICE, RANGE_PERCENTAGE);
        
//         // Get the incentive range
//         (int24 tickLower, int24 tickUpper) = hook.getPriceTickRange(INITIAL_PRICE, RANGE_PERCENTAGE);
        
//         // Add liquidity
//         manager.modifyLiquidity(
//             poolKey,
//             IPoolManager.ModifyLiquidityParams({
//                 tickLower: tickLower,
//                 tickUpper: tickUpper,
//                 liquidityDelta: int256(1000e18),
//                 salt: bytes32(0)
//             }),
//             ZERO_BYTES
//         );

//         // Verify position is active and within range
//         (bool isActive, int24 posTickLower, int24 posTickUpper, uint256 lastClaimTime) = hook.positions(poolId, address(this));
//         assertTrue(isActive, "Position should be active");
//         assertEq(posTickLower, tickLower, "Incorrect lower tick");
//         assertEq(posTickUpper, tickUpper, "Incorrect upper tick");
//         assertTrue(hook.isInIncentivizedRange(poolId, tickLower, tickUpper), "Position should be in incentivized range");
//     }

//     function test_removeLiquidity() public {
//         // First add liquidity
//         test_addLiquidity();
        
//         (int24 tickLower, int24 tickUpper) = hook.getPriceTickRange(INITIAL_PRICE, RANGE_PERCENTAGE);
        
//         // Remove liquidity
//         manager.modifyLiquidity(
//             poolKey,
//             IPoolManager.ModifyLiquidityParams({
//                 tickLower: tickLower,
//                 tickUpper: tickUpper,
//                 liquidityDelta: -int256(1000e18),
//                 salt: bytes32(0)
//             }),
//             ZERO_BYTES
//         );

//         // Verify position is deactivated
//         (bool isActive, int24 posTickLower, int24 posTickUpper, uint256 lastClaimTime) = hook.positions(poolId, address(this));
//         assertFalse(isActive, "Position should be deactivated");
//     }

//     function test_claimRewards() public {
//         // First add liquidity
//         test_addLiquidity();
        
//         // Move time forward past cooldown
//         vm.warp(block.timestamp + hook.CLAIM_COOLDOWN() + 1);
        
//         // Get balance before claim
//         uint256 balanceBefore = governanceToken.balanceOf(address(this));
        
//         // Claim rewards
//         hook.claimRewards(poolKey);
        
//         // Verify rewards received
//         uint256 balanceAfter = governanceToken.balanceOf(address(this));
//         assertEq(balanceAfter - balanceBefore, hook.REWARD_AMOUNT(), "Should receive correct reward amount");
//     }

//     function test_incentiveRange() public {
//         // Initialize pool
//         poolId = hook.initializePool(INITIAL_PRICE, RANGE_PERCENTAGE);
        
//         // Get current range
//         (int24 tickLower, int24 tickUpper) = hook.getPriceTickRange(INITIAL_PRICE, RANGE_PERCENTAGE);
        
//         // Verify range is set correctly
//         (int24 rangeLower, int24 rangeUpper) = hook.incentiveRanges(poolId);
//         assertEq(rangeLower, tickLower, "Lower tick should match");
//         assertEq(rangeUpper, tickUpper, "Upper tick should match");
        
//         // Verify position within range is incentivized
//         assertTrue(hook.isInIncentivizedRange(poolId, tickLower, tickUpper), "Position should be in range");
        
//         // Verify position outside range is not incentivized
//         assertFalse(hook.isInIncentivizedRange(poolId, tickLower - 100, tickUpper + 100), "Position should be out of range");
//     }
// }