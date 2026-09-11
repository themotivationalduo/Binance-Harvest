import { useState, useEffect } from 'react';

export interface TelegramUser {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
}

export interface RuntimeContextInfo {
  /**
   * Strictly detects Telegram Mini App execution by checking
   * if window.Telegram?.WebApp?.initData exists and is non-empty.
   */
  isTelegram: boolean;
  hasInjectedEthereum: boolean;
  isWeb3Browser: boolean;
  detectedWalletName: string | null;
  telegramUser: TelegramUser | null;
  mode: 'telegram_mini_app' | 'native_dapp_browser';
  rawInitData: string;
}

/**
 * Returns true if running inside Telegram Mini App webview
 * Rule: window.Telegram?.WebApp?.initData exists and is non-empty
 */
export function isTelegramMiniApp(): boolean {
  if (typeof window === 'undefined') return false;
  const initData = (window as any).Telegram?.WebApp?.initData;
  return typeof initData === 'string' && initData.trim().length > 0;
}

/**
 * Returns true if window.ethereum is injected (MetaMask, Trust, OKX, TokenPocket, etc.)
 */
export function hasInjectedEthereum(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).ethereum);
}

/**
 * Get the name of the detected Web3 wallet if available
 */
export function getDetectedWeb3WalletName(): string | null {
  if (typeof window === 'undefined') return null;
  const eth = (window as any).ethereum;
  if (!eth) return null;
  if (eth.isTokenPocket) return 'TokenPocket';
  if (eth.isMetaMask) return 'MetaMask';
  if (eth.isTrust || eth.isTrustWallet) return 'Trust Wallet';
  if (eth.isOkxWallet || eth.isOKExWallet) return 'OKX Wallet';
  if (eth.isBinance || eth.isBscStorage) return 'Binance Web3 Wallet';
  if (eth.isCoinbaseWallet) return 'Coinbase Wallet';
  if (eth.isBitKeep || eth.isBitget) return 'Bitget Wallet';
  return 'Web3 Injected Wallet';
}

/**
 * Get Telegram user information if available
 */
export function getTelegramUserInfo(): TelegramUser | null {
  if (typeof window === 'undefined') return null;
  return (window as any).Telegram?.WebApp?.initDataUnsafe?.user || null;
}

/**
 * Detect full runtime environment information
 */
export function detectRuntimeContext(): RuntimeContextInfo {
  const isTg = isTelegramMiniApp();
  const hasEth = hasInjectedEthereum();
  const walletName = getDetectedWeb3WalletName();
  const tgUser = getTelegramUserInfo();
  const rawInitData = (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData) || '';

  return {
    isTelegram: isTg,
    hasInjectedEthereum: hasEth,
    isWeb3Browser: hasEth,
    detectedWalletName: walletName,
    telegramUser: tgUser,
    mode: isTg ? 'telegram_mini_app' : 'native_dapp_browser',
    rawInitData,
  };
}

/**
 * React hook to reactively track runtime context
 */
export function useRuntimeContext(): RuntimeContextInfo {
  const [context, setContext] = useState<RuntimeContextInfo>(() => detectRuntimeContext());

  useEffect(() => {
    // Re-evaluate on mount (in case Telegram WebApp script finished loading)
    setContext(detectRuntimeContext());

    const handleCheck = () => {
      setContext(detectRuntimeContext());
    };

    window.addEventListener('focus', handleCheck);
    return () => {
      window.removeEventListener('focus', handleCheck);
    };
  }, []);

  return context;
}
