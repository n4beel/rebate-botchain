import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "child_process";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  type Address,
  defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { BOTCHAIN_ABI } from "../../lib/botchain/abi";
import { readFileSync } from "fs";
import { resolve } from "path";

const ANVIL_PORT = 8658;
const RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`;

const localChain = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
});

// Anvil standard accounts
const SELLER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Acct 0
const BUYER_A_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // Acct 1
const BUYER_B_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"; // Acct 2

const sellerAccount = privateKeyToAccount(SELLER_KEY);
const buyerAAccount = privateKeyToAccount(BUYER_A_KEY);
const buyerBAccount = privateKeyToAccount(BUYER_B_KEY);

describe("Rebate integration test (Anvil)", () => {
  let anvilProcess: ChildProcess;
  let contractAddress: Address;

  const publicClient = createPublicClient({
    chain: localChain,
    transport: http(RPC_URL),
  });

  const sellerClient = createWalletClient({
    account: sellerAccount,
    chain: localChain,
    transport: http(RPC_URL),
  });

  const buyerAClient = createWalletClient({
    account: buyerAAccount,
    chain: localChain,
    transport: http(RPC_URL),
  });

  const buyerBClient = createWalletClient({
    account: buyerBAccount,
    chain: localChain,
    transport: http(RPC_URL),
  });

  beforeAll(async () => {
    anvilProcess = spawn("anvil", ["--port", String(ANVIL_PORT), "--silent"], {
      stdio: "ignore",
    });

    let connected = false;
    for (let i = 0; i < 30; i++) {
      try {
        await publicClient.getBlockNumber();
        connected = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    if (!connected) throw new Error("Could not connect to Anvil on port " + ANVIL_PORT);

    const artifactPath = resolve(__dirname, "../../contracts/out/Rebate.sol/Rebate.json");
    const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
    const bytecode = artifact.bytecode.object as `0x${string}`;

    const deployHash = await sellerClient.deployContract({
      abi: BOTCHAIN_ABI,
      bytecode,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
    if (!receipt.contractAddress) throw new Error("Contract deployment failed");
    contractAddress = receipt.contractAddress;
  });

  afterAll(() => {
    if (anvilProcess) {
      anvilProcess.kill();
    }
  });

  it("lists item, buys with price protection, cuts price, advances time, settles with refund and withdraws", async () => {
    const startPrice = parseEther("2.0");
    const windowSecs = 86400n * 7n; // 7 days
    const stock = 10;

    // 1. Seller lists item
    const listTx = await sellerClient.writeContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "list",
      args: ["Noise Cancelling Headphones", startPrice, windowSecs, stock],
    });
    await publicClient.waitForTransactionReceipt({ hash: listTx });

    const listingId = 1n;

    // 2. Buyer A buys at 2.0 BOT
    const buyTx = await buyerAClient.writeContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "buy",
      args: [listingId],
      value: startPrice,
    });
    const buyReceipt = await publicClient.waitForTransactionReceipt({ hash: buyTx });
    const purchaseId = 1n;

    // 3. Seller drops price to 1.4 BOT (0.6 BOT refund due)
    const cutTx = await sellerClient.writeContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "setPrice",
      args: [listingId, parseEther("1.4")],
    });
    await publicClient.waitForTransactionReceipt({ hash: cutTx });

    // Verify live refund due is 0.6 BOT
    const liveRefund = (await publicClient.readContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "refundDue",
      args: [purchaseId],
    })) as bigint;
    expect(liveRefund).toBe(parseEther("0.6"));

    // 4. Advance time past window using evm_increaseTime
    await (publicClient as any).request({
      method: "evm_increaseTime",
      params: [Number(windowSecs) + 60],
    });
    await (publicClient as any).request({
      method: "evm_mine",
      params: [],
    });

    // 5. Settle purchase
    const settleTx = await buyerAClient.writeContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "settle",
      args: [purchaseId],
    });
    await publicClient.waitForTransactionReceipt({ hash: settleTx });

    // Buyer A pending: 0.6 BOT
    // Seller pending: 1.4 BOT
    const buyerPending = (await publicClient.readContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "pending",
      args: [buyerAAccount.address],
    })) as bigint;
    expect(buyerPending).toBe(parseEther("0.6"));

    const sellerPending = (await publicClient.readContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "pending",
      args: [sellerAccount.address],
    })) as bigint;
    expect(sellerPending).toBe(parseEther("1.4"));

    // 6. Buyer A withdraws refund
    const balBefore = await publicClient.getBalance({ address: buyerAAccount.address });
    const wTx = await buyerAClient.writeContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "withdraw",
    });
    const wReceipt = await publicClient.waitForTransactionReceipt({ hash: wTx });
    const gasUsed = wReceipt.gasUsed * wReceipt.effectiveGasPrice;
    const balAfter = await publicClient.getBalance({ address: buyerAAccount.address });

    expect(balAfter).toBe(balBefore + parseEther("0.6") - gasUsed);
  });
});
