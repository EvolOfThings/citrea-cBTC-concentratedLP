// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ConcentratedIncentivesHook} from "./ConcentratedIncentivesHook.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";

contract HookFactory {
    error DeploymentFailed();

    function deploy(
        IPoolManager poolManager,
        IERC20 governanceToken,
        Currency token0,
        Currency token1,
        bytes32 salt
    ) public returns (ConcentratedIncentivesHook hook) {
        bytes memory creationCode = type(ConcentratedIncentivesHook).creationCode;
        bytes memory constructorArgs = abi.encode(
            poolManager,
            governanceToken,
            token0,
            token1
        );
        bytes memory bytecode = abi.encodePacked(creationCode, constructorArgs);
        address hookAddress;

        assembly {
            hookAddress := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }

        if (hookAddress == address(0)) revert DeploymentFailed();
        hook = ConcentratedIncentivesHook(hookAddress);
    }

    function calculateHookAddress(
        IPoolManager poolManager,
        IERC20 governanceToken,
        Currency token0,
        Currency token1,
        bytes32 salt
    ) public view returns (address) {
        bytes memory creationCode = type(ConcentratedIncentivesHook).creationCode;
        bytes memory constructorArgs = abi.encode(
            poolManager,
            governanceToken,
            token0,
            token1
        );
        bytes memory bytecode = abi.encodePacked(creationCode, constructorArgs);
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(bytecode))
        );
        return address(uint160(uint256(hash)));
    }

    function hasCorrectHookBits(address hookAddress) public pure returns (bool) {
        uint160 flags = uint160(hookAddress);
        // These are the flags we need for beforeAddLiquidity and afterAddLiquidity
        uint256 requiredFlags = uint256(Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.AFTER_ADD_LIQUIDITY_FLAG);
        return (flags & requiredFlags) == requiredFlags;
    }

    function findSaltWithCorrectBits(
        IPoolManager poolManager,
        IERC20 governanceToken,
        Currency token0,
        Currency token1,
        uint256 startSalt,
        uint256 numAttempts
    ) public view returns (bytes32 salt, address predictedAddress) {
        bytes memory creationCode = type(ConcentratedIncentivesHook).creationCode;
        bytes memory constructorArgs = abi.encode(
            poolManager,
            governanceToken,
            token0,
            token1
        );
        bytes memory bytecode = abi.encodePacked(creationCode, constructorArgs);
        bytes32 initCodeHash = keccak256(bytecode);

        for(uint256 i = startSalt; i < startSalt + numAttempts; i++) {
            bytes32 currentSalt = bytes32(i);
            address addr = address(uint160(uint256(keccak256(abi.encodePacked(
                bytes1(0xff),
                address(this),
                currentSalt,
                initCodeHash
            )))));

            if(hasCorrectHookBits(addr)) {
                return (currentSalt, addr);
            }
        }
        revert("No valid salt found");
    }
}
