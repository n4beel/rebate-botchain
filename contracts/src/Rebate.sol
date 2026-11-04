// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

contract Rebate {
  // --- Errors ---
  error BadListing();
  error ListingNotFound();
  error PurchaseNotFound();
  error NotSeller();
  error TooManyChanges();
  error SoldOut();
  error SellerCannotBuy();
  error WrongPayment(uint256 expected);
  error WindowOpen(uint64 endsAt);
  error AlreadySettled();
  error NothingToWithdraw();
  error TransferFailed();
  error Reentrancy();

  // --- Constants ---
  uint256 public constant MAX_NAME_BYTES = 48;
  uint64 public constant MIN_WINDOW = 1 days;
  uint64 public constant MAX_WINDOW = 30 days;
  uint32 public constant MAX_STOCK = 1000;
  uint128 public constant MIN_PRICE = 0.001 ether;
  uint128 public constant MAX_PRICE = 1_000_000 ether;
  uint256 public constant MAX_CHANGES = 24; // including opening price
  uint256 public constant MAX_PAGE = 50;

  // --- Types ---
  struct Listing {
    address seller;
    uint64 windowSecs;
    uint32 stock;
    uint128 price;
    string name;
  }

  struct Change {
    uint64 at;
    uint128 price;
  }

  struct Purchase {
    uint256 listingId;
    address buyer;
    uint64 boughtAt;
    uint128 paid;
    bool settled;
  }

  // --- Storage ---
  mapping(uint256 => Listing) private _listings;
  mapping(uint256 => Change[]) private _changes;                      // at most MAX_CHANGES per listing
  mapping(uint256 => Purchase) private _purchases;
  mapping(uint256 => uint256[]) private _byListing;
  mapping(address => uint256[]) private _byBuyer;
  mapping(address => uint256) public pending;
  uint256 public listingCount;
  uint256 public purchaseCount;

  bool private _locked;

  // --- Events ---
  event Listed(
    uint256 indexed id,
    address indexed seller,
    string name,
    uint128 price,
    uint64 windowSecs,
    uint32 stock
  );
  event PriceChanged(uint256 indexed id, uint128 price, uint64 at);
  event Bought(uint256 indexed id, uint256 indexed purchaseId, address indexed buyer, uint128 paid);
  event Settled(uint256 indexed purchaseId, uint256 refund, uint256 toSeller);
  event Withdrawn(address indexed to, uint256 amount);

  // --- Modifiers ---
  modifier nonReentrant() {
    if (_locked) revert Reentrancy();
    _locked = true;
    _;
    _locked = false;
  }

  // --- External Mutating Functions ---

  /// @notice Create a price-protected listing
  function list(
    string calldata name,
    uint128 price,
    uint64 windowSecs,
    uint32 stock
  ) external returns (uint256 id) {
    bytes memory nameBytes = bytes(name);
    if (nameBytes.length == 0 || nameBytes.length > MAX_NAME_BYTES) revert BadListing();
    if (price < MIN_PRICE || price > MAX_PRICE) revert BadListing();
    if (windowSecs < MIN_WINDOW || windowSecs > MAX_WINDOW) revert BadListing();
    if (stock == 0 || stock > MAX_STOCK) revert BadListing();

    id = ++listingCount;
    Listing storage l = _listings[id];
    l.seller = msg.sender;
    l.windowSecs = windowSecs;
    l.stock = stock;
    l.price = price;
    l.name = name;

    uint64 nowSecs = uint64(block.timestamp);
    _changes[id].push(Change({at: nowSecs, price: price}));

    emit Listed(id, msg.sender, name, price, windowSecs, stock);
  }

  /// @notice Seller adjusts listing price
  function setPrice(uint256 id, uint128 newPrice) external {
    if (id == 0 || id > listingCount) revert ListingNotFound();
    Listing storage l = _listings[id];
    if (msg.sender != l.seller) revert NotSeller();
    if (_changes[id].length >= MAX_CHANGES) revert TooManyChanges();
    if (newPrice < MIN_PRICE || newPrice > MAX_PRICE) revert BadListing();

    l.price = newPrice;
    uint64 nowSecs = uint64(block.timestamp);
    _changes[id].push(Change({at: nowSecs, price: newPrice}));

    emit PriceChanged(id, newPrice, nowSecs);
  }

  /// @notice Buy an item from a listing with automatic price protection
  function buy(uint256 id) external payable returns (uint256 purchaseId) {
    if (id == 0 || id > listingCount) revert ListingNotFound();
    Listing storage l = _listings[id];

    if (l.stock == 0) revert SoldOut();
    if (msg.sender == l.seller) revert SellerCannotBuy();
    if (msg.value != l.price) revert WrongPayment(l.price);

    l.stock -= 1;
    purchaseId = ++purchaseCount;

    uint64 nowSecs = uint64(block.timestamp);
    Purchase storage p = _purchases[purchaseId];
    p.listingId = id;
    p.buyer = msg.sender;
    p.boughtAt = nowSecs;
    p.paid = l.price;
    p.settled = false;

    _byListing[id].push(purchaseId);
    _byBuyer[msg.sender].push(purchaseId);

    emit Bought(id, purchaseId, msg.sender, l.price);
  }

  /// @notice Settle purchase after price protection window closes
  function settle(uint256 purchaseId) external {
    if (purchaseId == 0 || purchaseId > purchaseCount) revert PurchaseNotFound();
    Purchase storage p = _purchases[purchaseId];
    if (p.settled) revert AlreadySettled();

    Listing storage l = _listings[p.listingId];
    uint64 windowEndsAt = p.boughtAt + l.windowSecs;
    if (block.timestamp < windowEndsAt) revert WindowOpen(windowEndsAt);

    p.settled = true;
    uint256 refund = refundDue(purchaseId);
    uint256 toSeller = uint256(p.paid) - refund;

    pending[p.buyer] += refund;
    pending[l.seller] += toSeller;

    emit Settled(purchaseId, refund, toSeller);
  }

  /// @notice Pull accrued seller or refund funds
  function withdraw() external nonReentrant {
    uint256 amount = pending[msg.sender];
    if (amount == 0) revert NothingToWithdraw();

    pending[msg.sender] = 0;

    (bool ok,) = msg.sender.call{value: amount}("");
    if (!ok) revert TransferFailed();

    emit Withdrawn(msg.sender, amount);
  }

  // --- View Functions ---

  /// @notice Retrieve listing details
  function listingOf(uint256 id) external view returns (Listing memory) {
    if (id == 0 || id > listingCount) revert ListingNotFound();
    return _listings[id];
  }

  /// @notice Retrieve all recorded price changes for a listing
  function changesOf(uint256 id) external view returns (Change[] memory) {
    if (id == 0 || id > listingCount) revert ListingNotFound();
    return _changes[id];
  }

  /// @notice Retrieve purchase details
  function purchaseOf(uint256 purchaseId) external view returns (Purchase memory) {
    if (purchaseId == 0 || purchaseId > purchaseCount) revert PurchaseNotFound();
    return _purchases[purchaseId];
  }

  /// @notice Calculate live or final refund due on a purchase
  /// @dev refundDue(pid) = paid - min(paid, min{ c.price : c in changes, boughtAt <= c.at <= boughtAt + windowSecs })
  function refundDue(uint256 purchaseId) public view returns (uint256) {
    if (purchaseId == 0 || purchaseId > purchaseCount) revert PurchaseNotFound();
    Purchase storage p = _purchases[purchaseId];
    Listing storage l = _listings[p.listingId];

    uint64 start = p.boughtAt;
    uint64 end = p.boughtAt + l.windowSecs;
    uint128 lowestPrice = p.paid;

    Change[] storage history = _changes[p.listingId];
    uint256 len = history.length;

    for (uint256 i = 0; i < len; i++) {
      Change storage c = history[i];
      if (c.at >= start && c.at <= end) {
        if (c.price < lowestPrice) {
          lowestPrice = c.price;
        }
      }
    }

    return uint256(p.paid) - uint256(lowestPrice);
  }

  /// @notice Retrieve purchase IDs for a listing
  function purchasesOf(uint256 id, uint256 offset, uint256 count)
    external
    view
    returns (uint256[] memory ids, Purchase[] memory purchases, uint256 total)
  {
    if (id == 0 || id > listingCount) revert ListingNotFound();
    uint256[] storage allIds = _byListing[id];
    total = allIds.length;

    if (count > MAX_PAGE) count = MAX_PAGE;
    if (offset >= total || count == 0) {
      return (new uint256[](0), new Purchase[](0), total);
    }
    if (offset + count > total) {
      count = total - offset;
    }

    ids = new uint256[](count);
    purchases = new Purchase[](count);

    for (uint256 i = 0; i < count; i++) {
      uint256 pid = allIds[offset + i];
      ids[i] = pid;
      purchases[i] = _purchases[pid];
    }
  }

  /// @notice Retrieve purchase IDs for a buyer
  function purchasesBy(address addr, uint256 offset, uint256 count)
    external
    view
    returns (uint256[] memory ids, Purchase[] memory purchases, uint256 total)
  {
    uint256[] storage allIds = _byBuyer[addr];
    total = allIds.length;

    if (count > MAX_PAGE) count = MAX_PAGE;
    if (offset >= total || count == 0) {
      return (new uint256[](0), new Purchase[](0), total);
    }
    if (offset + count > total) {
      count = total - offset;
    }

    ids = new uint256[](count);
    purchases = new Purchase[](count);

    for (uint256 i = 0; i < count; i++) {
      uint256 pid = allIds[offset + i];
      ids[i] = pid;
      purchases[i] = _purchases[pid];
    }
  }

  /// @notice Retrieve latest listings
  function latest(uint256 offset, uint256 count)
    external
    view
    returns (uint256[] memory ids, Listing[] memory listings, uint256 total)
  {
    total = listingCount;
    if (count > MAX_PAGE) {
      count = MAX_PAGE;
    }

    if (offset >= total || count == 0) {
      return (new uint256[](0), new Listing[](0), total);
    }

    if (offset + count > total) {
      count = total - offset;
    }

    ids = new uint256[](count);
    listings = new Listing[](count);

    for (uint256 i = 0; i < count; i++) {
      uint256 id = total - (offset + i);
      ids[i] = id;
      listings[i] = _listings[id];
    }
  }
}
