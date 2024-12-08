'use client'

import { useState, useMemo, useEffect } from 'react'
import { useContractWrite, useWaitForTransaction, useNetwork, decodeEventLog, useContractRead } from 'wagmi'
import { abi } from '../abi/ConcentratedIncentivesHook.json'
import { getContractAddress } from '../config/contracts'
import { calculatePoolId } from '../utils/poolUtils'

// Token addresses from deployment script
const TOKEN0_ADDRESS = '0x28665DC05b3E3603F81A86aac434fe4953877be1'
const TOKEN1_ADDRESS = '0x7B6db83ad69E6afe0bfF063eeA561C511a05eFfb'

// Helper function to convert price to correct decimal format
function convertPrice(price) {
  // price = USDC/cBTC
  // We need to scale down the price to avoid overflows
  // Use 1e6 as the base unit (USDC decimals)
  return BigInt(Math.floor(Number(price) * 100)) // Scale by 100 instead of 1e6
}

export default function PoolCreation() {
  const { chain } = useNetwork()
  const hookAddress = getContractAddress(chain?.id || 11155111, 'ConcentratedIncentivesHook')
  
  const [initialPrice, setInitialPrice] = useState('')
  const [percentageRange, setPercentageRange] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [poolId, setPoolId] = useState('')

  // Calculate pool ID
  const calculatedPoolId = useMemo(() => {
    const id = calculatePoolId(TOKEN0_ADDRESS, TOKEN1_ADDRESS, hookAddress)
    console.log('Calculated Pool ID:', id)
    return id
  }, [hookAddress])

  // Check if pool exists by checking token0
  const { data: poolToken0, isError: token0Error } = useContractRead({
    address: hookAddress,
    abi,
    functionName: 'token0',
    watch: true,
  })

  // Get incentive range data
  const { data: incentiveRange, isError: incentiveError } = useContractRead({
    address: hookAddress,
    abi,
    functionName: 'incentiveRanges',
    args: [calculatedPoolId],
    watch: true,
    onError(error) {
      console.error('Incentive range read error:', error)
    },
    onSuccess(data) {
      console.log('Raw incentive range data:', data)
      console.log('Data type:', typeof data)
      if (Array.isArray(data)) {
        console.log('Tick values:', {
          lower: data[0]?.toString(),
          upper: data[1]?.toString()
        })
      }
    }
  })

  // Extract tick values from array
  const tickLower = useMemo(() => incentiveRange?.[0], [incentiveRange])
  const tickUpper = useMemo(() => incentiveRange?.[1], [incentiveRange])

  // Check if pool is initialized
  const isPoolInitialized = useMemo(() => {
    console.log('Pool Token0:', poolToken0)
    console.log('Expected Token0:', TOKEN0_ADDRESS)
    console.log('Is Initialized:', poolToken0 && poolToken0.toLowerCase() === TOKEN0_ADDRESS.toLowerCase())
    return poolToken0 && poolToken0.toLowerCase() === TOKEN0_ADDRESS.toLowerCase()
  }, [poolToken0])

  // Log pool data changes
  useEffect(() => {
    console.log('Incentive Range Raw:', incentiveRange)
    if (Array.isArray(incentiveRange)) {
      console.log('Tick Values:', {
        lower: incentiveRange[0]?.toString(),
        upper: incentiveRange[1]?.toString()
      })
    }
    console.log('Pool State:', {
      isInitialized: isPoolInitialized,
      poolId,
      hasIncentiveRange: !!incentiveRange,
      tickLower: tickLower?.toString(),
      tickUpper: tickUpper?.toString()
    })
  }, [incentiveRange, isPoolInitialized, poolId, tickLower, tickUpper])

  useEffect(() => {
    setPoolId(calculatedPoolId)
    localStorage.setItem('lastPoolId', calculatedPoolId)
  }, [calculatedPoolId])

  // Calculate conversions and price range
  const calculations = useMemo(() => {
    if (!initialPrice || isNaN(initialPrice) || initialPrice <= 0) return null;
    if (!percentageRange || isNaN(percentageRange) || percentageRange <= 0 || percentageRange > 100) return null;
    
    const price = Number(initialPrice);
    const range = Number(percentageRange);
    
    return {
      conversion: (1 / price).toFixed(8),
      lowerPrice: (price * (100 - range) / 100).toFixed(2),
      upperPrice: (price * (100 + range) / 100).toFixed(2),
      priceSpread: (price * range * 2 / 100).toFixed(2)
    }
  }, [initialPrice, percentageRange])

  const getRangeInfo = (range) => {
    if (!range) return { text: '', bgColor: '', borderColor: '' };
    const rangeNum = Number(range);
    if (rangeNum <= 10) return {
      text: 'Highly concentrated liquidity - Better rates, but only works in a narrow price range',
      bgColor: 'bg-emerald-900/30',
      borderColor: 'border-emerald-500/50'
    };
    if (rangeNum <= 30) return {
      text: 'Moderately concentrated - Balanced between trading efficiency and price coverage',
      bgColor: 'bg-blue-900/30',
      borderColor: 'border-blue-500/50'
    };
    return {
      text: 'Widely distributed liquidity - Works across larger price movements, but with higher slippage',
      bgColor: 'bg-purple-900/30',
      borderColor: 'border-purple-500/50'
    };
  }

  const { data: writeData, write, isLoading: isWriteLoading, error: writeError } = useContractWrite({
    address: hookAddress,
    abi,
    functionName: 'initializePool',
    onError: (error) => {
      console.error('Contract write error:', error)
      if (error.message.includes('Pool already initialized')) {
        setError('This pool has already been initialized. You can now add liquidity to it.')
      } else {
        setError(error.message)
      }
    }
  })

  const { isLoading: isConfirming, isSuccess } = useWaitForTransaction({
    hash: writeData?.hash,
    onSuccess: async (data) => {
      console.log('Transaction successful:', data)
      console.log('Transaction logs:', data.logs)
      
      // Calculate the pool ID deterministically
      const calculatedPoolId = calculatePoolId(TOKEN0_ADDRESS, TOKEN1_ADDRESS, hookAddress)
      console.log('Calculated pool ID:', calculatedPoolId)
      
      // Store the calculated pool ID
      localStorage.setItem('lastPoolId', calculatedPoolId)
      
      // Find the PoolInitialized event from the logs
      const poolInitializedEvent = data.logs.find(log => {
        try {
          const decoded = decodeEventLog({
            abi,
            data: log.data,
            topics: log.topics,
          })
          console.log('Decoded log:', decoded)
          return decoded.eventName === 'PoolInitialized'
        } catch (error) {
          console.error('Error decoding log:', error)
          return false
        }
      })

      if (poolInitializedEvent) {
        console.log('Found PoolInitialized event:', poolInitializedEvent)
        const decoded = decodeEventLog({
          abi,
          data: poolInitializedEvent.data,
          topics: poolInitializedEvent.topics,
        })
        console.log('Decoded PoolInitialized event:', decoded)
        
        // Compare the event pool ID with our calculated one
        if (decoded.args.poolId !== calculatedPoolId) {
          console.error('Pool ID mismatch:', {
            calculated: calculatedPoolId,
            fromEvent: decoded.args.poolId
          })
        }
      }
    },
    onError: (error) => {
      console.error('Transaction error:', error)
    }
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!initialPrice || !percentageRange) return

    if (isPoolInitialized) {
      setError('This pool has already been initialized. You can now add liquidity to it.')
      return
    }

    try {
      const scaledPrice = convertPrice(initialPrice)
      console.log('Scaled price:', scaledPrice)
      
      write({
        args: [scaledPrice, Number(percentageRange)]
      })
    } catch (err) {
      console.error('Error creating pool:', err)
      setError(err.message)
    }
  }

  // Format tick to price with correct Uniswap V4 formula
  const formatTickToPrice = (tick) => {
    if (!tick && tick !== 0) return '0'
    const tickValue = typeof tick === 'bigint' ? Number(tick) : tick
    
    // Uniswap tick to price formula: price = 1.0001^(tick/2)
    // Divide tick by 2 to get the correct price scaling
    const price = Math.exp((tickValue / 2) * Math.log(1.0001))
    
    // Format with commas and appropriate decimals
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true
    }).format(price)
  }

  // Calculate price range percentage from ticks with safety checks
  const calculatePriceRangePercentage = (lowerTick, upperTick) => {
    if ((!lowerTick && lowerTick !== 0) || (!upperTick && upperTick !== 0)) return '0'
    
    // Convert ticks to numbers
    const lower = typeof lowerTick === 'bigint' ? Number(lowerTick) : lowerTick
    const upper = typeof upperTick === 'bigint' ? Number(upperTick) : upperTick
    
    // Calculate prices using the same formula as formatTickToPrice
    const lowerPrice = Math.exp((lower / 2) * Math.log(1.0001))
    const upperPrice = Math.exp((upper / 2) * Math.log(1.0001))
    const midPrice = Math.sqrt(lowerPrice * upperPrice)
    
    // Calculate percentage difference
    const percentage = ((upperPrice - lowerPrice) / midPrice) * 100
    return (percentage / 2).toFixed(2)
  }

  // Display pool details
  const renderPoolDetails = () => {
    if (!isPoolInitialized) return null

    return (
      <div className="mt-4 p-4 bg-blue-900/20 rounded-lg border border-blue-500/30">
        <h3 className="text-lg font-semibold mb-2 text-blue-400">Pool Details</h3>
        <div className="space-y-2 text-sm text-gray-300">
          {incentiveRange && (
            <>
              <p>Price Range: <span className="text-blue-400">±{calculatePriceRangePercentage(tickLower, tickUpper)}%</span></p>
              <div className="flex flex-col gap-1">
                <p>Price Range (USDC per cBTC):</p>
                <div className="pl-4 space-y-1">
                  <p>Lower: <span className="text-blue-400">${formatTickToPrice(tickLower)}</span></p>
                  <p>Upper: <span className="text-blue-400">${formatTickToPrice(tickUpper)}</span></p>
                </div>
              </div>
              <div className="mt-2 p-2 bg-blue-900/30 border border-blue-500/20 rounded text-xs">
                <p>💡 Liquidity providers should add liquidity within this price range to earn rewards.</p>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800/50 backdrop-blur-lg p-6 rounded-xl border border-gray-700 shadow-xl">
        <h2 className="text-2xl font-semibold mb-6 text-blue-400">Create Pool</h2>
        
        {error && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-500/50 rounded-lg">
            <p className="text-gray-200">{error}</p>
          </div>
        )}

        {writeData?.hash && (
          <div className="mb-4 p-4 bg-blue-900/30 border border-blue-500/50 rounded-lg">
            <p className="text-sm text-gray-300">Transaction Hash:</p>
            <a 
              href={`https://sepolia.etherscan.io/tx/${writeData.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 break-all"
            >
              {writeData.hash}
            </a>
            {isConfirming && (
              <p className="mt-2 text-yellow-400">
                Transaction confirming... Please wait.
              </p>
            )}
            {isSuccess && (
              <p className="mt-2 text-emerald-400">
                Pool created successfully!
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Initial Price (USDC/cBTC)
            </label>
            <input
              type="number"
              step="0.000001"
              value={initialPrice}
              onChange={(e) => setInitialPrice(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
              placeholder="Enter initial price"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Price Range Percentage
            </label>
            <input
              type="number"
              step="0.1"
              value={percentageRange}
              onChange={(e) => setPercentageRange(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
              placeholder="Enter price range percentage"
            />
          </div>
          {isPoolInitialized && (
            <div className="p-3 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
              <p className="text-sm text-yellow-400">
                ⚠️ This pool is already initialized. Creating it again may result in a failed transaction.
              </p>
            </div>
          )}
          <button
            type="submit"
            disabled={isWriteLoading || isConfirming || !initialPrice || !percentageRange}
            className={`w-full py-2 px-4 rounded-lg font-medium ${
              isWriteLoading || isConfirming || !initialPrice || !percentageRange
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {isWriteLoading || isConfirming ? 'Creating Pool...' : 'Create Pool'}
          </button>
        </form>
      </div>

      {/* Pool Information */}
      <div className="bg-gray-800/50 backdrop-blur-lg p-6 rounded-xl border border-blue-700/50 shadow-xl">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">
              {isPoolInitialized ? (
                <span className="text-green-400">✓ Pool is ready</span>
              ) : (
                <span className="text-yellow-400">⚠ Pool needs initialization</span>
              )}
            </span>
          </div>
          {renderPoolDetails()}
        </div>
      </div>
    </div>
  )
}
