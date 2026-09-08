import { ethers } from 'ethers';

export interface ParsedWeb3Error {
  title: string;
  message: string;
  requirements: string[];
  suggestedAction?: 'switch_network' | 'deposit_bnb' | 'deposit_usdt' | 'retry' | 'none';
  actionLabel?: string;
  rawDetails?: string;
}

/**
 * Translates complex, obscure crypto / ethers.js / RPC errors into clear,
 * understandable explanations with explicit checklists of what the user needs to provide.
 */
export function parseWeb3Error(err: any): ParsedWeb3Error {
  const rawMsg = (err?.reason || err?.message || (typeof err === 'string' ? err : JSON.stringify(err)) || '').trim();
  const code = err?.code;

  const isCallException = code === 'CALL_EXCEPTION' || 
    rawMsg.includes('missing revert data') || 
    rawMsg.includes('CALL_EXCEPTION') ||
    rawMsg.includes('data=null');

  const isNetworkMismatch = isCallException || 
    rawMsg.includes('NETWORK_MISMATCH') || 
    rawMsg.includes('WRONG_NETWORK') || 
    rawMsg.includes('wrong blockchain') || 
    rawMsg.includes('switch networks') ||
    rawMsg.includes('switch your wallet');

  const isRejected = code === 4001 || 
    code === 'ACTION_REJECTED' || 
    rawMsg.toLowerCase().includes('user rejected') || 
    rawMsg.toLowerCase().includes('user denied') ||
    rawMsg.toLowerCase().includes('rejected transaction');

  const isInsufficientBnbGas = rawMsg.includes('INSUFFICIENT_BNB_GAS') || 
    rawMsg.includes('insufficient funds for intrinsic transaction cost') || 
    rawMsg.includes('gas required exceeds allowance') ||
    (code === 'INSUFFICIENT_FUNDS' && !rawMsg.toLowerCase().includes('usdt') && !rawMsg.toLowerCase().includes('bhft'));

  const isInsufficientUsdt = rawMsg.includes('Insufficient USDT balance') || 
    rawMsg.includes('transfer amount exceeds balance') || 
    (rawMsg.toLowerCase().includes('usdt') && rawMsg.toLowerCase().includes('insufficient'));

  const isInsufficientBhft = rawMsg.toLowerCase().includes('bhft') && rawMsg.toLowerCase().includes('insufficient');

  const isSlippage = rawMsg.includes('INSUFFICIENT_OUTPUT_AMOUNT') || 
    rawMsg.includes('EXPIRED') || 
    rawMsg.includes('TRANSFER_FAILED') ||
    rawMsg.includes('PancakeRouter');

  if (isNetworkMismatch) {
    return {
      title: "Wrong Blockchain Network (Switch to BSC)",
      message: "Your Web3 wallet is currently connected to the wrong network (such as Ethereum or a testnet). The BEP-20 USDT token and PancakeSwap router only operate on Binance Smart Chain.",
      requirements: [
        "Network: Switch your wallet to Binance Smart Chain Mainnet (Chain ID 56 / 0x38).",
        "Gas Currency: You will need BNB (not ETH) for transaction gas fees on this network.",
        "Token Asset: USDT must be in the BEP-20 format on BSC (Contract: 0x55d3...7955).",
      ],
      suggestedAction: 'switch_network',
      actionLabel: '⚡ Switch to BSC Mainnet (Chain 56)',
      rawDetails: rawMsg.length > 100 ? rawMsg.substring(0, 100) + '...' : rawMsg
    };
  }

  if (isRejected) {
    return {
      title: "Transaction Request Cancelled",
      message: "You cancelled or closed the approval request in your MetaMask / Web3 wallet.",
      requirements: [
        "No tokens or BNB gas were deducted from your wallet.",
        "To complete this operation, click the action button again and approve the prompt in your wallet.",
      ],
      suggestedAction: 'retry',
      actionLabel: 'Try Again',
    };
  }

  if (isInsufficientBnbGas) {
    return {
      title: "Insufficient BNB for Gas Fee",
      message: "Your wallet does not have enough BNB to cover the Binance Smart Chain gas fee for this transaction.",
      requirements: [
        "Network Gas: Every BSC interaction requires a fraction of BNB (typically 0.001 - 0.003 BNB, approx. $0.60 – $1.80 USD).",
        "Deposit: Transfer or withdraw a small amount of BNB (BEP-20) to your wallet address to proceed.",
      ],
      suggestedAction: 'deposit_bnb',
      actionLabel: 'Need ~0.002 BNB for Gas',
      rawDetails: rawMsg.length > 100 ? rawMsg.substring(0, 100) + '...' : rawMsg
    };
  }

  if (isInsufficientUsdt) {
    return {
      title: "Insufficient BEP-20 USDT Balance",
      message: "Your wallet does not have enough BEP-20 USDT to complete the requested swap amount.",
      requirements: [
        "Check Balance: Ensure you have sufficient USDT on Binance Smart Chain in this wallet.",
        "Network Check: If you have USDT on Ethereum (ERC-20) or Tron (TRC-20), deposit it via BEP-20 to this address.",
        "Gas Reserve: Keep at least 0.002 BNB in your wallet for the swap transaction fee.",
      ],
      suggestedAction: 'deposit_usdt',
      actionLabel: 'Deposit USDT (BEP-20)',
      rawDetails: rawMsg.length > 100 ? rawMsg.substring(0, 100) + '...' : rawMsg
    };
  }

  if (isInsufficientBhft) {
    return {
      title: "Insufficient BHFT Token Balance",
      message: "Your wallet does not hold enough BinanceHarvest (BHFT) tokens for this transfer.",
      requirements: [
        "Yield Claiming: Claim your accumulated mining rewards from the Mining Dashboard.",
        "Gas Reserve: Keep ~0.002 BNB for the BEP-20 transfer network fee.",
      ],
      suggestedAction: 'none',
    };
  }

  if (isSlippage) {
    return {
      title: "PancakeSwap Slippage Limit Reached",
      message: "The market price changed slightly while the swap transaction was being processed by PancakeSwap.",
      requirements: [
        "Try swapping a slightly smaller USDT amount.",
        "Allow a few moments for the liquidity pool to stabilize and try again.",
      ],
      suggestedAction: 'retry',
      actionLabel: 'Retry Swap',
    };
  }

  // Fallback for any unknown error
  let friendlyExplanation = "The transaction could not be completed on Binance Smart Chain.";
  if (rawMsg.includes("user denied") || rawMsg.includes("User rejected")) {
    friendlyExplanation = "Transaction signature was cancelled in your wallet.";
  } else if (rawMsg.includes("Internal JSON-RPC error")) {
    friendlyExplanation = "The blockchain node reported an error. This usually means insufficient BNB gas or network mismatch.";
  }

  return {
    title: "Transaction Could Not Be Processed",
    message: friendlyExplanation,
    requirements: [
      "1. Wallet Network: Confirm you are on Binance Smart Chain Mainnet (Chain ID 56).",
      "2. Gas Funds: Maintain at least 0.002 BNB (~$1.20 USD) in your wallet for network fees.",
      "3. Token Balance: Ensure your wallet has sufficient funds for the requested action.",
    ],
    suggestedAction: 'retry',
    actionLabel: 'Verify & Retry',
    rawDetails: rawMsg.length > 120 ? rawMsg.substring(0, 120) + '...' : rawMsg
  };
}
