import { ethers } from 'ethers';

export const TREASURY_WALLET = "0x034C2904BD96dA2e12Cd2d4f481198fEA0F7B08C";
export const BSC_CHAIN_ID = "0x38"; // 56 in decimal
export const BSC_PARAMS = {
  chainId: BSC_CHAIN_ID,
  chainName: 'Binance Smart Chain Mainnet',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18,
  },
  rpcUrls: ['https://bsc-dataseed.binance.org/'],
  blockExplorerUrls: ['https://bscscan.com/'],
};

const CHAINLINK_FEED_ABI = [
  "function decimals() external view returns (uint8)",
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)"
];
const CHAINLINK_BNB_USD_ADDRESS = "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE";

let lastKnownBNBPrice = 750;

export async function fetchLiveBNBPrice(): Promise<number> {
  const fetchWithTimeout = async (url: string, ms = 3000): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  };

  const sources: Array<() => Promise<number>> = [
    // 0. On-chain Chainlink Oracle via user's connected Web3 wallet (falling back to public RPC)
    async () => {
      let provider: ethers.Provider | null = null;
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        try {
          provider = new ethers.BrowserProvider((window as any).ethereum);
        } catch {
          // Fallback to public RPC
        }
      }
      if (!provider) {
        provider = getPublicBscProvider();
      }
      
      const contract = new ethers.Contract(CHAINLINK_BNB_USD_ADDRESS, CHAINLINK_FEED_ABI, provider);
      // Impose a timeout of 4 seconds on the on-chain query to keep UI snappy
      const onChainData = await Promise.race([
        Promise.all([contract.decimals(), contract.latestRoundData()]),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000))
      ]);
      
      const decimals = Number(onChainData[0]);
      const latestRoundData = onChainData[1];
      const price = Number(latestRoundData.answer) / Math.pow(10, decimals);
      if (price > 0 && !isNaN(price)) {
        return price;
      }
      throw new Error("Invalid on-chain price");
    },
    // 1. Binance US ticker (open CORS, fast)
    async () => {
      const res = await fetchWithTimeout('https://api.binance.us/api/v3/ticker/price?symbol=BNBUSDT');
      const data = await res.json();
      return parseFloat(data.price);
    },
    // 2. CoinGecko public price API
    async () => {
      const res = await fetchWithTimeout('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd');
      const data = await res.json();
      return parseFloat(data.binancecoin?.usd);
    },
    // 3. Kraken ticker API
    async () => {
      const res = await fetchWithTimeout('https://api.kraken.com/0/public/Ticker?pair=BNBUSD');
      const data = await res.json();
      const val = data?.result?.BNBUSD?.c?.[0];
      return parseFloat(val);
    },
    // 4. Binance Global ticker
    async () => {
      const res = await fetchWithTimeout('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT');
      const data = await res.json();
      return parseFloat(data.price);
    },
  ];

  for (const source of sources) {
    try {
      const price = await source();
      if (typeof price === 'number' && !isNaN(price) && price > 0) {
        lastKnownBNBPrice = price;
        return price;
      }
    } catch {
      // Continue to next provider silently
    }
  }

  // Gracefully return last known price
  return lastKnownBNBPrice;
}

const BSC_RPC_ENDPOINTS = [
  'https://bsc-dataseed.binance.org/',
  'https://rpc.ankr.com/bsc',
  'https://binance.llamarpc.com',
];

let cachedProvider: ethers.JsonRpcProvider | null = null;

export function getPublicBscProvider(): ethers.JsonRpcProvider {
  if (!cachedProvider) {
    cachedProvider = new ethers.JsonRpcProvider(BSC_RPC_ENDPOINTS[0]);
  }
  return cachedProvider;
}

export async function getLiveTreasuryStats(): Promise<{
  treasuryBnb: string;
  treasuryBnbFormatted: string;
  blockNumber: number;
  gasPriceGwei: string;
}> {
  try {
    const provider = getPublicBscProvider();
    const [balance, blockNumber, feeData] = await Promise.all([
      provider.getBalance(TREASURY_WALLET),
      provider.getBlockNumber(),
      provider.getFeeData().catch(() => null),
    ]);

    const bnbStr = ethers.formatEther(balance);
    const gasGwei = feeData?.gasPrice ? (Number(feeData.gasPrice) / 1e9).toFixed(1) : '3.0';

    return {
      treasuryBnb: bnbStr,
      treasuryBnbFormatted: Number(bnbStr).toFixed(4),
      blockNumber,
      gasPriceGwei: gasGwei,
    };
  } catch (err) {
    console.error("Failed to query live BSC treasury stats:", err);
    return {
      treasuryBnb: '0.0000',
      treasuryBnbFormatted: '0.0000',
      blockNumber: 0,
      gasPriceGwei: '3.0',
    };
  }
}

export async function getRealWalletBalance(address: string): Promise<string> {
  if (!address || !ethers.isAddress(address)) return "0.0000";
  try {
    const provider = getPublicBscProvider();
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  } catch (e) {
    console.warn("Could not query wallet balance:", e);
    return "0.0000";
  }
}

export function isMetaMaskInstalled(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).ethereum);
}

export function detectWeb3Providers(): {
  hasWeb3: boolean;
  isMetaMask: boolean;
  isTrust: boolean;
  isBinance: boolean;
  isCoinbase: boolean;
} {
  if (typeof window === 'undefined') {
    return { hasWeb3: false, isMetaMask: false, isTrust: false, isBinance: false, isCoinbase: false };
  }
  const eth = (window as any).ethereum;
  return {
    hasWeb3: Boolean(eth),
    isMetaMask: Boolean(eth?.isMetaMask),
    isTrust: Boolean(eth?.isTrust || eth?.isTrustWallet),
    isBinance: Boolean((window as any).BinanceChain || eth?.isBinance),
    isCoinbase: Boolean(eth?.isCoinbaseWallet),
  };
}

export async function signWeb3AuthMessage(signer: ethers.Signer, address: string): Promise<string> {
  const timestamp = new Date().toISOString();
  const challenge = `Welcome to BinanceHarvest Cloud Mining!\n\nSign this cryptographic challenge to authenticate your on-chain miner identity on Binance Smart Chain.\n\nMiner Address: ${address}\nChain ID: 56 (BSC Mainnet)\nTimestamp: ${timestamp}`;
  return await signer.signMessage(challenge);
}

export async function connectWallet(): Promise<{
  address: string;
  provider: ethers.BrowserProvider;
  signer: ethers.Signer;
}> {
  const ethereum = typeof window !== 'undefined' ? (window as any).ethereum : null;

  if (!ethereum) {
    throw new Error(
      "WEB3_WALLET_NOT_FOUND: No Web3 wallet extension detected in this browser window. Please install MetaMask or open this app in your Web3 browser."
    );
  }

  try {
    const provider = new ethers.BrowserProvider(ethereum);
    // Request accounts from the real wallet
    const accounts = await provider.send("eth_requestAccounts", []);
    if (!accounts || accounts.length === 0) {
      throw new Error("No authorized accounts returned by wallet.");
    }

    // Verify BSC network and switch if needed
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== 56) {
      const switched = await switchToBSC();
      if (!switched) {
        throw new Error("Please switch your wallet network to Binance Smart Chain Mainnet (Chain ID 56).");
      }
    }

    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    return { address, provider, signer };
  } catch (error: any) {
    console.error("Real wallet connection error:", error);
    if (error?.code === 4001 || error?.message?.includes("User rejected")) {
      throw new Error("Connection request was rejected in your wallet.");
    }
    throw error;
  }
}

export async function switchToBSC(): Promise<boolean> {
  const ethereum = typeof window !== 'undefined' ? (window as any).ethereum : null;
  if (!ethereum) return false;

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BSC_CHAIN_ID }],
    });
    return true;
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      try {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [BSC_PARAMS],
        });
        return true;
      } catch (addError) {
        console.error("Failed to add BSC network to MetaMask:", addError);
        return false;
      }
    }
    console.error("Failed to switch network to BSC:", switchError);
    return false;
  }
}

export async function sendBNBTransaction(
  signer: ethers.Signer | null,
  amountUSD: number,
  bnbPrice: number
): Promise<{ txHash: string; bnbAmountStr: string; bnbAmountWei: bigint }> {
  if (!signer) {
    throw new Error(
      "No active Web3 signer. Please connect your MetaMask or Web3 wallet on Binance Smart Chain to confirm and sign this transaction."
    );
  }

  const effectivePrice = bnbPrice > 0 ? bnbPrice : 750;
  const bnbAmount = amountUSD / effectivePrice;
  // Calculate precise BNB string with 6 decimals
  const bnbAmountStr = bnbAmount.toFixed(6);
  const bnbAmountWei = ethers.parseEther(bnbAmountStr);

  // Validate chain
  if (signer.provider) {
    const network = await signer.provider.getNetwork();
    if (Number(network.chainId) !== 56) {
      const switched = await switchToBSC();
      if (!switched) {
        throw new Error("Your wallet is not connected to Binance Smart Chain Mainnet. Please switch networks in your wallet.");
      }
    }

    // Verify sender has sufficient BNB balance
    const userAddress = await signer.getAddress();
    const balance = await signer.provider.getBalance(userAddress);
    if (balance < bnbAmountWei) {
      const currentBnb = Number(ethers.formatEther(balance)).toFixed(5);
      throw new Error(
        `Insufficient BNB balance in wallet ${userAddress.substring(0, 6)}... Required: ${bnbAmountStr} BNB (~$${amountUSD.toFixed(2)} USD), but you currently have ${currentBnb} BNB.`
      );
    }
  }

  try {
    // Send real transaction directly on Binance Smart Chain to the Treasury Wallet
    const tx = await signer.sendTransaction({
      to: TREASURY_WALLET,
      value: bnbAmountWei,
    });

    // Wait for real on-chain confirmation (1 confirmation)
    const receipt = await tx.wait(1);

    return {
      txHash: receipt?.hash || tx.hash,
      bnbAmountStr,
      bnbAmountWei,
    };
  } catch (err: any) {
    console.error("Real on-chain BNB transaction error:", err);
    if (err?.code === 4001 || err?.action === 'reject' || err?.message?.includes("User rejected") || err?.message?.includes("user rejected")) {
      throw new Error("Transaction rejected in your wallet.");
    }
    if (err?.code === 'INSUFFICIENT_FUNDS' || err?.message?.includes("insufficient funds")) {
      throw new Error("Insufficient BNB funds for transaction transfer or gas fee.");
    }
    throw new Error(err?.reason || err?.message || "Failed to broadcast transaction to Binance Smart Chain.");
  }
}

// PancakeSwap V2 and USDT Addresses on Binance Smart Chain
export const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
export const WBNB_ADDRESS = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
export const PANCAKE_ROUTER_ADDRESS = "0x10ED43C718714eb63d5aA57B78B54704E256024E";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function decimals() view returns (uint8)"
];

const PANCAKE_ROUTER_ABI = [
  "function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)",
  "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external"
];

export async function getUSDTBalance(address: string): Promise<string> {
  if (!address || !ethers.isAddress(address)) return "0.00";
  try {
    const provider = getPublicBscProvider();
    const contract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, provider);
    const balance = await contract.balanceOf(address);
    return Number(ethers.formatUnits(balance, 18)).toFixed(2);
  } catch (e) {
    console.warn("Could not query USDT balance:", e);
    return "0.00";
  }
}

export async function getSwapQuote(usdtAmountStr: string, bnbPrice: number): Promise<{ bnbAmount: string; rate: string }> {
  try {
    const provider = getPublicBscProvider();
    const router = new ethers.Contract(PANCAKE_ROUTER_ADDRESS, PANCAKE_ROUTER_ABI, provider);
    const amountIn = ethers.parseUnits(usdtAmountStr, 18);
    const path = [USDT_ADDRESS, WBNB_ADDRESS];
    const amounts = await router.getAmountsOut(amountIn, path);
    const bnbOut = ethers.formatEther(amounts[1]);
    const rate = (Number(usdtAmountStr) / Number(bnbOut)).toFixed(2);
    return {
      bnbAmount: Number(bnbOut).toFixed(6),
      rate
    };
  } catch (err) {
    console.warn("Could not fetch swap quote from PancakeSwap, falling back to oracle rate:", err);
    const bnbOut = Number(usdtAmountStr) / (bnbPrice || 600);
    return {
      bnbAmount: bnbOut.toFixed(6),
      rate: (bnbPrice || 600).toFixed(2)
    };
  }
}

export async function executeUSDTtoBNBSwap(
  signer: ethers.Signer,
  usdtAmountStr: string,
  minBnbOutStr: string
): Promise<string> {
  const userAddress = await signer.getAddress();
  const provider = signer.provider;
  if (!provider) throw new Error("No provider found on signer");

  const usdtContract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, signer);
  const routerContract = new ethers.Contract(PANCAKE_ROUTER_ADDRESS, PANCAKE_ROUTER_ABI, signer);

  const amountIn = ethers.parseUnits(usdtAmountStr, 18);
  const minAmountOut = ethers.parseUnits(minBnbOutStr, 18);

  // Check USDT balance
  const balance: bigint = await usdtContract.balanceOf(userAddress);
  if (balance < amountIn) {
    throw new Error(`Insufficient USDT balance. You have ${ethers.formatUnits(balance, 18)} USDT but need ${usdtAmountStr} USDT.`);
  }

  // Check Allowance
  const currentAllowance: bigint = await usdtContract.allowance(userAddress, PANCAKE_ROUTER_ADDRESS);
  if (currentAllowance < amountIn) {
    console.log("Approving USDT for PancakeSwap Router...");
    const approveTx = await usdtContract.approve(PANCAKE_ROUTER_ADDRESS, ethers.MaxUint256);
    await approveTx.wait(1);
    console.log("USDT approved successfully!");
  }

  // Swap
  const path = [USDT_ADDRESS, WBNB_ADDRESS];
  const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 mins deadline

  console.log("Executing SwapExactTokensForETHSupportingFeeOnTransferTokens...");
  const swapTx = await routerContract.swapExactTokensForETHSupportingFeeOnTransferTokens(
    amountIn,
    minAmountOut * 95n / 100n, // 5% slippage tolerance
    path,
    userAddress,
    deadline
  );

  const receipt = await swapTx.wait(1);
  return receipt?.hash || swapTx.hash;
}

