import { keccak256, encodeAbiParameters, parseAbiParameters, getAddress } from 'viem'

// Function to calculate pool ID from pool parameters
export function calculatePoolId(token0Address, token1Address, hookAddress) {
  console.log('Calculating pool ID for:', { token0Address, token1Address, hookAddress })
  
  try {
    // Sort token addresses to ensure consistent ordering
    const [currency0, currency1] = [token0Address, token1Address].sort((a, b) => 
      getAddress(a).toLowerCase() < getAddress(b).toLowerCase() ? -1 : 1
    )

    console.log('Sorted addresses:', { currency0, currency1 })

    // Fixed parameters from the contract
    const FEE_TIER = 3000 // 0.3%
    const TICK_SPACING = 60

    // Encode pool key parameters using proper ABI encoding
    const encodedData = encodeAbiParameters(
      parseAbiParameters('address,address,uint24,int24,address'),
      [currency0, currency1, FEE_TIER, TICK_SPACING, hookAddress]
    )

    console.log('Encoded data:', encodedData)

    // Calculate pool ID using keccak256
    const poolId = keccak256(encodedData)
    console.log('Calculated pool ID:', poolId)

    return poolId
  } catch (error) {
    console.error('Error calculating pool ID:', error)
    throw error
  }
}
