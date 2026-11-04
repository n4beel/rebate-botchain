// Specific error messages matching 58-rebate.md specifications
import { formatEther } from "viem";

export function formatRebateError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes("BadListing")) {
    return "Invalid listing parameters (name <= 48 bytes, price 0.001 - 1M BOT, window 1 - 30 days, stock 1 - 1000).";
  }
  if (msg.includes("ListingNotFound")) {
    return "Listing not found.";
  }
  if (msg.includes("PurchaseNotFound")) {
    return "Purchase record not found.";
  }
  if (msg.includes("NotSeller")) {
    return "Only the seller can change the price.";
  }
  if (msg.includes("TooManyChanges")) {
    return "This listing has used all its price changes.";
  }
  if (msg.includes("SoldOut")) {
    return "This item is sold out.";
  }
  if (msg.includes("SellerCannotBuy")) {
    return "You are the seller and cannot buy your own listing.";
  }
  const paymentMatch = msg.match(/WrongPayment\((\d+)\)/);
  if (paymentMatch) {
    const expected = formatEther(BigInt(paymentMatch[1]));
    return `The price is now ${expected} BOT. Review and try again.`;
  }
  if (msg.includes("WrongPayment")) {
    return "The price changed. Review and try again.";
  }
  const windowMatch = msg.match(/WindowOpen\((\d+)\)/);
  if (windowMatch) {
    const endsAt = new Date(Number(windowMatch[1]) * 1000).toLocaleString();
    return `Settlement opens at ${endsAt}.`;
  }
  if (msg.includes("WindowOpen")) {
    return "Protection window is still open.";
  }
  if (msg.includes("AlreadySettled")) {
    return "This purchase has already been settled.";
  }
  if (msg.includes("NothingToWithdraw")) {
    return "No pending funds available to withdraw.";
  }
  if (msg.includes("TransferFailed")) {
    return "Transfer failed.";
  }
  if (msg.includes("User rejected") || msg.includes("User denied")) {
    return "Transaction was rejected in wallet.";
  }

  return msg.length > 120 ? `${msg.slice(0, 117)}...` : msg;
}
