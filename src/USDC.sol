// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract USDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {
        // USDC has 6 decimals unlike the standard 18
        _mint(msg.sender, 100000 * 10**6);
    }

    function decimals() public pure override returns (uint8) {
        return 6; // USDC uses 6 decimal places
    }
}
