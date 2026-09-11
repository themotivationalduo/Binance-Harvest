import { TonConnectUI } from '@tonconnect/ui';
import { isTelegramMiniApp, getTelegramUserInfo } from './runtimeContext';

let tonConnectUIInstance: TonConnectUI | null = null;

export function getTonConnectUI(): TonConnectUI {
  if (!tonConnectUIInstance && typeof window !== 'undefined') {
    const origin = window.location.origin;
    tonConnectUIInstance = new TonConnectUI({
      manifestUrl: `${origin}/tonconnect-manifest.json`,
      buttonRootId: undefined,
    });
  }
  return tonConnectUIInstance!;
}

export function isTelegramWebApp(): boolean {
  return isTelegramMiniApp();
}

export function getTelegramUser(): { id?: number; username?: string; first_name?: string } | null {
  return getTelegramUserInfo();
}

export function isValidTonAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  // Standard user-friendly TON address format (48 chars base64url starting with EQ, UQ, kQ, or raw 0:)
  if (/^(EQ|UQ|kQ)[a-zA-Z0-9_-]{46}$/.test(trimmed)) return true;
  if (/^0:[a-fA-F0-9]{64}$/.test(trimmed)) return true;
  return false;
}

export function getConnectedTonAddress(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('binance_harvest_ton_wallet');
}

export function setConnectedTonAddress(address: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('binance_harvest_ton_wallet', address);
  localStorage.setItem('binance_harvest_wallet_type', 'TON');
}

export function clearTonWalletSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('binance_harvest_ton_wallet');
  if (localStorage.getItem('binance_harvest_wallet_type') === 'TON') {
    localStorage.removeItem('binance_harvest_wallet_type');
  }
  if (tonConnectUIInstance) {
    try {
      tonConnectUIInstance.disconnect();
    } catch {
      // ignore
    }
  }
}
