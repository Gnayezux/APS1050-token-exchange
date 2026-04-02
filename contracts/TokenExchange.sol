// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract TokenExchange is EIP712 {
    using ECDSA for bytes32;

    struct MapStruct {
        uint buyerNonce;
        address seller;
        uint soldLeft;
    }

    struct FillOrderStruct {
        address seller;
        uint amountSold;
        uint amountWant;
        uint expiry;
        uint nonce;
        bytes sig;
        uint amountToBuy;
        uint buyerNonce;
    }

    mapping (bytes32 => MapStruct) public hashToData;

    bytes32 internal constant TYPE_HASH = keccak256(
        "Order(address tokenSold,address tokenWant,uint amountSold,uint amountWant,uint expiry,uint nonce)"
    );

    event PostedOrder(address _seller, IERC20 indexed _tokenSold, IERC20 indexed _tokenWant, uint _amountSold, uint _amountWant, uint _expiry, uint _nonce, bytes _sig, bytes32 indexed _hash);
    event BoughtOrder(address _buyer, IERC20 indexed _tokenSold, IERC20 indexed _tokenWant, uint _amountSold);

    constructor() EIP712('APS1050 Token Exchange', '1') {}

    function _getHash(
        IERC20 tokenSold,
        IERC20 tokenWant,
        uint amountSold,
        uint amountWant,
        uint expiry,
        uint nonce
    ) internal view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(abi.encode(TYPE_HASH, tokenSold, tokenWant, amountSold, amountWant, expiry, nonce))
        );
    }

    // Lets a seller publish an order.
    function createOrder(
        IERC20 tokenSold,
        IERC20 tokenWant,
        uint amountSold,
        uint amountWant,
        uint expiry,
        uint nonce,
        bytes calldata sig
    ) external {
        bytes32 orderHash = _getHash(tokenSold, tokenWant, amountSold, amountWant, expiry, nonce);
        require(ECDSA.recover(orderHash, sig) == msg.sender, "Cannot verify signature!");
        require(hashToData[orderHash].seller == address(0), "Order has already been posted!");

        hashToData[orderHash].seller = msg.sender;
        hashToData[orderHash].soldLeft = amountSold;
        emit PostedOrder(msg.sender, tokenSold, tokenWant, amountSold, amountWant, expiry, nonce, sig, orderHash);
    }

    // Buyer is making an order to buy order.amountToBuy coins of tokenSold,
    // paying a proportional amount in tokenWant.
    function fillOrder(
        IERC20 tokenSold,
        IERC20 tokenWant,
        FillOrderStruct calldata order
    ) external {
        bytes32 orderHash = _getHash(tokenSold, tokenWant, order.amountSold, order.amountWant, order.expiry, order.nonce);
        require(ECDSA.recover(orderHash, order.sig) == order.seller, "Cannot verify signature!");
        require(block.timestamp < order.expiry, "Order has already expired!");

        if (hashToData[orderHash].seller == address(0)) {
            hashToData[orderHash].seller = order.seller;
            hashToData[orderHash].soldLeft = order.amountSold;
        }

        hashToData[orderHash].buyerNonce++;
        require(hashToData[orderHash].buyerNonce == order.buyerNonce, "Incorrect nonce supplied! Check hashToData to know previous nonce, and increment it.");

        hashToData[orderHash].soldLeft -= order.amountToBuy;

        uint amountToSeller = (order.amountWant * order.amountToBuy) / order.amountSold;

        require(tokenSold.transferFrom(order.seller, msg.sender, order.amountToBuy), "Transfer from seller to you failed!");
        require(tokenWant.transferFrom(msg.sender, order.seller, amountToSeller), "Transfer from you to seller failed!");
        emit BoughtOrder(msg.sender, tokenSold, tokenWant, order.amountToBuy);
    }
}
