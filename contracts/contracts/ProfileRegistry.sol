// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract ProfileRegistry {
    event ProfileCreated(address indexed user, string handle);
    mapping(address => string) public handleOf;

    function createProfile(string calldata handle) external {
        require(bytes(handleOf[msg.sender]).length == 0, "Already exists");
        handleOf[msg.sender] = handle;
        emit ProfileCreated(msg.sender, handle);
    }

    function hasProfile(address user) external view returns (bool) {
        return bytes(handleOf[user]).length > 0;
    }
}
