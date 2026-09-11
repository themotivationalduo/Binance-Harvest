export interface WalletDeepLinkInfo {
  id: string;
  name: string;
  shortName: string;
  badge?: string;
  category: 'popular' | 'other';
  color: string;
  iconBg: string;
  iconText: string;
  description: string;
  getDeepLink: (url: string) => string;
  universalLink?: (url: string) => string;
}

export const SUPPORTED_DEEP_LINK_WALLETS: WalletDeepLinkInfo[] = [
  {
    id: 'binance',
    name: 'Binance Web3 Wallet',
    shortName: 'Binance',
    badge: 'BSC Native',
    category: 'popular',
    color: '#F3BA2F',
    iconBg: 'bg-[#F3BA2F]',
    iconText: 'BNB',
    description: 'Official Binance App built-in Web3 DeFi browser',
    getDeepLink: (url: string) => `bnc://app.binance.com/cedafi/dapp?url=${encodeURIComponent(url)}`,
    universalLink: (url: string) => `https://app.binance.com/en/download-app?deeplink=${encodeURIComponent('bnc://app.binance.com/cedafi/dapp?url=' + encodeURIComponent(url))}`,
  },
  {
    id: 'trust',
    name: 'Trust Wallet',
    shortName: 'Trust',
    badge: 'Top BSC',
    category: 'popular',
    color: '#0500FF',
    iconBg: 'bg-[#0500FF]',
    iconText: 'TWT',
    description: 'Direct deep link into Trust Wallet DApp Browser',
    getDeepLink: (url: string) => `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(url)}`,
    universalLink: (url: string) => `trust://open_url?coin_id=60&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'tokenpocket',
    name: 'TokenPocket',
    shortName: 'TokenPocket',
    badge: 'Recommended',
    category: 'popular',
    color: '#2980FE',
    iconBg: 'bg-[#2980FE]',
    iconText: 'TP',
    description: 'Direct launch in TokenPocket Discover DApp browser',
    getDeepLink: (url: string) => `tpdapp://open?params=${encodeURIComponent(JSON.stringify({ url }))}`,
    universalLink: (url: string) => `tpoutside://pull.activity?param=${encodeURIComponent(JSON.stringify({ action: 'dapp', url }))}`,
  },
  {
    id: 'metamask',
    name: 'MetaMask Mobile',
    shortName: 'MetaMask',
    badge: 'Popular',
    category: 'popular',
    color: '#E2761B',
    iconBg: 'bg-[#E2761B]',
    iconText: 'MM',
    description: 'Opens directly in MetaMask in-app browser',
    getDeepLink: (url: string) => {
      const cleanUrl = url.replace(/^https?:\/\//i, '');
      return `https://metamask.app.link/dapp/${cleanUrl}`;
    },
    universalLink: (url: string) => {
      const cleanUrl = url.replace(/^https?:\/\//i, '');
      return `metamask://dapp/${cleanUrl}`;
    },
  },
  {
    id: 'okx',
    name: 'OKX Wallet',
    shortName: 'OKX',
    badge: 'Multi-Chain',
    category: 'popular',
    color: '#000000',
    iconBg: 'bg-black border border-white/20',
    iconText: 'OKX',
    description: 'Opens inside OKX Web3 DApp Browser',
    getDeepLink: (url: string) => `okx://wallet/dapp/details?dappUrl=${encodeURIComponent(url)}`,
    universalLink: (url: string) => `https://www.okx.com/download?deeplink=${encodeURIComponent('okx://wallet/dapp/details?dappUrl=' + encodeURIComponent(url))}`,
  },
  {
    id: 'bitget',
    name: 'Bitget Wallet',
    shortName: 'Bitget',
    badge: 'Web3',
    category: 'popular',
    color: '#00F0FF',
    iconBg: 'bg-cyan-600',
    iconText: 'BG',
    description: 'Formerly BitKeep, launches in Bitget DApp browser',
    getDeepLink: (url: string) => `bitkeep://bkconnect?action=dapp&url=${encodeURIComponent(url)}`,
    universalLink: (url: string) => `https://bkcode.vip?action=dapp&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'safepal',
    name: 'SafePal Wallet',
    shortName: 'SafePal',
    badge: 'Hardware & App',
    category: 'popular',
    color: '#2858EE',
    iconBg: 'bg-[#2858EE]',
    iconText: 'SFP',
    description: 'Opens inside SafePal DApp browser',
    getDeepLink: (url: string) => `safepalwallet://browse?url=${encodeURIComponent(url)}`,
    universalLink: (url: string) => `https://link.safepal.io/browse?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    shortName: 'Coinbase',
    badge: 'Popular',
    category: 'popular',
    color: '#0052FF',
    iconBg: 'bg-[#0052FF]',
    iconText: 'CB',
    description: 'Opens in Coinbase Wallet in-app browser',
    getDeepLink: (url: string) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`,
  },
  {
    id: '1inch',
    name: '1inch DeFi Wallet',
    shortName: '1inch',
    category: 'other',
    color: '#0E1726',
    iconBg: 'bg-slate-800 border border-white/20',
    iconText: '1IN',
    description: '1inch Mobile App in-app browser',
    getDeepLink: (url: string) => `oneinch://open_url?url=${encodeURIComponent(url)}`,
    universalLink: (url: string) => `https://wallet.1inch.io/dapp/${encodeURIComponent(url)}`,
  },
  {
    id: 'phantom',
    name: 'Phantom Wallet',
    shortName: 'Phantom',
    category: 'other',
    color: '#AB9FF2',
    iconBg: 'bg-[#534bb1]',
    iconText: 'PH',
    description: 'Multi-chain Phantom DApp browser',
    getDeepLink: (url: string) => {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://binanceharvest.vercel.app';
      return `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(origin)}`;
    },
  },
  {
    id: 'imtoken',
    name: 'imToken Wallet',
    shortName: 'imToken',
    category: 'other',
    color: '#098de6',
    iconBg: 'bg-[#098de6]',
    iconText: 'IM',
    description: 'imToken DApp Browser navigate',
    getDeepLink: (url: string) => `imtokenv2://navigate/DappView?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'coin98',
    name: 'Coin98 Super Wallet',
    shortName: 'Coin98',
    category: 'other',
    color: '#E5B842',
    iconBg: 'bg-amber-600',
    iconText: 'C98',
    description: 'Coin98 built-in Web3 browser',
    getDeepLink: (url: string) => `coin98://dapp?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'rainbow',
    name: 'Rainbow Wallet',
    shortName: 'Rainbow',
    category: 'other',
    color: '#001A70',
    iconBg: 'bg-gradient-to-r from-red-500 via-green-500 to-blue-500',
    iconText: 'RBW',
    description: 'Rainbow App in-app browser',
    getDeepLink: (url: string) => `rainbow://open_url?url=${encodeURIComponent(url)}`,
    universalLink: (url: string) => `https://rnbwapp.com/dapp?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'zerion',
    name: 'Zerion Wallet',
    shortName: 'Zerion',
    category: 'other',
    color: '#2962FF',
    iconBg: 'bg-[#2962FF]',
    iconText: 'ZER',
    description: 'Zerion smart wallet in-app browser',
    getDeepLink: (url: string) => `zerion://dapp?url=${encodeURIComponent(url)}`,
    universalLink: (url: string) => `https://wallet.zerion.io/dapp?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'mathwallet',
    name: 'MathWallet',
    shortName: 'Math',
    category: 'other',
    color: '#000000',
    iconBg: 'bg-black border border-white/20',
    iconText: 'MW',
    description: 'MathWallet multi-chain DApp engine',
    getDeepLink: (url: string) => `mathwallet://mathwallet.org?action=open_dapp&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'foxwallet',
    name: 'FoxWallet',
    shortName: 'FoxWallet',
    category: 'other',
    color: '#22B573',
    iconBg: 'bg-emerald-600',
    iconText: 'FOX',
    description: 'FoxWallet Web3 DApp browser',
    getDeepLink: (url: string) => `foxwallet://dapp?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'ontowallet',
    name: 'ONTO Wallet',
    shortName: 'ONTO',
    category: 'other',
    color: '#32A4BE',
    iconBg: 'bg-cyan-700',
    iconText: 'ONTO',
    description: 'ONTO decentralized DApp gateway',
    getDeepLink: (url: string) => `ontoprovider://dapp?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'cryptocom',
    name: 'Crypto.com DeFi Wallet',
    shortName: 'Crypto.com',
    category: 'other',
    color: '#1199FA',
    iconBg: 'bg-[#002D74]',
    iconText: 'CDC',
    description: 'Crypto.com DeFi Web3 browser',
    getDeepLink: (url: string) => `dfw://dapp?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'halowallet',
    name: 'Halo Wallet (KuCoin)',
    shortName: 'Halo',
    category: 'other',
    color: '#25A384',
    iconBg: 'bg-teal-700',
    iconText: 'HALO',
    description: 'KuCoin ecosystem Halo Web3 browser',
    getDeepLink: (url: string) => `kucoinwallet://dapp?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'exodus',
    name: 'Exodus Wallet',
    shortName: 'Exodus',
    category: 'other',
    color: '#6542FF',
    iconBg: 'bg-purple-800',
    iconText: 'EXO',
    description: 'Exodus Mobile multi-chain Web3',
    getDeepLink: (url: string) => `exodus://dapp?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'frontier',
    name: 'Frontier Wallet',
    shortName: 'Frontier',
    category: 'other',
    color: '#CC3366',
    iconBg: 'bg-rose-700',
    iconText: 'FRO',
    description: 'Frontier multi-chain DApp access',
    getDeepLink: (url: string) => `frontier://dapp?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'gatewallet',
    name: 'Gate Web3 Wallet',
    shortName: 'Gate',
    category: 'other',
    color: '#1A56DB',
    iconBg: 'bg-blue-800',
    iconText: 'GATE',
    description: 'Gate.io Web3 decentralized browser',
    getDeepLink: (url: string) => `gatewallet://open_dapp?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'corewallet',
    name: 'Core Wallet',
    shortName: 'Core',
    category: 'other',
    color: '#E84142',
    iconBg: 'bg-red-700',
    iconText: 'CORE',
    description: 'Core Web3 in-app browser',
    getDeepLink: (url: string) => `core://dapp?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'rabby',
    name: 'Rabby Wallet',
    shortName: 'Rabby',
    category: 'other',
    color: '#8697FF',
    iconBg: 'bg-indigo-700',
    iconText: 'RAB',
    description: 'Rabby Mobile Web3 browser',
    getDeepLink: (url: string) => `rabby://open_url?url=${encodeURIComponent(url)}`,
  },
];

/**
 * Launch the selected Web3 wallet directly via its URL deep link.
 * Seamlessly opens Telegram users or mobile browser visitors directly inside
 * the wallet's internal Web3 browser where window.ethereum is natively injected.
 */
export function openDAppInWallet(walletId: string, customUrl?: string): void {
  if (typeof window === 'undefined') return;
  const targetUrl = customUrl || window.location.href;
  const wallet = SUPPORTED_DEEP_LINK_WALLETS.find(w => w.id === walletId);
  if (!wallet) return;

  const deepLink = wallet.getDeepLink(targetUrl);
  const universal = wallet.universalLink ? wallet.universalLink(targetUrl) : null;

  // Attempt deep link navigation
  const startTime = Date.now();
  window.location.href = deepLink;

  // If universal link fallback exists, attempt fallback
  if (universal) {
    setTimeout(() => {
      // If user hasn't switched away from the browser, try universal link
      if (Date.now() - startTime < 1800) {
        window.location.href = universal;
      }
    }, 700);
  }
}
