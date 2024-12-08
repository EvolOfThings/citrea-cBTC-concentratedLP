export const CONTRACTS = {
  // Sepolia Testnet
  11155111: {
    ConcentratedIncentivesHook: '0x3ac1a57BaDD381c9ddEb9f289191ce8bF8Ba14B0',
    cBTC: '0x28665DC05b3E3603F81A86aac434fe4953877be1', // token0
    USDC: '0x7B6db83ad69E6afe0bfF063eeA561C511a05eFfb', // token1
  },
  // Add more networks as needed
  // Mainnet
  1: {
    ConcentratedIncentivesHook: '',
    cBTC: '',
    USDC: '',
  }
}

// Helper function to get contract address based on current chain ID
export const getContractAddress = (chainId, contractName) => {
  if (!CONTRACTS[chainId]) {
    throw new Error(`Chain ID ${chainId} not supported`)
  }
  const address = CONTRACTS[chainId][contractName]
  if (!address) {
    throw new Error(`Contract ${contractName} not found for chain ID ${chainId}`)
  }
  return address
}
