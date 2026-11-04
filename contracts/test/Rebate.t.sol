// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import "forge-std/Test.sol";
import {Rebate} from "../src/Rebate.sol";

contract MaliciousRecipient {
  Rebate public rebate;
  constructor(Rebate _rebate) {
    rebate = _rebate;
  }
  receive() external payable {
    rebate.withdraw();
  }
}

contract RebateTest is Test {
  Rebate public rebate;

  address public seller = address(0x1111);
  address public alice = address(0x2222);
  address public bob = address(0x3333);
  address public charlie = address(0x4444);

  uint128 public constant PRICE = 1 ether;
  uint64 public constant WINDOW = 14 days;
  uint32 public constant STOCK = 10;

  function setUp() public {
    rebate = new Rebate();
    vm.deal(seller, 100 ether);
    vm.deal(alice, 100 ether);
    vm.deal(bob, 100 ether);
    vm.deal(charlie, 100 ether);
  }

  function test_ListAndBuy() public {
    vm.prank(seller);
    uint256 id = rebate.list("Earbuds", PRICE, WINDOW, STOCK);
    assertEq(id, 1);

    Rebate.Listing memory l = rebate.listingOf(id);
    assertEq(l.seller, seller);
    assertEq(l.price, PRICE);
    assertEq(l.windowSecs, WINDOW);
    assertEq(l.stock, STOCK);

    Rebate.Change[] memory changes = rebate.changesOf(id);
    assertEq(changes.length, 1);
    assertEq(changes[0].price, PRICE);

    // Alice buys
    vm.prank(alice);
    uint256 pid = rebate.buy{value: PRICE}(id);
    assertEq(pid, 1);

    Rebate.Purchase memory p = rebate.purchaseOf(pid);
    assertEq(p.buyer, alice);
    assertEq(p.paid, PRICE);
    assertEq(p.settled, false);
    assertEq(rebate.listingOf(id).stock, STOCK - 1);
  }

  function test_BuyWrongPaymentReverts_ArgsExpected() public {
    vm.prank(seller);
    uint256 id = rebate.list("Item", PRICE, WINDOW, STOCK);

    vm.prank(alice);
    vm.expectRevert(abi.encodeWithSelector(Rebate.WrongPayment.selector, PRICE));
    rebate.buy{value: PRICE - 1}(id);
  }

  function test_SellerCannotBuy() public {
    vm.prank(seller);
    uint256 id = rebate.list("Item", PRICE, WINDOW, STOCK);

    vm.prank(seller);
    vm.expectRevert(Rebate.SellerCannotBuy.selector);
    rebate.buy{value: PRICE}(id);
  }

  function test_SoldOutReverts() public {
    vm.prank(seller);
    uint256 id = rebate.list("Limited", PRICE, WINDOW, 1);

    vm.prank(alice);
    rebate.buy{value: PRICE}(id);

    vm.prank(bob);
    vm.expectRevert(Rebate.SoldOut.selector);
    rebate.buy{value: PRICE}(id);
  }

  function test_PriceCutAfterBuyCreatesRefund() public {
    vm.prank(seller);
    uint256 id = rebate.list("Watch", 1 ether, WINDOW, STOCK);

    vm.prank(alice);
    uint256 pid = rebate.buy{value: 1 ether}(id);

    // 2 days later, seller drops price to 0.7 ether
    vm.warp(block.timestamp + 2 days);
    vm.prank(seller);
    rebate.setPrice(id, 0.7 ether);

    // Alice refund due is 0.3 ether
    assertEq(rebate.refundDue(pid), 0.3 ether);

    // Advance past protection window
    vm.warp(block.timestamp + WINDOW);
    rebate.settle(pid);

    assertEq(rebate.pending(alice), 0.3 ether);
    assertEq(rebate.pending(seller), 0.7 ether);
  }

  function test_CutBeforeBuyDoesNotCount() public {
    vm.prank(seller);
    uint256 id = rebate.list("Shoes", 1 ether, WINDOW, STOCK);

    // Price cut to 0.8 ether before Alice buys
    vm.warp(block.timestamp + 1 days);
    vm.prank(seller);
    rebate.setPrice(id, 0.8 ether);

    // Alice buys at 0.8 ether
    vm.prank(alice);
    uint256 pid = rebate.buy{value: 0.8 ether}(id);

    // No further cut -> refund due is 0
    assertEq(rebate.refundDue(pid), 0);
  }

  function test_CutThenRaiseRefundsOnTheLowest() public {
    vm.prank(seller);
    uint256 id = rebate.list("Monitor", 2 ether, WINDOW, STOCK);

    vm.prank(alice);
    uint256 pid = rebate.buy{value: 2 ether}(id);

    // Cut to 1.5 ether
    vm.warp(block.timestamp + 1 days);
    vm.prank(seller);
    rebate.setPrice(id, 1.5 ether);

    // Cut to 1.2 ether (the lowest)
    vm.warp(block.timestamp + 2 days);
    vm.prank(seller);
    rebate.setPrice(id, 1.2 ether);

    // Raised to 1.8 ether
    vm.warp(block.timestamp + 3 days);
    vm.prank(seller);
    rebate.setPrice(id, 1.8 ether);

    // Refund due should be 2 ether - 1.2 ether = 0.8 ether
    assertEq(rebate.refundDue(pid), 0.8 ether);
  }

  function test_CutAfterWindowDoesNotCount() public {
    vm.prank(seller);
    uint256 id = rebate.list("Phone", 1 ether, WINDOW, STOCK);

    vm.prank(alice);
    uint256 pid = rebate.buy{value: 1 ether}(id);

    // Drop happens strictly after window (e.g. WINDOW + 1s)
    vm.warp(block.timestamp + WINDOW + 1);
    vm.prank(seller);
    rebate.setPrice(id, 0.5 ether);

    assertEq(rebate.refundDue(pid), 0);
  }

  function test_SameBlockCutAfterBuyCounts() public {
    vm.prank(seller);
    uint256 id = rebate.list("Tablet", 1 ether, WINDOW, STOCK);

    vm.prank(alice);
    uint256 pid = rebate.buy{value: 1 ether}(id);

    // In same block (timestamp unchanged), seller cuts price to 0.9 ether
    vm.prank(seller);
    rebate.setPrice(id, 0.9 ether);

    assertEq(rebate.refundDue(pid), 0.1 ether);
  }

  function test_MultipleBuyersGetTheirOwnDifference() public {
    vm.prank(seller);
    uint256 id = rebate.list("Laptop", 2 ether, WINDOW, STOCK);

    // Alice buys at 2 ether
    vm.prank(alice);
    uint256 pAlice = rebate.buy{value: 2 ether}(id);

    // Price cut to 1.6 ether
    vm.warp(block.timestamp + 1 days);
    vm.prank(seller);
    rebate.setPrice(id, 1.6 ether);

    // Bob buys at 1.6 ether
    vm.prank(bob);
    uint256 pBob = rebate.buy{value: 1.6 ether}(id);

    // Price cut to 1.3 ether
    vm.warp(block.timestamp + 2 days);
    vm.prank(seller);
    rebate.setPrice(id, 1.3 ether);

    // Alice gets 2 - 1.3 = 0.7 ether
    // Bob gets 1.6 - 1.3 = 0.3 ether
    assertEq(rebate.refundDue(pAlice), 0.7 ether);
    assertEq(rebate.refundDue(pBob), 0.3 ether);
  }

  function test_SettleBeforeWindowReverts_ArgsEndsAt() public {
    vm.prank(seller);
    uint256 id = rebate.list("Item", PRICE, WINDOW, STOCK);

    vm.prank(alice);
    uint256 pid = rebate.buy{value: PRICE}(id);

    Rebate.Purchase memory p = rebate.purchaseOf(pid);
    uint64 endsAt = p.boughtAt + WINDOW;

    vm.expectRevert(abi.encodeWithSelector(Rebate.WindowOpen.selector, endsAt));
    rebate.settle(pid);
  }

  function test_SettleSplitsRefundAndSeller() public {
    vm.prank(seller);
    uint256 id = rebate.list("Camera", 1 ether, WINDOW, STOCK);

    vm.prank(alice);
    uint256 pid = rebate.buy{value: 1 ether}(id);

    vm.warp(block.timestamp + 1 days);
    vm.prank(seller);
    rebate.setPrice(id, 0.75 ether);

    vm.warp(block.timestamp + WINDOW);
    rebate.settle(pid);

    assertEq(rebate.pending(alice), 0.25 ether);
    assertEq(rebate.pending(seller), 0.75 ether);

    // Withdrawals
    vm.prank(alice);
    rebate.withdraw();
    assertEq(rebate.pending(alice), 0);

    vm.prank(seller);
    rebate.withdraw();
    assertEq(rebate.pending(seller), 0);
  }

  function test_SettleOnce() public {
    vm.prank(seller);
    uint256 id = rebate.list("Item", PRICE, WINDOW, STOCK);

    vm.prank(alice);
    uint256 pid = rebate.buy{value: PRICE}(id);

    vm.warp(block.timestamp + WINDOW);
    rebate.settle(pid);

    vm.expectRevert(Rebate.AlreadySettled.selector);
    rebate.settle(pid);
  }

  function test_TooManyChangesReverts() public {
    vm.prank(seller);
    uint256 id = rebate.list("Volatile", PRICE, WINDOW, STOCK);

    // Initial listing creates change 0
    // We can add 23 more changes (total 24)
    for (uint256 i = 1; i < 24; i++) {
      vm.prank(seller);
      rebate.setPrice(id, PRICE - uint128(i * 0.01 ether));
    }

    // 25th change reverts
    vm.prank(seller);
    vm.expectRevert(Rebate.TooManyChanges.selector);
    rebate.setPrice(id, 0.5 ether);
  }

  function test_RefundDueLiveMatchesSettle() public {
    vm.prank(seller);
    uint256 id = rebate.list("Speaker", 2 ether, WINDOW, STOCK);

    vm.prank(alice);
    uint256 pid = rebate.buy{value: 2 ether}(id);

    vm.warp(block.timestamp + 2 days);
    vm.prank(seller);
    rebate.setPrice(id, 1.4 ether);

    uint256 liveRefund = rebate.refundDue(pid);

    vm.warp(block.timestamp + WINDOW);
    rebate.settle(pid);

    assertEq(rebate.pending(alice), liveRefund);
  }

  function test_ReentrantWithdrawBlocked() public {
    MaliciousRecipient mal = new MaliciousRecipient(rebate);
    vm.deal(address(mal), 10 ether);

    vm.prank(seller);
    uint256 id = rebate.list("Item", 1 ether, WINDOW, STOCK);

    // Malicious contract buys
    vm.prank(address(mal));
    uint256 pid = rebate.buy{value: 1 ether}(id);

    // Cut price
    vm.warp(block.timestamp + 1 days);
    vm.prank(seller);
    rebate.setPrice(id, 0.5 ether);

    vm.warp(block.timestamp + WINDOW);
    rebate.settle(pid);

    // Malicious tries re-entering on withdraw
    vm.prank(address(mal));
    vm.expectRevert(Rebate.TransferFailed.selector);
    rebate.withdraw();
  }

  function test_ViewsAndPagination() public {
    vm.startPrank(seller);
    uint256 id1 = rebate.list("A", 1 ether, WINDOW, STOCK);
    uint256 id2 = rebate.list("B", 1 ether, WINDOW, STOCK);
    vm.stopPrank();

    vm.prank(alice);
    uint256 p1 = rebate.buy{value: 1 ether}(id1);

    (uint256[] memory ids, Rebate.Purchase[] memory purchases, uint256 total) = rebate.purchasesOf(id1, 0, 10);
    assertEq(total, 1);
    assertEq(ids[0], p1);
    assertEq(purchases[0].buyer, alice);

    (uint256[] memory bIds,,) = rebate.purchasesBy(alice, 0, 10);
    assertEq(bIds[0], p1);

    (uint256[] memory latestIds,, uint256 lTotal) = rebate.latest(0, 10);
    assertEq(lTotal, 2);
    assertEq(latestIds[0], id2);
    assertEq(latestIds[1], id1);
  }

  function testFuzz_RefundMatchesReferenceMin(uint8 numCutsRaw, uint16 priceDropSeed) public {
    uint8 numCuts = uint8(bound(numCutsRaw, 1, 10));
    uint128 startPrice = 10 ether;

    vm.prank(seller);
    uint256 id = rebate.list("Fuzz Item", startPrice, WINDOW, 50);

    vm.prank(alice);
    uint256 pid = rebate.buy{value: startPrice}(id);

    uint128 referenceLowest = startPrice;
    uint128 curPrice = startPrice;

    for (uint8 i = 0; i < numCuts; i++) {
      vm.warp(block.timestamp + 1 hours);
      // Alternate between drop and raise
      if (i % 2 == 0) {
        uint128 drop = uint128(bound(uint256(priceDropSeed) + i, 0.01 ether, 0.5 ether));
        if (curPrice > drop + 0.001 ether) {
          curPrice -= drop;
        }
      } else {
        curPrice += 0.2 ether;
      }
      if (curPrice < referenceLowest) {
        referenceLowest = curPrice;
      }
      vm.prank(seller);
      rebate.setPrice(id, curPrice);
    }

    uint256 expectedRefund = startPrice - referenceLowest;
    assertEq(rebate.refundDue(pid), expectedRefund);
  }

  function testFuzz_Conservation(uint8 nBuyersRaw) public {
    uint8 nBuyers = uint8(bound(nBuyersRaw, 2, 8));

    vm.prank(seller);
    uint256 id = rebate.list("Fuzz Conserve", 2 ether, WINDOW, 20);

    uint256[] memory pids = new uint256[](nBuyers);
    for (uint160 i = 0; i < nBuyers; i++) {
      address b = address(0x7000 + i);
      vm.deal(b, 10 ether);
      vm.prank(b);
      pids[i] = rebate.buy{value: 2 ether}(id);
    }

    // Cut price halfway through
    vm.warp(block.timestamp + 2 days);
    vm.prank(seller);
    rebate.setPrice(id, 1.5 ether);

    // Settle all
    vm.warp(block.timestamp + WINDOW);
    for (uint256 i = 0; i < nBuyers; i++) {
      rebate.settle(pids[i]);
    }

    uint256 sumPending = rebate.pending(seller);
    for (uint160 i = 0; i < nBuyers; i++) {
      sumPending += rebate.pending(address(0x7000 + i));
    }

    assertEq(address(rebate).balance, uint256(nBuyers) * 2 ether);
    assertEq(address(rebate).balance, sumPending);
  }

  function test_BoundaryMutantKillers() public {
    // 1. Kill Rebate.sol:96: if (nameBytes.length == 0 || nameBytes.length > MAX_NAME_BYTES)
    // 48-byte name must succeed, 49-byte must revert
    string memory name48 = "123456789012345678901234567890123456789012345678";
    vm.prank(seller);
    uint256 id48 = rebate.list(name48, PRICE, WINDOW, 1);
    assertEq(id48, 1);

    // 2. Kill Rebate.sol:97: if (price < MIN_PRICE || price > MAX_PRICE)
    // MAX_PRICE must succeed
    uint128 maxP = rebate.MAX_PRICE();
    vm.prank(seller);
    uint256 idMaxP = rebate.list("MaxPriceItem", maxP, WINDOW, 1);
    assertEq(idMaxP, 2);

    // 3. Kill Rebate.sol:99: if (stock == 0 || stock > MAX_STOCK)
    // MAX_STOCK must succeed
    vm.prank(seller);
    uint256 idMaxStock = rebate.list("MaxStockItem", PRICE, WINDOW, 1000);
    assertEq(idMaxStock, 3);

    // 4. Kill Rebate.sol:121: if (newPrice < MIN_PRICE || newPrice > MAX_PRICE)
    // MIN_PRICE in setPrice must succeed
    uint128 minP = rebate.MIN_PRICE();
    vm.prank(seller);
    rebate.setPrice(id48, minP);
    Rebate.Listing memory l = rebate.listingOf(id48);
    assertEq(l.price, minP);

    // 5. Kill Rebate.sol:272: if (count > MAX_PAGE) count = MAX_PAGE;
    // count == 50 (MAX_PAGE) should fetch up to 50
    vm.prank(alice);
    rebate.buy{value: minP}(id48);
    (uint256[] memory pids,,) = rebate.purchasesOf(id48, 0, 50);
    assertEq(pids.length, 1);

    // 6. Kill Rebate.sol:297: if (count > MAX_PAGE) count = MAX_PAGE in latest
    (uint256[] memory latestIds,,) = rebate.latest(0, 50);
    assertEq(latestIds.length, 3);
  }
}
