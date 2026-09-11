import express from "express";
import path from "path";
import fs from "fs";
import { ethers } from "ethers";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const app = express();
const PORT = 3000;
const TREASURY_WALLET = "0x034C2904BD96dA2e12Cd2d4f481198fEA0F7B08C";
const MIN_CONFIRMATIONS = 3;

app.use(express.json());

// In-memory cache of used transaction hashes for instant replay attack blocking
const memoryUsedHashes = new Set<string>();

// BSC RPC Providers with automatic failover
const BSC_RPC_URLS = [
  "https://bsc-dataseed.binance.org/",
  "https://bsc-dataseed1.defibit.io/",
  "https://bsc-dataseed1.ninicoin.io/",
  "https://binance.llamarpc.com",
];

let activeProviderIndex = 0;
function getBscProvider(): ethers.JsonRpcProvider {
  const url = BSC_RPC_URLS[activeProviderIndex % BSC_RPC_URLS.length];
  return new ethers.JsonRpcProvider(url, {
    name: "binance",
    chainId: 56,
  });
}

function switchProvider() {
  activeProviderIndex = (activeProviderIndex + 1) % BSC_RPC_URLS.length;
}

// Initialize Firestore on backend if config exists
let firestoreDb: any = null;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (config.apiKey && config.projectId) {
      const fbApp = getApps().length === 0 ? initializeApp(config) : getApps()[0];
      firestoreDb = getFirestore(fbApp, config.firestoreDatabaseId || undefined);
      console.log(" Backend Firestore initialized successfully for replay defense & settlement");
    }
  }
} catch (err) {
  console.warn("Backend Firestore initialization notice (using memory fallback):", err);
}

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/treasury-info", (_req, res) => {
  res.json({
    treasuryWallet: TREASURY_WALLET,
    network: "Binance Smart Chain (BEP-20)",
    chainId: 56,
    requiredConfirmations: MIN_CONFIRMATIONS,
  });
});

/**
 * Lookup recent transfers by BNB sender wallet address
 */
app.post("/api/lookup-tx", async (req, res) => {
  try {
    const { senderAddress } = req.body;
    if (!senderAddress || typeof senderAddress !== "string") {
      return res.status(400).json({ error: "Please provide a valid BNB sender wallet address" });
    }

    const cleanSender = senderAddress.trim().toLowerCase();
    if (!cleanSender.startsWith("0x") || cleanSender.length !== 42) {
      return res.status(400).json({ error: "Invalid BEP-20 BNB wallet address format (must start with 0x and be 42 characters)" });
    }

    // Try querying BscScan or BSC public RPC for recent blocks
    let candidateTxs: any[] = [];
    try {
      const provider = getBscProvider();
      const currentBlock = await provider.getBlockNumber();
      // Scan last 60 blocks (~3 minutes)
      const startBlock = Math.max(0, currentBlock - 60);

      for (let b = currentBlock; b >= startBlock; b -= 10) {
        try {
          const block = await provider.getBlock(b, true);
          if (block && block.prefetchedTransactions) {
            for (const tx of block.prefetchedTransactions) {
              if (
                tx.from?.toLowerCase() === cleanSender &&
                tx.to?.toLowerCase() === TREASURY_WALLET.toLowerCase()
              ) {
                candidateTxs.push({
                  hash: tx.hash,
                  blockNumber: tx.blockNumber,
                  valueBNB: Number(ethers.formatEther(tx.value)),
                });
              }
            }
          }
        } catch {
          // continue to next block
        }
        if (candidateTxs.length >= 3) break;
      }
    } catch (scanErr) {
      console.warn("RPC block search warning:", scanErr);
    }

    return res.json({
      sender: cleanSender,
      treasuryWallet: TREASURY_WALLET,
      transactions: candidateTxs,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to search transactions" });
  }
});

/**
 * Backend Payment Verification Endpoint
 * Performs RPC on-chain validation, block confirmation wait, replay attack prevention, and state update
 */
app.post("/api/verify-payment", async (req, res) => {
  try {
    const { txHash, userAddress, paymentType, targetTier, expectedUSD, bnbPrice } = req.body;

    if (!txHash || typeof txHash !== "string") {
      return res.status(400).json({
        success: false,
        error: "Transaction Hash (TxID) is required for verification.",
      });
    }

    const cleanHash = txHash.trim().toLowerCase();

    // Validate 66-character 0x hex format
    if (!/^0x[a-f0-9]{64}$/.test(cleanHash)) {
      return res.status(400).json({
        success: false,
        error: "Invalid TxID format. A Binance Smart Chain transaction hash must begin with '0x' followed by 64 hexadecimal characters.",
      });
    }

    // 1. REPLAY ATTACK PREVENTION: Check in-memory store
    if (memoryUsedHashes.has(cleanHash)) {
      return res.status(409).json({
        success: false,
        error: "REPLAY_ATTACK_DETECTED: This transaction hash has already been credited. Re-using previous transactions is strictly prohibited.",
        code: "REPLAY_ATTACK",
      });
    }

    // 1b. REPLAY ATTACK PREVENTION: Check Firestore database
    if (firestoreDb) {
      try {
        const usedDocRef = doc(firestoreDb, "usedTxHashes", cleanHash);
        const usedSnap = await getDoc(usedDocRef);
        if (usedSnap.exists()) {
          memoryUsedHashes.add(cleanHash);
          return res.status(409).json({
            success: false,
            error: "REPLAY_ATTACK_DETECTED: This transaction hash has already been processed and credited in the system.",
            code: "REPLAY_ATTACK",
          });
        }
      } catch (dbErr) {
        console.warn("Firestore replay check warning:", dbErr);
      }
    }

    // 2. QUERY BINANCE SMART CHAIN RPC VIA ETHERS.JS
    let provider = getBscProvider();
    let tx: ethers.TransactionResponse | null = null;
    let receipt: ethers.TransactionReceipt | null = null;

    try {
      tx = await provider.getTransaction(cleanHash);
      if (tx) {
        receipt = await provider.getTransactionReceipt(cleanHash);
      }
    } catch (rpcErr) {
      console.warn("Primary RPC error, attempting fallback:", rpcErr);
      switchProvider();
      provider = getBscProvider();
      tx = await provider.getTransaction(cleanHash);
      if (tx) {
        receipt = await provider.getTransactionReceipt(cleanHash);
      }
    }

    // Check if transaction exists on-chain
    if (!tx) {
      return res.status(404).json({
        success: false,
        pending: true,
        error: "Transaction was not found on Binance Smart Chain yet. If you just transferred, please allow 5-15 seconds for the BSC network to propagate.",
      });
    }

    // Check if mined into a block
    if (!receipt || receipt.blockNumber === null) {
      return res.status(200).json({
        success: false,
        pending: true,
        message: "Transaction detected in Binance Smart Chain mempool. Waiting for block inclusion...",
      });
    }

    // Check transaction status (1 = Success, 0 = Reverted)
    if (receipt.status !== 1) {
      return res.status(400).json({
        success: false,
        error: "Transaction failed or reverted on-chain on Binance Smart Chain.",
      });
    }

    // Check recipient matches Treasury Wallet (case-insensitive)
    const txRecipient = (tx.to || "").toLowerCase();
    if (txRecipient !== TREASURY_WALLET.toLowerCase()) {
      return res.status(400).json({
        success: false,
        error: `Invalid Treasury recipient: Funds were transferred to ${tx.to}, but the official BinanceHarvest Treasury Wallet is ${TREASURY_WALLET}.`,
      });
    }

    // Check BNB amount sent
    const actualBNB = Number(ethers.formatEther(tx.value));
    const effectivePrice = bnbPrice && bnbPrice > 0 ? bnbPrice : 600;
    const requiredBNB = expectedUSD ? expectedUSD / effectivePrice : 0;
    // Allow small 5% price variance tolerance during wallet confirmation
    const minAcceptableBNB = requiredBNB * 0.95;

    if (requiredBNB > 0 && actualBNB < minAcceptableBNB) {
      return res.status(400).json({
        success: false,
        error: `Insufficient payment amount: The transaction sent ${actualBNB.toFixed(5)} BNB, but the required amount is ~${requiredBNB.toFixed(5)} BNB ($${expectedUSD} USD).`,
      });
    }

    // 3. BLOCK CONFIRMATIONS GUARD (3-12 block confirmations)
    const currentBlock = await provider.getBlockNumber();
    const confirmations = Math.max(1, currentBlock - receipt.blockNumber + 1);

    if (confirmations < MIN_CONFIRMATIONS) {
      const remainingSec = (MIN_CONFIRMATIONS - confirmations) * 3;
      return res.status(200).json({
        success: false,
        pending: true,
        confirmations,
        requiredConfirmations: MIN_CONFIRMATIONS,
        blockNumber: receipt.blockNumber,
        currentBlock,
        message: `Verifying on BNB Chain: ${confirmations} of ${MIN_CONFIRMATIONS} block confirmations (~${remainingSec}s remaining). Guarding against chain re-organizations...`,
      });
    }

    // 4. TRANSACTION FULLY CONFIRMED! SAVE TO DATABASE (REPLAY PREVENTION & AUDIT)
    memoryUsedHashes.add(cleanHash);

    const confirmationTimestamp = new Date().toISOString();
    const recordPayload = {
      txHash: cleanHash,
      walletAddress: userAddress || tx.from,
      type: paymentType || "MANUAL_PAYMENT",
      amountBNB: actualBNB,
      amountUSD: expectedUSD || actualBNB * effectivePrice,
      blockNumber: receipt.blockNumber,
      confirmations,
      confirmedAt: confirmationTimestamp,
    };

    if (firestoreDb) {
      try {
        // 1) Mark txHash as used
        await setDoc(doc(firestoreDb, "usedTxHashes", cleanHash), recordPayload);

        // 2) Write transaction audit record
        await setDoc(doc(firestoreDb, "transactions", cleanHash), {
          id: cleanHash,
          userAddress: userAddress || tx.from,
          type: paymentType || "MANUAL_PAYMENT",
          amountBNB: actualBNB,
          amountUSD: expectedUSD || actualBNB * effectivePrice,
          txHash: cleanHash,
          status: "SUCCESS",
          timestamp: confirmationTimestamp,
        });

        // 3) Update user account state directly on backend
        if (userAddress) {
          const userDocRef = doc(firestoreDb, "users", userAddress);
          if (paymentType === "UPGRADE" && targetTier) {
            await updateDoc(userDocRef, {
              currentTier: targetTier,
              lastActiveTimestamp: confirmationTimestamp,
            });
          } else if (paymentType === "WITHDRAW_FEE") {
            await updateDoc(userDocRef, {
              withdrawalStatus: "PENDING_ADMIN_APPROVAL",
              isVerified: true,
              lastActiveTimestamp: confirmationTimestamp,
            });
          }
        }
      } catch (dbWriteErr) {
        console.warn("Firestore settlement write warning:", dbWriteErr);
      }
    }

    return res.status(200).json({
      success: true,
      txHash: cleanHash,
      blockNumber: receipt.blockNumber,
      confirmations,
      amountBNB: actualBNB,
      amountUSD: expectedUSD || actualBNB * effectivePrice,
      senderAddress: tx.from,
      treasuryAddress: tx.to,
      paymentType: paymentType || "MANUAL_PAYMENT",
      message: "Payment verified successfully on Binance Smart Chain!",
    });
  } catch (err: any) {
    console.error("Backend payment verification error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "An unexpected error occurred during on-chain verification.",
    });
  }
});

// -------------------------------------------------------------
// VITE MIDDLEWARE & STATIC ASSETS
// -------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(` Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
