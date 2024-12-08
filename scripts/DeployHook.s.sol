// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {ConcentratedIncentivesHook} from "../src/ConcentratedIncentivesHook.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Currency} from "v4-core/src/types/Currency.sol";

contract DeployHook is Script {
    function run() public {
        // Load the private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);

        // Deploy the hook with the specific salt
        ConcentratedIncentivesHook hook = new ConcentratedIncentivesHook{
            salt: 0x0000000000000000000000000000000000000000000000000000000000004180
        }(
            IPoolManager(0x8C4BcBE6b9eF47855f97E675296FA3F6fafa5F1A),
            IERC20(0x71D2521BeC8EBB3DB2983337d7fAa056886A8D08),
            Currency.wrap(0x28665DC05b3E3603F81A86aac434fe4953877be1),
            Currency.wrap(0x7B6db83ad69E6afe0bfF063eeA561C511a05eFfb)
        );

        console.log("Hook deployed at:", address(hook));

        vm.stopBroadcast();
    }
}
