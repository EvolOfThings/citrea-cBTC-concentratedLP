// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CBTC is ERC20 {
    constructor() ERC20("Citrea Bitcoin", "cBTC") {
        // Mint 5000 cBTC to deployer
        _mint(msg.sender, 5000 * 10**decimals());
    }
}
