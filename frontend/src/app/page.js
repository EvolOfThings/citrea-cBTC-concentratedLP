'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import PoolCreation from '../components/PoolCreation'
import LiquidityProvision from '../components/LiquidityProvision'

export default function Home() {
  const { isConnected } = useAccount()

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <nav className="flex justify-between items-center mb-12">
          <div className="flex items-center space-x-4">
            <img src="/logo.png" alt="cBTC" className="h-10 w-10" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              cBTC Liquidity Booster
            </h1>
          </div>
          <ConnectButton />
        </nav>
        
        {!isConnected ? (
          <div className="text-center py-20">
            <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Welcome to cBTC Liquidity Booster
            </h2>
            <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              Connect your wallet to start providing liquidity and earn rewards with cBTC pools
            </p>
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <PoolCreation />
            <LiquidityProvision />

            {/* Position Management Section */}
            <div className="bg-gray-800/50 backdrop-blur-lg p-6 rounded-xl border border-gray-700 shadow-xl">
              <h2 className="text-2xl font-semibold mb-4 text-green-400">Your Positions</h2>
              <p className="text-gray-400 mb-4">Manage your liquidity positions</p>
              {/* Position management interface will go here */}
            </div>

            {/* Rewards Section */}
            <div className="bg-gray-800/50 backdrop-blur-lg p-6 rounded-xl border border-gray-700 shadow-xl">
              <h2 className="text-2xl font-semibold mb-4 text-yellow-400">Rewards</h2>
              <p className="text-gray-400 mb-4">View and claim your earned rewards</p>
              {/* Rewards interface will go here */}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
