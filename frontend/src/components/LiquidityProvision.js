'use client'

import { useState, useEffect } from 'react'
import { useContractWrite, useContractRead, useWaitForTransaction, useNetwork, useAccount } from 'wagmi'
import { parseUnits, encodeFunctionData } from 'viem'
import { abi } from '../abi/ConcentratedIncentivesHook.json'
import { poolManagerABI } from '../abi/PoolManager.json'
import { vaultABI } from '../abi/Vault.json'
import { erc20ABI } from 'wagmi'
import { getContractAddress } from '../config/contracts'
import PoolInfo from './PoolInfo'
import { calculatePoolId } from '../utils/poolUtils'

// Contract addresses
const TOKEN0_ADDRESS = '0x28665DC05b3E3603F81A86aac434fe4953877be1'
const TOKEN1_ADDRESS = '0x7B6db83ad69E6afe0bfF063eeA561C511a05eFfb'
const POOL_MANAGER_ADDRESS = '0x64255ed21366DB43d89736EE48928b890A84E2Cb'
const VAULT_ADDRESS = POOL_MANAGER_ADDRESS // Vault is part of Pool Manager in V4

export default function LiquidityProvision() {
  const { chain } = useNetwork()
  const { address } = useAccount()
  const hookAddress = getContractAddress(chain?.id || 11155111, 'ConcentratedIncentivesHook')

  const [poolId, setPoolId] = useState('')
  const [amount0, setAmount0] = useState('') // USDC amount
  const [amount1, setAmount1] = useState('') // cBTC amount
  const [error, setError] = useState('')
  const [approvalStatus, setApprovalStatus] = useState({ token0: false, token1: false })

  // Get user's current position
  const { data: userPosition, refetch: refetchPosition } = useContractRead({
    address: hookAddress,
    abi,
    functionName: 'positions',
    args: poolId ? [poolId, address] : undefined,
    watch: true,
  })

  useEffect(() => {
    const savedPoolId = localStorage.getItem('lastPoolId')
    if (savedPoolId) {
      setPoolId(savedPoolId)
    } else {
      // Calculate pool ID from token addresses
      const calculatedPoolId = calculatePoolId(
        TOKEN0_ADDRESS,
        TOKEN1_ADDRESS,
        hookAddress
      )
      setPoolId(calculatedPoolId)
      // Save for future use
      localStorage.setItem('lastPoolId', calculatedPoolId)
    }
  }, [hookAddress])

  const { data: token0 } = useContractRead({
    address: hookAddress,
    abi,
    functionName: 'token0'
  })

  const { data: token1 } = useContractRead({
    address: hookAddress,
    abi,
    functionName: 'token1'
  })

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

  // Check allowances for Vault
  const { data: allowance0 } = useContractRead({
    address: TOKEN0_ADDRESS,
    abi: erc20ABI,
    functionName: 'allowance',
    args: [address, POOL_MANAGER_ADDRESS],
    watch: true
  })

  const { data: allowance1 } = useContractRead({
    address: TOKEN1_ADDRESS,
    abi: erc20ABI,
    functionName: 'allowance',
    args: [address, POOL_MANAGER_ADDRESS],
    watch: true
  })

  // Approve USDC for Vault
  const { write: approveToken0, isLoading: isApproving0 } = useContractWrite({
    address: TOKEN0_ADDRESS,
    abi: erc20ABI,
    functionName: 'approve',
    onSuccess: () => {
      setApprovalStatus(prev => ({ ...prev, token0: true }))
    }
  })

  // Approve cBTC for Vault
  const { write: approveToken1, isLoading: isApproving1 } = useContractWrite({
    address: TOKEN1_ADDRESS,
    abi: erc20ABI,
    functionName: 'approve',
    onSuccess: () => {
      setApprovalStatus(prev => ({ ...prev, token1: true }))
    }
  })

  // Add vault take function
  const { data: takeData, write: takeTokens, isLoading: isTaking } = useContractWrite({
    address: POOL_MANAGER_ADDRESS, // Pool Manager is also the Vault
    abi: vaultABI,
    functionName: 'take',
    onSuccess: async () => {
      // After tokens are taken, proceed with modifyPosition
      await addLiquidity()
    },
    onError: (err) => {
      console.error('Error taking tokens:', err)
      setError(err.message)
    }
  })

  // Use Pool Manager contract for adding liquidity
  const { data: writeData, write: addLiquidityWrite, isLoading: isWriteLoading } = useContractWrite({
    address: POOL_MANAGER_ADDRESS,
    abi: poolManagerABI,
    functionName: 'lockAcquired',
    onError: (err) => {
      console.error('Error adding liquidity:', err)
      setError(err.message)
    }
  })

  const { isLoading: isConfirming, isSuccess } = useWaitForTransaction({
    hash: writeData?.hash,
    onSuccess: () => {
      // Clear form and refresh position
      setAmount0('')
      setAmount1('')
      setApprovalStatus({ token0: false, token1: false })
      refetchPosition()
    }
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!poolId || !amount0 || !amount1 || !address) return
    setError('')

    try {
      // Convert amounts to Wei for approvals
      const amount0Wei = parseUnits(amount0, 6) // USDC has 6 decimals
      const amount1Wei = parseUnits(amount1, 18) // cBTC has 18 decimals

      // Check if allowances are sufficient and approve if needed
      const needsToken0Approval = !allowance0 || allowance0 < amount0Wei
      const needsToken1Approval = !allowance1 || allowance1 < amount1Wei

      if (needsToken0Approval) {
        console.log('Approving USDC...')
        await approveToken0({
          args: [POOL_MANAGER_ADDRESS, amount0Wei]
        })
        return
      }

      if (needsToken1Approval) {
        console.log('Approving cBTC...')
        await approveToken1({
          args: [POOL_MANAGER_ADDRESS, amount1Wei]
        })
        return
      }

      // First take tokens to the vault
      const inputs = [
        {
          token: TOKEN0_ADDRESS,
          amount: amount0Wei
        },
        {
          token: TOKEN1_ADDRESS,
          amount: amount1Wei
        }
      ]

      console.log('Taking tokens to vault:', {
        from: address,
        to: POOL_MANAGER_ADDRESS,
        inputs
      })

      await takeTokens({
        args: [
          address, // from
          POOL_MANAGER_ADDRESS, // to
          inputs // token inputs
        ]
      })

    } catch (error) {
      console.error('Error in liquidity provision:', error)
      setError(error.message)
    }
  }

  // This function will be called after tokens are taken
  const addLiquidity = async () => {
    try {
      const amount0Wei = parseUnits(amount0, 6)
      const amount1Wei = parseUnits(amount1, 18)
      const liquidityDelta = amount1Wei > 0n ? amount1Wei : -amount1Wei

      // Encode the modifyPosition call
      const modifyPositionData = encodeFunctionData({
        abi: poolManagerABI,
        functionName: 'modifyPosition',
        args: [
          [
            TOKEN0_ADDRESS,
            TOKEN1_ADDRESS,
            3000n,
            60n,
            hookAddress
          ],
          [
            -887272n,
            887272n,
            liquidityDelta
          ],
          '0x'
        ]
      })

      console.log('Adding liquidity with encoded data:', {
        key: [TOKEN0_ADDRESS, TOKEN1_ADDRESS, 3000n, 60n, hookAddress],
        params: [-887272n, 887272n, liquidityDelta],
        modifyPositionData,
        amount0Wei: amount0Wei.toString(),
        amount1Wei: amount1Wei.toString(),
        liquidityDelta: liquidityDelta.toString()
      })

      // Call lockAcquired with the encoded modifyPosition data
      await addLiquidityWrite({
        args: [modifyPositionData],
        value: 0n
      })
    } catch (error) {
      console.error('Error adding liquidity:', error)
      setError(error.message)
    }
  }

  return (
    <div className="space-y-6">
      <PoolInfo />
      
      {/* User's Current Position */}
      {userPosition?.isActive && (
        <div className="bg-gray-800/50 backdrop-blur-lg p-6 rounded-xl border border-gray-700 shadow-xl">
          <h2 className="text-2xl font-semibold mb-6 text-blue-400">Your Position</h2>
          <div className="space-y-4">
            <div className="bg-gray-700/50 p-4 rounded space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Price Range:</span>
                <span className="text-emerald-400">
                  {userPosition.tickLower} - {userPosition.tickUpper}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Last Claim Time:</span>
                <span className="text-emerald-400">
                  {new Date(Number(userPosition.lastClaimTime) * 1000).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Liquidity Form */}
      <div className="bg-gray-800/50 backdrop-blur-lg p-6 rounded-xl border border-gray-700 shadow-xl">
        <h2 className="text-2xl font-semibold mb-6 text-blue-400">Add Liquidity to Pool</h2>
        
        {/* Transaction Status */}
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
                Liquidity added successfully!
              </p>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-500/50 rounded-lg">
            <p className="text-gray-200">{error}</p>
          </div>
        )}

        {/* Approval Status */}
        <div className="mb-4 space-y-2">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${approvalStatus.token0 ? 'bg-emerald-500' : ''}`} />
            <span className="text-sm text-gray-300">
              {isApproving0 ? 'Approving USDC...' : approvalStatus.token0 ? 'USDC Approved' : ''}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${approvalStatus.token1 ? 'bg-emerald-500' : ''}`} />
            <span className="text-sm text-gray-300">
              {isApproving1 ? 'Approving cBTC...' : approvalStatus.token1 ? 'cBTC Approved' : ''}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Pool ID
            </label>
            <input
              type="text"
              value={poolId}
              onChange={(e) => setPoolId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
              placeholder="Enter Pool ID"
              readOnly
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              {token0Symbol || 'USDC'} Amount
            </label>
            <input
              type="number"
              step="0.000001"
              value={amount0}
              onChange={(e) => setAmount0(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
              placeholder={`Enter ${token0Symbol || 'USDC'} amount`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              {token1Symbol || 'cBTC'} Amount
            </label>
            <input
              type="number"
              step="0.00000001"
              value={amount1}
              onChange={(e) => setAmount1(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
              placeholder={`Enter ${token1Symbol || 'cBTC'} amount`}
            />
          </div>
          <button
            type="submit"
            disabled={isWriteLoading || isConfirming || !poolId || isApproving0 || isApproving1 || isTaking}
            className={`w-full py-2 px-4 rounded-lg font-medium ${
              isWriteLoading || isConfirming || !poolId || isApproving0 || isApproving1 || isTaking
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {isApproving0 || isApproving1 ? 'Approving Tokens...' :
             isWriteLoading || isConfirming || isTaking ? 'Adding Liquidity...' : 'Add Liquidity'}
          </button>
        </form>
      </div>
    </div>
  )
}
