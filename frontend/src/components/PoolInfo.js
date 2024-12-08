'use client'

import { useMemo, useEffect } from 'react'
import { useContractRead, useNetwork } from 'wagmi'
import { abi } from '../abi/ConcentratedIncentivesHook.json'
import { getContractAddress } from '../config/contracts'
import { calculatePoolId } from '../utils/poolUtils'
import { abi as erc20ABI } from '../abi/erc20.json'

// Token addresses from deployment script
const TOKEN0_ADDRESS = '0x28665DC05b3E3603F81A86aac434fe4953877be1'
const TOKEN1_ADDRESS = '0x7B6db83ad69E6afe0bfF063eeA561C511a05eFfb'

export default function PoolInfo() {
  const { chain } = useNetwork()
  const hookAddress = getContractAddress(chain?.id || 11155111, 'ConcentratedIncentivesHook')

  // Get token symbols
  const { data: token0Symbol } = useContractRead({
    address: TOKEN0_ADDRESS,
    abi: erc20ABI,
    functionName: 'symbol',
  })

  const { data: token1Symbol } = useContractRead({
    address: TOKEN1_ADDRESS,
    abi: erc20ABI,
    functionName: 'symbol',
  })

  // Calculate pool ID
  const poolId = useMemo(() => {
    const id = calculatePoolId(TOKEN0_ADDRESS, TOKEN1_ADDRESS, hookAddress)
    console.log('Calculated pool ID:', id)
    return id
  }, [hookAddress])

  // Check if pool exists by checking token0
  const { data: poolToken0, isError: token0Error } = useContractRead({
    address: hookAddress,
    abi,
    functionName: 'token0',
    watch: true,
  })

  useEffect(() => {
    console.log('Pool state:', {
      poolId,
      poolToken0,
      token0Error,
      hookAddress,
      TOKEN0_ADDRESS,
      TOKEN1_ADDRESS
    })
  }, [poolId, poolToken0, token0Error, hookAddress])

  if (!poolId) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-lg p-6 rounded-xl border border-gray-700 shadow-xl">
        <h2 className="text-2xl font-semibold mb-6 text-blue-400">Pool Information</h2>
        <p className="text-gray-400">Loading pool ID...</p>
      </div>
    )
  }

  // Check if pool exists by checking if token0 matches our expected token
  const isPoolInitialized = poolToken0 && poolToken0.toLowerCase() === TOKEN0_ADDRESS.toLowerCase()

  // If pool doesn't exist, show pool creation instructions
  if (!isPoolInitialized) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-lg p-6 rounded-xl border border-gray-700 shadow-xl">
        <h2 className="text-2xl font-semibold mb-6 text-blue-400">Pool Information</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-1">Pool ID</h3>
            <p className="text-xs bg-gray-700/50 p-2 rounded break-all font-mono text-emerald-400">
              {poolId}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              This is the deterministic ID for the pool based on the token addresses.
            </p>
          </div>
          <div className="mt-6 p-4 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
            <p className="text-sm text-gray-200">
              This pool hasn't been created yet. To create it, go to the Pool Creation tab and:
            </p>
            <ol className="list-decimal list-inside mt-2 space-y-1 text-sm text-gray-300">
              <li>Set an initial price for cBTC/USDC</li>
              <li>Choose a price range percentage</li>
              <li>Click "Create Pool" and confirm the transaction</li>
            </ol>
          </div>
        </div>
      </div>
    )
  }

  // Show pool information if pool exists
  return (
    <div className="bg-gray-800/50 backdrop-blur-lg p-6 rounded-xl border border-gray-700 shadow-xl">
      <h2 className="text-2xl font-semibold mb-6 text-blue-400">Pool Information</h2>
      
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-1">Pool ID</h3>
          <p className="text-xs bg-gray-700/50 p-2 rounded break-all font-mono text-emerald-400">
            {poolId}
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-medium text-gray-300">Pool Status</h3>
          <div className="bg-emerald-900/30 border border-emerald-500/50 p-4 rounded">
            <p className="text-gray-200">
              Pool is active and ready for liquidity provision!
            </p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-900/30 border border-blue-500/50 rounded-lg">
          <p className="text-sm text-gray-300">
            <span className="text-blue-400">Next Step:</span> Head to the Liquidity Provision tab to add liquidity and start earning rewards!
          </p>
        </div>
      </div>
    </div>
  )
}
