// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Mytoken2 is ERC20 {
    constructor() ERC20("APS1050Token2", "TEST2") {
    }

    
    function _mint(uint amount) external {
        _mint(msg.sender, amount);
    }
}