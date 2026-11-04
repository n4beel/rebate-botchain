// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "forge-std/Test.sol";
import {Rebate} from "../src/Rebate.sol";

contract RebateHandler is Test {
  Rebate public rebate;
  address public seller = address(0x1111);
  address[] public buyers;
  uint256 public activeId;
  uint128 public currentPrice = 1 ether;
  uint64 public constant WINDOW = 7 days;
  uint256[] public purchaseIds;

  constructor(Rebate _rebate) {
    rebate = _rebate;
    vm.deal(seller, 1000 ether);

    for (uint160 i = 1; i <= 10; i++) {
      address b = address(uint160(0x3000 + i));
      vm.deal(b, 1000 ether);
      buyers.push(b);
    }

    vm.prank(seller);
    activeId = rebate.list("Handler Item", currentPrice, WINDOW, 500);
  }

  function buyItem(uint256 buyerIdx) external {
    address b = buyers[buyerIdx % buyers.length];
    vm.prank(b);
    try rebate.buy{value: currentPrice}(activeId) returns (uint256 pid) {
      purchaseIds.push(pid);
    } catch {}
  }

  function changePrice(uint8 dropSeed) external {
    if (rebate.changesOf(activeId).length < 24) {
      uint128 drop = uint128(bound(dropSeed, 1, 50)) * 0.01 ether;
      if (currentPrice > drop + 0.001 ether) {
        currentPrice -= drop;
      } else {
        currentPrice += 0.05 ether;
      }
      vm.prank(seller);
      try rebate.setPrice(activeId, currentPrice) {} catch {}
    }
  }

  function settle(uint256 pIdx) external {
    if (purchaseIds.length > 0) {
      uint256 pid = purchaseIds[pIdx % purchaseIds.length];
      try rebate.settle(pid) {} catch {}
    }
  }

  function withdraw(uint256 actorIdx) external {
    address actor;
    if (actorIdx % (buyers.length + 1) == 0) {
      actor = seller;
    } else {
      actor = buyers[(actorIdx - 1) % buyers.length];
    }
    if (rebate.pending(actor) > 0) {
      vm.prank(actor);
      try rebate.withdraw() {} catch {}
    }
  }

  function warp(uint32 secs) external {
    vm.warp(block.timestamp + bound(secs, 1, 14 days));
  }

  function getBuyers() external view returns (address[] memory) {
    return buyers;
  }

  function getPurchaseIds() external view returns (uint256[] memory) {
    return purchaseIds;
  }
}

contract RebateInvariantTest is Test {
  Rebate public rebate;
  RebateHandler public handler;

  function setUp() public {
    rebate = new Rebate();
    handler = new RebateHandler(rebate);
    targetContract(address(handler));
  }

  function invariant_BalanceEqualsHeldPlusPending() public view {
    address seller = handler.seller();
    address[] memory buyers = handler.getBuyers();
    uint256[] memory pids = handler.getPurchaseIds();

    uint256 sumPending = rebate.pending(seller);
    for (uint256 i = 0; i < buyers.length; i++) {
      sumPending += rebate.pending(buyers[i]);
    }

    uint256 sumHeld = 0;
    for (uint256 i = 0; i < pids.length; i++) {
      Rebate.Purchase memory p = rebate.purchaseOf(pids[i]);
      if (!p.settled) {
        sumHeld += p.paid;
      }
    }

    assertEq(address(rebate).balance, sumHeld + sumPending);
  }
}
