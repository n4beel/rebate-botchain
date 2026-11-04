import { spawn } from "child_process";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ANVIL_PORT = 8758;
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
const BUYER_KEYS = [
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // Buyer A (Acct 1)
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // Buyer B (Acct 2)
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // Buyer C (Acct 3)
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // Buyer D (Acct 4)
];

async function main() {
  console.log(`Starting Anvil on port ${ANVIL_PORT}...`);
  const anvil = spawn("anvil", ["--port", String(ANVIL_PORT), "--silent"], {
    stdio: "inherit",
  });

  process.on("SIGINT", () => {
    anvil.kill();
    process.exit();
  });
  process.on("SIGTERM", () => {
    anvil.kill();
    process.exit();
  });

  const publicClient = createPublicClient({
    chain: localChain,
    transport: http(RPC_URL),
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
  if (!connected) throw new Error("Could not connect to Anvil");

  const sellerAccount = privateKeyToAccount(SELLER_KEY);
  const sellerClient = createWalletClient({
    account: sellerAccount,
    chain: localChain,
    transport: http(RPC_URL),
  });

  const artifactPath = resolve(__dirname, "../contracts/out/Rebate.sol/Rebate.json");
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const abi = artifact.abi;
  const bytecode = artifact.bytecode.object as `0x${string}`;

  console.log("Deploying Rebate contract...");
  const deployHash = await sellerClient.deployContract({
    abi,
    bytecode,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const contractAddress = receipt.contractAddress!;
  console.log(`Rebate deployed at: ${contractAddress}`);

  // Write .env.local
  const envContent = [
    `NEXT_PUBLIC_CONTRACT_31337=${contractAddress}`,
    `NEXT_PUBLIC_DEPLOY_BLOCK_31337=${receipt.blockNumber}`,
    `NEXT_PUBLIC_CHAIN_ID=31337`,
    `NEXT_PUBLIC_RPC_URL=${RPC_URL}`,
  ].join("\n");
  writeFileSync(resolve(__dirname, "../.env.local"), envContent + "\n");
  console.log("Wrote .env.local");

  // SEED DATA per 58-rebate.md §5:
  // - Listing 1: with three price changes and four purchases at different moments (different refunds)
  // - Listing 2: sold out
  // - Listing 3: with a window about to end
  // - Listing 4: new
  // - One purchase settled, one settleable
  console.log("Seeding listings...");

  const buyers = BUYER_KEYS.map((k) => {
    const acct = privateKeyToAccount(k as `0x${string}`);
    return createWalletClient({ account: acct, chain: localChain, transport: http(RPC_URL) });
  });

  // Listing 1: 2.0 BOT, 14 days, stock 20
  const l1Tx = await sellerClient.writeContract({
    address: contractAddress,
    abi,
    functionName: "list",
    args: ["4K OLED Smart TV", parseEther("2.0"), 86400n * 14n, 20],
  });
  await publicClient.waitForTransactionReceipt({ hash: l1Tx });

  // Purchase 1: Buyer A buys at 2.0 BOT
  const b1 = await buyers[0].writeContract({ address: contractAddress, abi, functionName: "buy", args: [1n], value: parseEther("2.0") });
  await publicClient.waitForTransactionReceipt({ hash: b1 });

  // Price cut 1: drop to 1.8 BOT
  const c1 = await sellerClient.writeContract({ address: contractAddress, abi, functionName: "setPrice", args: [1n, parseEther("1.8")] });
  await publicClient.waitForTransactionReceipt({ hash: c1 });

  // Purchase 2: Buyer B buys at 1.8 BOT
  const b2 = await buyers[1].writeContract({ address: contractAddress, abi, functionName: "buy", args: [1n], value: parseEther("1.8") });
  await publicClient.waitForTransactionReceipt({ hash: b2 });

  // Price cut 2: drop to 1.5 BOT (lowest)
  const c2 = await sellerClient.writeContract({ address: contractAddress, abi, functionName: "setPrice", args: [1n, parseEther("1.5")] });
  await publicClient.waitForTransactionReceipt({ hash: c2 });

  // Purchase 3: Buyer C buys at 1.5 BOT
  const b3 = await buyers[2].writeContract({ address: contractAddress, abi, functionName: "buy", args: [1n], value: parseEther("1.5") });
  await publicClient.waitForTransactionReceipt({ hash: b3 });

  // Price cut 3: raise to 1.7 BOT
  const c3 = await sellerClient.writeContract({ address: contractAddress, abi, functionName: "setPrice", args: [1n, parseEther("1.7")] });
  await publicClient.waitForTransactionReceipt({ hash: c3 });

  // Purchase 4: Buyer D buys at 1.7 BOT
  const b4 = await buyers[3].writeContract({ address: contractAddress, abi, functionName: "buy", args: [1n], value: parseEther("1.7") });
  await publicClient.waitForTransactionReceipt({ hash: b4 });

  // Listing 2: Sold out (stock 1)
  const l2Tx = await sellerClient.writeContract({
    address: contractAddress,
    abi,
    functionName: "list",
    args: ["Limited Mechanical Keyboard", parseEther("0.8"), 86400n * 7n, 1],
  });
  await publicClient.waitForTransactionReceipt({ hash: l2Tx });
  const bSoldOut = await buyers[0].writeContract({ address: contractAddress, abi, functionName: "buy", args: [2n], value: parseEther("0.8") });
  await publicClient.waitForTransactionReceipt({ hash: bSoldOut });

  // Listing 3: window 1 day
  const l3Tx = await sellerClient.writeContract({
    address: contractAddress,
    abi,
    functionName: "list",
    args: ["Wireless Charging Pad", parseEther("0.2"), 86400n, 10],
  });
  await publicClient.waitForTransactionReceipt({ hash: l3Tx });
  const bL3 = await buyers[1].writeContract({ address: contractAddress, abi, functionName: "buy", args: [3n], value: parseEther("0.2") });
  await publicClient.waitForTransactionReceipt({ hash: bL3 });

  // Listing 4: New listing
  const l4Tx = await sellerClient.writeContract({
    address: contractAddress,
    abi,
    functionName: "list",
    args: ["Ergonomic Office Chair", parseEther("1.2"), 86400n * 21n, 15],
  });
  await publicClient.waitForTransactionReceipt({ hash: l4Tx });

  console.log("Local stack ready! Running indefinitely. Press Ctrl+C to exit.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
