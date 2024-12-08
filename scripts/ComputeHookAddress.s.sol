// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {HookMiner} from "../test/utils/HookMiner.sol";
import {ConcentratedIncentivesHook} from "../src/ConcentratedIncentivesHook.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Currency} from "v4-core/src/types/Currency.sol";

contract ComputeHookAddress is Script {
    function run() public {
        // Required hook flags: beforeAddLiquidity and afterAddLiquidity
        uint160 flags = uint160(1 << 4 | 1 << 5);

        // The CREATE2 deployer address
        address deployer = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

        // Constructor arguments
        bytes memory creationCode = type(ConcentratedIncentivesHook).creationCode;
        bytes memory constructorArgs = abi.encode(
            IPoolManager(0x8C4BcBE6b9eF47855f97E675296FA3F6fafa5F1A),
            IERC20(0x71D2521BeC8EBB3DB2983337d7fAa056886A8D08),
            Currency.wrap(0x28665DC05b3E3603F81A86aac434fe4953877be1),
            Currency.wrap(0x7B6db83ad69E6afe0bfF063eeA561C511a05eFfb)
        );

        // Mine the salt that will produce a hook address with the required flags
        (address hookAddress, bytes32 salt) = HookMiner.find(deployer, flags, creationCode, constructorArgs);
        
        console.log("Hook address:", hookAddress);
        console.log("Salt:", vm.toString(salt));
    }
}
