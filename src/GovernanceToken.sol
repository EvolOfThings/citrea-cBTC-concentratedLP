// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract GovernanceToken is ERC20 {
    constructor() ERC20("Governance Token", "GOV") {}

    function mintToHook(address hookContract) external {
        require(totalSupply() == 0, "Already minted");
        // Mint tokens to deployer for testing and distribution
        _mint(msg.sender, 100_000 * 10**decimals());
        // Mint tokens to hook contract for rewards
        _mint(hookContract, 900_000 * 10**decimals());
    }
}
