# cBTC Liquidity Booster

Concentrated Incentives UniSwap Hook for the cBTC/USDC pair on Citrea


This hook incentivizes liquidity provision only within active price ranges (ticks). By rewarding liquidity providers who concentrate their liquidity in these ranges, it enhances capital efficiency and reduces impermanent loss. It rewards with a Governance token only to those who provide liquidity in these active ranges.


This is a ConcentratedIncentivesHook contract that incentivizes liquidity providers (LPs) to provide liquidity within specific price ranges in a Uniswap V4 pool. It rewards LPs with governance tokens when they provide liquidity within the desired price range.



1. getHookPermissions():
- Defines which hook callbacks the contract wants to implement
- Enables: beforeInitialize, beforeAddLiquidity, afterAddLiquidity, and beforeRemoveLiquidity
- All other hooks are disabled (set to false)

2. beforeInitialize():
- Called before a pool is initialized
- Marks the pool as initialized in the contract's state
- Returns the function selector to indicate successful execution

3. beforeAddLiquidity() and afterAddLiquidity():
- beforeAddLiquidity: Called before liquidity is added to the pool
- afterAddLiquidity: Called after liquidity is added
    - Updates the user's position information with new tick ranges
    - Records the position as active and sets the last claim time

4. beforeRemoveLiquidity():
- Called when liquidity is being removed
- Deactivates the user's position in the pool

5. initializePool(uint256 initialPrice, uint8 percentageRange):
- Creates a new pool with specified initial price and range
- Sets up the pool key with token pair, fee tier, and tick spacing
- Calculates the initial price range based on the percentage
- Initializes the pool with the calculated sqrt price
- Sets up initial incentive ranges for rewards

6. getPriceTickRange(uint256 basePrice, uint8 percentageRange):
- Calculates the lower and upper tick bounds for a given price and percentage range
- Ensures the percentage range is valid (between 1 and 100)
- Converts prices to ticks using Uniswap's TickMath library

7. isInIncentivizedRange():
- Checks if a position's tick range falls within the incentivized range
- Used to determine if a position is eligible for rewards

8. claimRewards():
- Allows users to claim rewards if their position meets certain conditions:
    - Position must be active
    - Cooldown period must have elapsed (24 hours)
    - Position must be within the incentivized range
- Transfers governance tokens as rewards

9. updateIncentiveRange():
- Admin function to update the incentivized range for a pool
- Sets new lower and upper tick bounds for rewards

Key Features:
- Uses a 0.3% fee tier (FEE_TIER = 3000)
- Fixed reward amount of 100 tokens (REWARD_AMOUNT = 100 * 1e18)
- 24-hour cooldown between reward claims
- Tracks liquidity positions and their ranges
- Implements concentrated liquidity incentives within specific price ranges

This hook is designed to incentivize liquidity providers to provide liquidity within specific price ranges by offering rewards in the form of governance tokens. It's particularly useful for maintaining tight liquidity around specific price points.



POOL_MANAGER_ADDRESS: 0x8c4bcbe6b9ef47855f97e675296fa3f6fafa5f1a
GOVERNANCE_TOKEN_ADDRESS: 0x71D2521BeC8EBB3DB2983337d7fAa056886A8D08
TOKEN0_ADDRESS: 0x28665DC05b3E3603F81A86aac434fe4953877be1 // cBTC
TOKEN1_ADDRESS: 0x7B6db83ad69E6afe0bfF063eeA561C511a05eFfb // USDC

HookFactory: 0x9015B7d32A846c01c78A18aF225c2FaA7FcDEA25
Hook: 0xeef055936d3bb1cd2b865975bba95544a90e8c65
