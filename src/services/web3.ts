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
let lastBNBPriceFetchTime = 0;
const BNB_PRICE_CACHE_MS = 25000; // 25s cache to keep UI lightning fast

export async function fetchLiveBNBPrice(): Promise<number> {
  const now = Date.now();
  if (now - lastBNBPriceFetchTime < BNB_PRICE_CACHE_MS && lastKnownBNBPrice > 0) {
    return lastKnownBNBPrice;
  }

  const fetchWithTimeout = async (url: string, ms = 2500): Promise<Response> => {
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
        lastBNBPriceFetchTime = Date.now();
        return price;
      }
    } catch {
      // Continue to next provider silently
    }
  }

  // Gracefully return last known price
  lastBNBPriceFetchTime = Date.now();
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

export function isWeb3Injected(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return Boolean(
    w.ethereum ||
    w.tokenpocket ||
    w.okxwallet ||
    w.trustwallet ||
    w.bitkeep ||
    w.safepalProvider ||
    w.BinanceChain ||
    w.coinbaseWalletExtension ||
    w.phantom?.ethereum
  );
}

export interface DetectedWalletOption {
  id: SupportedWalletType;
  name: string;
  isDetected: boolean;
  iconBg: string;
  iconText: string;
  badge?: string;
}

export function detectWeb3Providers(): {
  hasWeb3: boolean;
  isMetaMask: boolean;
  isTrust: boolean;
  isBinance: boolean;
  isCoinbase: boolean;
  isTokenPocket: boolean;
  isOkx: boolean;
  isBitKeep: boolean;
  isSafePal: boolean;
  isRabby: boolean;
  isRainbow: boolean;
  detectedWalletName: string;
  isInjectedMobile: boolean;
  detectedWalletsList: DetectedWalletOption[];
} {
  if (typeof window === 'undefined') {
    return {
      hasWeb3: false,
      isMetaMask: false,
      isTrust: false,
      isBinance: false,
      isCoinbase: false,
      isTokenPocket: false,
      isOkx: false,
      isBitKeep: false,
      isSafePal: false,
      isRabby: false,
      isRainbow: false,
      detectedWalletName: 'Web3 Wallet',
      isInjectedMobile: false,
      detectedWalletsList: [],
    };
  }
  const w = window as any;
  const eth = w.ethereum;
  const tp = w.tokenpocket;

  const isTokenPocket = Boolean(tp || eth?.isTokenPocket);
  const isTrust = Boolean(w.trustwallet || eth?.isTrust || eth?.isTrustWallet);
  const isOkx = Boolean(w.okxwallet || eth?.isOkxWallet || eth?.isOKExWallet);
  const isBitKeep = Boolean(w.bitkeep || eth?.isBitKeep || eth?.isBitget);
  const isSafePal = Boolean(w.safepalProvider || eth?.isSafePal);
  const isBinance = Boolean(w.BinanceChain || eth?.isBinance || eth?.isBscStorage);
  const isCoinbase = Boolean(w.coinbaseWalletExtension || eth?.isCoinbaseWallet);
  const isRabby = Boolean(eth?.isRabby);
  const isRainbow = Boolean(eth?.isRainbow);
  const isMetaMask = Boolean(eth?.isMetaMask && !isTokenPocket && !isTrust && !isOkx && !isBitKeep && !isSafePal && !isBinance && !isRabby);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  const hasWeb3 = Boolean(eth || tp || w.okxwallet || w.trustwallet || w.BinanceChain || w.bitkeep || w.safepalProvider || w.coinbaseWalletExtension);

  let detectedWalletName = 'Web3 Wallet (EIP-1193)';
  if (isTokenPocket) detectedWalletName = 'TokenPocket';
  else if (isTrust) detectedWalletName = 'Trust Wallet';
  else if (isOkx) detectedWalletName = 'OKX Wallet';
  else if (isBinance) detectedWalletName = 'Binance Web3 Wallet';
  else if (isBitKeep) detectedWalletName = 'Bitget Wallet';
  else if (isSafePal) detectedWalletName = 'SafePal';
  else if (isRabby) detectedWalletName = 'Rabby Wallet';
  else if (isCoinbase) detectedWalletName = 'Coinbase Wallet';
  else if (isRainbow) detectedWalletName = 'Rainbow';
  else if (isMetaMask) detectedWalletName = 'MetaMask';
  else if (hasWeb3) detectedWalletName = 'Injected Web3 Provider';

  const detectedWalletsList: DetectedWalletOption[] = [
    { id: 'injected', name: 'Injected Web3 (Any Provider)', isDetected: hasWeb3, iconBg: 'bg-gradient-to-tr from-amber-500 to-yellow-400', iconText: 'W3', badge: hasWeb3 ? 'ACTIVE' : undefined },
    { id: 'trust', name: 'Trust Wallet', isDetected: isTrust, iconBg: 'bg-blue-600', iconText: 'TW', badge: isTrust ? 'DETECTED' : undefined },
    { id: 'okx', name: 'OKX Wallet', isDetected: isOkx, iconBg: 'bg-black border border-white/20', iconText: 'OKX', badge: isOkx ? 'DETECTED' : undefined },
    { id: 'binance', name: 'Binance Web3 Wallet', isDetected: isBinance, iconBg: 'bg-[#F3BA2F]', iconText: 'BNB', badge: isBinance ? 'DETECTED' : undefined },
    { id: 'tokenpocket', name: 'TokenPocket', isDetected: isTokenPocket, iconBg: 'bg-blue-500', iconText: 'TP', badge: isTokenPocket ? 'DETECTED' : undefined },
    { id: 'metamask', name: 'MetaMask', isDetected: isMetaMask, iconBg: 'bg-orange-500', iconText: '🦊', badge: isMetaMask ? 'DETECTED' : undefined },
    { id: 'bitget', name: 'Bitget Wallet', isDetected: isBitKeep, iconBg: 'bg-teal-500', iconText: 'BG', badge: isBitKeep ? 'DETECTED' : undefined },
    { id: 'safepal', name: 'SafePal', isDetected: isSafePal, iconBg: 'bg-indigo-600', iconText: 'SFP', badge: isSafePal ? 'DETECTED' : undefined },
    { id: 'coinbase', name: 'Coinbase Wallet', isDetected: isCoinbase, iconBg: 'bg-blue-700', iconText: 'CB', badge: isCoinbase ? 'DETECTED' : undefined },
    { id: 'rabby', name: 'Rabby Wallet', isDetected: isRabby, iconBg: 'bg-purple-600', iconText: 'RB', badge: isRabby ? 'DETECTED' : undefined },
  ];

  return {
    hasWeb3,
    isMetaMask,
    isTrust,
    isBinance,
    isCoinbase,
    isTokenPocket,
    isOkx,
    isBitKeep,
    isSafePal,
    isRabby,
    isRainbow,
    detectedWalletName,
    isInjectedMobile: isMobile && hasWeb3,
    detectedWalletsList,
  };
}

/**
 * Directly opens the BinanceHarvest dApp inside the TokenPocket built-in browser.
 * Inside TokenPocket's browser, window.ethereum is natively injected with zero WalletConnect redirect errors.
 */
export function openInTokenPocketApp(url?: string): void {
  if (typeof window === 'undefined') return;
  const targetUrl = url || window.location.href;
  const param = encodeURIComponent(JSON.stringify({ action: 'dapp', url: targetUrl }));
  const directScheme = `tpdapp://open?params=${encodeURIComponent(JSON.stringify({ url: targetUrl }))}`;
  const tpOutsideScheme = `tpoutside://pull.activity?param=${param}`;
  const universalLink = `https://tokenpocket.vip/dapp?url=${encodeURIComponent(targetUrl)}`;

  // Try direct native scheme first, then tpoutside scheme, then universal link
  const now = Date.now();
  window.location.href = tpOutsideScheme;
  setTimeout(() => {
    if (Date.now() - now < 1600) {
      window.location.href = directScheme;
      setTimeout(() => {
        if (Date.now() - now < 2600) {
          window.location.href = universalLink;
        }
      }, 800);
    }
  }, 700);
}

/**
 * Resets and cleans any stale WalletConnect pairings, sessions, or cached tokens in localStorage.
 * Resolves TokenPocket "connection error" caused by expired pairing topics.
 */
export function clearWalletConnectSession(): void {
  if (typeof window === 'undefined') return;
  try {
    if (activeWcProvider) {
      try {
        if (typeof activeWcProvider.disconnect === 'function') {
          activeWcProvider.disconnect();
        }
      } catch (e) {
        console.warn("Could not disconnect active WalletConnect session cleanly:", e);
      }
      activeWcProvider = null;
    }
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith('wc@2:') ||
          key.startsWith('WALLETCONNECT_') ||
          key === 'walletconnect' ||
          key === 'binance_harvest_wallet_type' ||
          key === 'binance_harvest_active_wallet')
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    console.log("WalletConnect pairing cache cleared successfully:", keysToRemove.length, "keys removed");
  } catch (err) {
    console.warn("Error cleaning WalletConnect cache:", err);
  }
}

export async function signWeb3AuthMessage(signer: ethers.Signer, address: string): Promise<string> {
  const timestamp = new Date().toISOString();
  const challenge = `Welcome to BinanceHarvest Cloud Mining!\n\nSign this cryptographic challenge to authenticate your on-chain miner identity on Binance Smart Chain.\n\nMiner Address: ${address}\nChain ID: 56 (BSC Mainnet)\nTimestamp: ${timestamp}`;
  return await signer.signMessage(challenge);
}

import { EthereumProvider } from '@walletconnect/ethereum-provider';

export type SupportedWalletType = 
  | 'injected' 
  | 'walletconnect' 
  | 'metamask' 
  | 'tokenpocket' 
  | 'trust' 
  | 'okx' 
  | 'binance' 
  | 'bitget' 
  | 'safepal' 
  | 'coinbase' 
  | 'rabby';

// Active Web3 state across the application
let activeBrowserProvider: ethers.BrowserProvider | null = null;
let activeSigner: ethers.Signer | null = null;
let activeWcProvider: any = null;
let activeWalletType: SupportedWalletType | null = null;

export function getActiveSigner(): ethers.Signer | null {
  return activeSigner;
}

/**
 * Universally retrieves the active or requested injected Web3 provider across all wallets
 * (Trust Wallet, OKX Wallet, Binance Web3, MetaMask, TokenPocket, Bitget, SafePal, Coinbase, Rabby, etc.)
 */
export function getInjectedRawProvider(preferredType?: SupportedWalletType): any {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  const eth = w.ethereum;

  // 1. If a specific provider was requested
  if (preferredType === 'tokenpocket') {
    if (w.tokenpocket) return w.tokenpocket;
    if (eth?.isTokenPocket) return eth;
  } else if (preferredType === 'trust') {
    if (w.trustwallet) return w.trustwallet;
    if (eth?.isTrust || eth?.isTrustWallet) return eth;
  } else if (preferredType === 'okx') {
    if (w.okxwallet) return w.okxwallet;
    if (eth?.isOkxWallet || eth?.isOKExWallet) return eth;
  } else if (preferredType === 'binance') {
    if (w.BinanceChain) return w.BinanceChain;
    if (eth?.isBinance || eth?.isBscStorage) return eth;
  } else if (preferredType === 'bitget') {
    if (w.bitkeep?.ethereum) return w.bitkeep.ethereum;
    if (eth?.isBitKeep || eth?.isBitget) return eth;
  } else if (preferredType === 'safepal') {
    if (w.safepalProvider) return w.safepalProvider;
    if (eth?.isSafePal) return eth;
  } else if (preferredType === 'coinbase') {
    if (w.coinbaseWalletExtension) return w.coinbaseWalletExtension;
    if (eth?.isCoinbaseWallet) return eth;
  } else if (preferredType === 'rabby') {
    if (eth?.isRabby) return eth;
  } else if (preferredType === 'metamask') {
    if (eth?.isMetaMask && !eth?.isTokenPocket && !eth?.isTrust && !eth?.isOkxWallet && !eth?.isBitKeep && !eth?.isBinance && !eth?.isSafePal) {
      return eth;
    }
  }

  // 2. Check multi-provider array (EIP-6963 / window.ethereum.providers)
  if (eth?.providers && Array.isArray(eth.providers) && eth.providers.length > 0) {
    if (preferredType === 'trust') {
      const match = eth.providers.find((p: any) => p.isTrust || p.isTrustWallet);
      if (match) return match;
    } else if (preferredType === 'okx') {
      const match = eth.providers.find((p: any) => p.isOkxWallet || p.isOKExWallet);
      if (match) return match;
    } else if (preferredType === 'metamask') {
      const match = eth.providers.find((p: any) => p.isMetaMask && !p.isTrust && !p.isOkxWallet && !p.isTokenPocket);
      if (match) return match;
    }
    return eth.providers[0];
  }

  // 3. Fallback to any standalone or universal injected provider
  return (
    w.tokenpocket ||
    w.trustwallet ||
    w.okxwallet ||
    w.bitkeep?.ethereum ||
    w.safepalProvider ||
    w.BinanceChain ||
    w.coinbaseWalletExtension ||
    w.phantom?.ethereum ||
    eth ||
    null
  );
}

export function getActiveBrowserProvider(): ethers.BrowserProvider | null {
  if (activeBrowserProvider) return activeBrowserProvider;
  const rawEth = getInjectedRawProvider(activeWalletType || undefined);
  if (rawEth) {
    try {
      activeBrowserProvider = new ethers.BrowserProvider(rawEth);
      return activeBrowserProvider;
    } catch {
      return null;
    }
  }
  return null;
}

export async function getOrInitSigner(): Promise<ethers.Signer | null> {
  if (activeSigner) return activeSigner;
  const provider = getActiveBrowserProvider();
  if (provider) {
    try {
      activeSigner = await provider.getSigner();
      return activeSigner;
    } catch {
      return null;
    }
  }
  return null;
}

export async function connectWallet(
  walletType: SupportedWalletType = 'injected',
  options?: { clearCacheFirst?: boolean }
): Promise<{
  address: string;
  provider: ethers.BrowserProvider;
  signer: ethers.Signer;
  walletType: SupportedWalletType;
}> {
  try {
    let rawProvider: any;

    if (options?.clearCacheFirst) {
      clearWalletConnectSession();
    }

    if (walletType === 'tokenpocket') {
      const tp = getInjectedRawProvider('tokenpocket');
      const isTpInjected = Boolean(tp?.isTokenPocket || (window as any)?.tokenpocket);

      if (isTpInjected && tp) {
        rawProvider = tp;
        await rawProvider.request({ method: "eth_requestAccounts" });
      } else {
        const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
        if (isMobile) {
          openInTokenPocketApp();
          throw new Error("TOKENPOCKET_REDIRECTING: Launching TokenPocket app. Please continue in TokenPocket.");
        } else {
          return await connectWallet('walletconnect');
        }
      }
    } else if (walletType === 'walletconnect') {
      // Reown / WalletConnect AppKit Project ID
      const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '3a8170812b534d0ff9d794f19a901d64';
      
      const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://binanceharvest.vercel.app';
      const iconUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/bhft-logo.svg`
        : 'https://binanceharvest.vercel.app/bhft-logo.svg';

      // High-availability RPC endpoints for Binance Smart Chain
      const rpcMap: Record<number, string> = {
        56: 'https://binance.llamarpc.com',
        1: 'https://eth.llamarpc.com',
      };

      const wcProvider = await EthereumProvider.init({
        projectId,
        chains: [56],
        optionalChains: [56, 1],
        methods: [
          'eth_sendTransaction',
          'personal_sign',
          'eth_accounts',
          'eth_requestAccounts',
        ],
        optionalMethods: [
          'eth_signTransaction',
          'eth_sign',
          'eth_signTypedData',
          'eth_signTypedData_v3',
          'eth_signTypedData_v4',
          'wallet_switchEthereumChain',
          'wallet_addEthereumChain',
          'wallet_watchAsset',
        ],
        events: ['chainChanged', 'accountsChanged'],
        optionalEvents: ['chainChanged', 'accountsChanged', 'message', 'disconnect', 'connect'],
        rpcMap,
        showQrModal: true,
        qrModalOptions: {
          themeMode: 'dark',
          themeVariables: {
            '--wcm-accent-color': '#F3BA2F',
            '--wcm-background-color': '#0B0E11',
            '--wcm-z-index': '999999',
          },
        },
        metadata: {
          name: 'BinanceHarvest',
          description: 'Decentralized Cloud Mining Protocol on Binance Smart Chain',
          url: appUrl,
          icons: [iconUrl]
        }
      });

      try {
        await wcProvider.connect();
      } catch (connErr: any) {
        if (
          connErr?.message?.includes('Connection request reset') ||
          connErr?.message?.includes('User closed modal') ||
          connErr?.message?.includes('Modal closed') ||
          connErr?.message?.includes('USER_CANCELLED')
        ) {
          throw new Error("USER_CANCELLED: WalletConnect modal closed.");
        }
        if (
          connErr?.message?.includes('No matching key') ||
          connErr?.message?.includes('Pairing') ||
          connErr?.message?.includes('Chain not supported')
        ) {
          clearWalletConnectSession();
          throw new Error("Connection pairing error: Please ensure your active wallet is set to Binance Smart Chain (BSC).");
        }
        throw connErr;
      }

      rawProvider = wcProvider;
      activeWcProvider = wcProvider;
    } else {
      // General Injected Provider handling for ANY wallet (Trust, OKX, Binance, MetaMask, Bitget, SafePal, etc.)
      const injected = getInjectedRawProvider(walletType);
      if (!injected) {
        throw new Error(
          "WEB3_WALLET_NOT_FOUND: No Web3 wallet extension or provider detected in this browser. Please use WalletConnect or open directly in your Web3 wallet's built-in DApp browser."
        );
      }
      rawProvider = injected;
      await rawProvider.request({ method: "eth_requestAccounts" });
    }

    const provider = new ethers.BrowserProvider(rawProvider);
    
    // Verify BSC network (Chain 56)
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== 56) {
      if (walletType === 'walletconnect') {
        try {
          await rawProvider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BSC_CHAIN_ID }],
          });
        } catch {
          console.warn("Could not auto-switch BSC chain in WalletConnect provider");
        }
      } else {
        const switched = await switchToBSC();
        if (!switched) {
          throw new Error("Please switch your wallet network to Binance Smart Chain Mainnet (Chain ID 56).");
        }
      }
    }

    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    
    // Cache active session
    activeBrowserProvider = provider;
    activeSigner = signer;
    activeWalletType = walletType;
    localStorage.setItem('binance_harvest_wallet_type', walletType);

    // Listen for disconnect events on WalletConnect provider
    if (walletType === 'walletconnect') {
      rawProvider.on('disconnect', () => {
        console.log('WalletConnect session disconnected');
        activeBrowserProvider = null;
        activeSigner = null;
        activeWcProvider = null;
        activeWalletType = null;
        clearWalletConnectSession();
        window.location.reload();
      });
    }
    
    return { address, provider, signer, walletType };
  } catch (error: any) {
    console.error("Real wallet connection error:", error);
    if (error?.code === 4001 || error?.message?.includes("User rejected")) {
      throw new Error("Connection request was rejected in your wallet.");
    }
    throw error;
  }
}

export async function disconnectWallet(): Promise<void> {
  if (activeWcProvider && activeWcProvider.connected) {
    try {
      await activeWcProvider.disconnect();
    } catch (e) {
      console.warn("Error disconnecting WalletConnect:", e);
    }
  }
  activeBrowserProvider = null;
  activeSigner = null;
  activeWcProvider = null;
  activeWalletType = null;
  localStorage.removeItem('binance_harvest_active_wallet');
  localStorage.removeItem('binance_harvest_wallet_type');
  localStorage.removeItem('walletconnect');
  localStorage.removeItem('wc@2:ethereum_provider:chainId');
}

export async function reconnectExistingWallet(): Promise<{
  address: string;
  provider: ethers.BrowserProvider;
  signer: ethers.Signer;
} | null> {
  const savedType = localStorage.getItem('binance_harvest_wallet_type');
  const savedAddress = localStorage.getItem('binance_harvest_active_wallet');
  if (!savedAddress) return null;

  if (savedType === 'walletconnect') {
    try {
      const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '3a8170812b534d0ff9d794f19a901d64';
      const wcProvider = await EthereumProvider.init({
        projectId,
        chains: [56],
        optionalChains: [56, 1],
        rpcMap: {
          56: 'https://binance.llamarpc.com',
          1: 'https://eth.llamarpc.com',
        },
        showQrModal: false,
        metadata: {
          name: 'BinanceHarvest',
          description: 'Decentralized Cloud Mining Protocol on Binance Smart Chain',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://binanceharvest.vercel.app',
          icons: [
            typeof window !== 'undefined'
              ? `${window.location.origin}/bhft-logo.svg`
              : 'https://binanceharvest.vercel.app/bhft-logo.svg'
          ]
        }
      });
      if (wcProvider.connected && wcProvider.accounts.length > 0) {
        activeWcProvider = wcProvider;
        const provider = new ethers.BrowserProvider(wcProvider);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        activeBrowserProvider = provider;
        activeSigner = signer;
        activeWalletType = 'walletconnect';
        return { address, provider, signer };
      }
    } catch (e) {
      console.warn("Could not auto-restore WalletConnect session:", e);
    }
  } else if (typeof window !== 'undefined') {
    const rawEth = getInjectedRawProvider(savedType as SupportedWalletType || undefined);
    if (rawEth) {
      try {
        const provider = new ethers.BrowserProvider(rawEth);
        const accounts = await provider.send("eth_accounts", []);
        if (accounts && accounts.length > 0) {
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          activeBrowserProvider = provider;
          activeSigner = signer;
          activeWalletType = (savedType as SupportedWalletType) || 'injected';
          return { address, provider, signer };
        }
      } catch (e) {
        console.warn("Could not auto-restore injected wallet:", e);
      }
    }
  }
  return null;
}

export async function switchToBSC(): Promise<boolean> {
  if (activeWcProvider) {
    try {
      await activeWcProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BSC_CHAIN_ID }],
      });
      return true;
    } catch {
      return false;
    }
  }
  const rawProvider = getInjectedRawProvider(activeWalletType || undefined);
  if (!rawProvider) return false;

  try {
    await rawProvider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BSC_CHAIN_ID }],
    });
    return true;
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      try {
        await rawProvider.request({
          method: 'wallet_addEthereumChain',
          params: [BSC_PARAMS],
        });
        return true;
      } catch (addError) {
        console.error("Failed to add BSC network to Web3 wallet:", addError);
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
      "No active Web3 signer. Please connect your Web3 wallet on Binance Smart Chain to confirm and sign this transaction."
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

// BinanceHarvest Token (BHFT) Official BEP-20 Contract Details on Binance Smart Chain Mainnet
export const BHFT_TOKEN_ADDRESS = "0xe8777A33AC44C1c333fA6fda769c1998E9e24E25";
export const BHFT_TOKEN_NAME = "BinanceHarvest";
export const BHFT_TOKEN_SYMBOL = "BHFT";
export const BHFT_TOKEN_DECIMALS = 18;
export const BHFT_TOTAL_SUPPLY = "10,000";

export async function addBHFTToWallet(): Promise<boolean> {
  const rawProvider = getInjectedRawProvider(activeWalletType || undefined);
  if (!rawProvider) {
    throw new Error("No Web3 wallet detected. Please connect your Web3 wallet or open in your Web3 browser.");
  }
  try {
    const wasAdded = await rawProvider.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC20',
        options: {
          address: BHFT_TOKEN_ADDRESS,
          symbol: BHFT_TOKEN_SYMBOL,
          decimals: BHFT_TOKEN_DECIMALS,
          image: window.location.origin + '/bhft-logo.svg',
        },
      },
    });
    return Boolean(wasAdded);
  } catch (error: any) {
    console.error("Failed to add BHFT token to wallet:", error);
    throw error;
  }
}

export async function getBHFTBalance(address: string): Promise<string> {
  if (!address || !ethers.isAddress(address)) return "0.00";
  try {
    const provider = getPublicBscProvider();
    const contract = new ethers.Contract(BHFT_TOKEN_ADDRESS, ERC20_ABI, provider);
    const balance = await contract.balanceOf(address);
    return Number(ethers.formatUnits(balance, 18)).toFixed(2);
  } catch (e) {
    console.warn("Could not query BHFT balance:", e);
    return "0.00";
  }
}

export async function sendBHFTTransaction(
  signer: ethers.Signer | null,
  amountUSD: number,
  bnbPrice: number
): Promise<{ txHash: string; tokenAmountStr: string; tokenAmountWei: bigint }> {
  if (!signer) {
    throw new Error(
      "No active Web3 signer. Please connect your Web3 wallet on Binance Smart Chain to confirm and sign this transaction."
    );
  }

  // Peg: 1 BHFT = $0.50 USD. So $20.00 USD is exactly 40 BHFT
  const tokenAmount = amountUSD / 0.50;
  const tokenAmountStr = tokenAmount.toFixed(4);
  const tokenAmountWei = ethers.parseUnits(tokenAmountStr, 18);

  // Validate chain
  if (signer.provider) {
    const network = await signer.provider.getNetwork();
    if (Number(network.chainId) !== 56) {
      const switched = await switchToBSC();
      if (!switched) {
        throw new Error("Your wallet is not connected to Binance Smart Chain Mainnet. Please switch networks in your wallet.");
      }
    }

    const userAddress = await signer.getAddress();
    const bhftContract = new ethers.Contract(BHFT_TOKEN_ADDRESS, ERC20_ABI, signer.provider);
    const balance: bigint = await bhftContract.balanceOf(userAddress).catch(() => 0n);
    if (balance < tokenAmountWei) {
      const currentBhft = Number(ethers.formatUnits(balance, 18)).toFixed(2);
      throw new Error(
        `Insufficient BHFT balance in wallet ${userAddress.substring(0, 6)}... Required: ${tokenAmountStr} BHFT (~$${amountUSD.toFixed(2)} USD), but you currently have ${currentBhft} BHFT.`
      );
    }
  }

  try {
    const userAddress = await signer.getAddress();
    const bhftContract = new ethers.Contract(BHFT_TOKEN_ADDRESS, ERC20_ABI, signer);
    
    console.log(`Initiating BEP-20 token transfer of ${tokenAmountStr} BHFT to Treasury...`);
    // Send BEP-20 token transfer transaction directly on Binance Smart Chain
    const tx = await bhftContract.transfer(TREASURY_WALLET, tokenAmountWei);
    
    // Wait for real on-chain confirmation (1 confirmation)
    const receipt = await tx.wait(1);

    return {
      txHash: receipt?.hash || tx.hash,
      tokenAmountStr,
      tokenAmountWei,
    };
  } catch (err: any) {
    console.error("Real on-chain BHFT token transfer error:", err);
    if (err?.code === 4001 || err?.action === 'reject' || err?.message?.includes("User rejected") || err?.message?.includes("user rejected")) {
      throw new Error("Transaction rejected in your wallet.");
    }
    if (err?.code === 'INSUFFICIENT_FUNDS' || err?.message?.includes("insufficient funds")) {
      throw new Error("Insufficient BHFT or BNB gas funds for this token transfer transaction.");
    }
    throw new Error(err?.reason || err?.message || "Failed to execute BEP-20 transfer on Binance Smart Chain.");
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
  "function transfer(address to, uint256 value) returns (bool)",
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
  if (!provider) throw new Error("No provider found on signer. Please connect your Web3 wallet.");

  // 1. Validate Network (Binance Smart Chain Mainnet: Chain ID 56)
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== 56) {
    const switched = await switchToBSC();
    if (!switched) {
      throw new Error("NETWORK_MISMATCH: Your wallet is connected to the wrong network. Please switch your Web3 wallet to Binance Smart Chain Mainnet (Chain ID 56).");
    }
  }

  // 2. Validate Gas Reserve (Need small BNB for approval + swap)
  const bnbGasBalance = await provider.getBalance(userAddress).catch(() => 0n);
  if (bnbGasBalance < ethers.parseEther("0.0008")) {
    throw new Error("INSUFFICIENT_BNB_GAS: Your wallet does not have enough BNB to pay for the Binance Smart Chain network gas fee. Swapping requires approx. 0.002 BNB (~$1.20 USD).");
  }

  const usdtContract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, signer);
  const routerContract = new ethers.Contract(PANCAKE_ROUTER_ADDRESS, PANCAKE_ROUTER_ABI, signer);

  const amountIn = ethers.parseUnits(usdtAmountStr, 18);
  const minAmountOut = ethers.parseUnits(minBnbOutStr, 18);

  // 3. Check USDT balance safely
  let balance: bigint = 0n;
  try {
    balance = await usdtContract.balanceOf(userAddress);
  } catch (err: any) {
    // Fallback query via public BSC provider in case injected provider threw network exception
    try {
      const publicBsc = getPublicBscProvider();
      const publicUsdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, publicBsc);
      balance = await publicUsdt.balanceOf(userAddress);
    } catch {
      throw new Error("NETWORK_MISMATCH: Could not read BEP-20 USDT contract. Please make sure your wallet is on Binance Smart Chain Mainnet (Chain ID 56).");
    }
  }

  if (balance < amountIn) {
    const formatted = ethers.formatUnits(balance, 18);
    throw new Error(`Insufficient USDT balance: You entered ${usdtAmountStr} USDT, but your wallet holds ${Number(formatted).toFixed(2)} BEP-20 USDT on Binance Smart Chain.`);
  }

  // 4. Check Allowance for PancakeSwap Router
  try {
    const currentAllowance: bigint = await usdtContract.allowance(userAddress, PANCAKE_ROUTER_ADDRESS);
    if (currentAllowance < amountIn) {
      console.log("Approving USDT for PancakeSwap Router...");
      const approveTx = await usdtContract.approve(PANCAKE_ROUTER_ADDRESS, ethers.MaxUint256);
      await approveTx.wait(1);
      console.log("USDT approved successfully for PancakeSwap!");
    }
  } catch (err: any) {
    if (err?.code === 4001 || err?.message?.includes("User rejected") || err?.message?.includes("user rejected")) {
      throw new Error("Approval rejected: You declined the USDT approval in your wallet.");
    }
    throw err;
  }

  // 5. Execute Swap
  const path = [USDT_ADDRESS, WBNB_ADDRESS];
  const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 mins deadline

  try {
    console.log("Executing SwapExactTokensForETHSupportingFeeOnTransferTokens on PancakeSwap...");
    const swapTx = await routerContract.swapExactTokensForETHSupportingFeeOnTransferTokens(
      amountIn,
      minAmountOut * 95n / 100n, // 5% slippage tolerance
      path,
      userAddress,
      deadline
    );

    const receipt = await swapTx.wait(1);
    return receipt?.hash || swapTx.hash;
  } catch (err: any) {
    console.error("PancakeSwap execution error:", err);
    if (err?.code === 4001 || err?.message?.includes("User rejected") || err?.message?.includes("user rejected")) {
      throw new Error("Swap cancelled: You rejected the swap transaction in your wallet.");
    }
    throw err;
  }
}

export async function sendNativeBNB(
  signer: ethers.Signer,
  recipientAddress: string,
  amountBNB: string
): Promise<string> {
  if (!ethers.isAddress(recipientAddress)) {
    throw new Error("Invalid recipient address format. Must be a valid 0x Binance Smart Chain address.");
  }

  if (signer.provider) {
    const network = await signer.provider.getNetwork();
    if (Number(network.chainId) !== 56) {
      const switched = await switchToBSC();
      if (!switched) {
        throw new Error("NETWORK_MISMATCH: Please switch your wallet to Binance Smart Chain Mainnet (Chain ID 56).");
      }
    }

    const userAddress = await signer.getAddress();
    const balance = await signer.provider.getBalance(userAddress);
    const amountWei = ethers.parseEther(amountBNB);
    if (balance < amountWei) {
      throw new Error(`Insufficient BNB balance: You tried to send ${amountBNB} BNB, but your wallet only holds ${Number(ethers.formatEther(balance)).toFixed(4)} BNB.`);
    }
  }

  const amountWei = ethers.parseEther(amountBNB);
  const tx = await signer.sendTransaction({
    to: recipientAddress,
    value: amountWei,
  });
  const receipt = await tx.wait(1);
  return receipt?.hash || tx.hash;
}

export async function transferBEP20Token(
  signer: ethers.Signer,
  tokenAddress: string,
  recipientAddress: string,
  amountFormatted: string
): Promise<string> {
  if (!ethers.isAddress(recipientAddress)) {
    throw new Error("Invalid recipient address format. Must be a valid 0x Binance Smart Chain address.");
  }

  if (signer.provider) {
    const network = await signer.provider.getNetwork();
    if (Number(network.chainId) !== 56) {
      const switched = await switchToBSC();
      if (!switched) {
        throw new Error("NETWORK_MISMATCH: Please switch your wallet to Binance Smart Chain Mainnet (Chain ID 56).");
      }
    }
  }

  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const amountWei = ethers.parseUnits(amountFormatted, 18);
  const tx = await contract.transfer(recipientAddress, amountWei);
  const receipt = await tx.wait(1);
  return receipt?.hash || tx.hash;
}

