# Frontend Integration Guide - Claiming Rewards

This guide shows how to integrate the verification system in your React/TypeScript frontend.

## 📦 Installation

```bash
npm install ethers@6
# or
pnpm add ethers@6
```

## 🔧 Setup

### Contract ABIs

After compiling contracts, copy ABIs to your frontend:

```bash
# From contracts directory
npm run build

# Copy ABIs to frontend
cp artifacts/contracts/RewardToken.sol/RewardToken.json ../apps/web/src/contracts/
cp artifacts/contracts/Verification.sol/Verification.json ../apps/web/src/contracts/
```

### Configuration

```typescript
// config/contracts.ts
export const CONTRACTS = {
  rewardToken: {
    address: "0x...", // Your deployed RewardToken address
    abi: RewardTokenABI,
  },
  verification: {
    address: "0x...", // Your deployed Verification address
    abi: VerificationABI,
  },
};

export const CHAIN_ID = 80002; // Polygon Mumbai
```

## 🎯 Core Integration

### 1. Connect to Contracts

```typescript
// hooks/useContracts.ts
import { ethers } from "ethers";
import { useMemo } from "react";
import { useWallet } from "./useWallet"; // Your wallet hook
import { CONTRACTS } from "../config/contracts";

export function useContracts() {
  const { signer } = useWallet();

  const contracts = useMemo(() => {
    if (!signer) return null;

    return {
      rewardToken: new ethers.Contract(
        CONTRACTS.rewardToken.address,
        CONTRACTS.rewardToken.abi,
        signer
      ),
      verification: new ethers.Contract(
        CONTRACTS.verification.address,
        CONTRACTS.verification.abi,
        signer
      ),
    };
  }, [signer]);

  return contracts;
}
```

### 2. Check Eligibility

```typescript
// hooks/useVerificationStatus.ts
import { useState, useEffect } from "react";
import { useContracts } from "./useContracts";

export function useVerificationStatus(postCid: string, walletAddress: string) {
  const contracts = useContracts();
  const [status, setStatus] = useState({
    isPostRewarded: false,
    cooldownRemaining: 0,
    canClaim: false,
    loading: true,
  });

  useEffect(() => {
    async function checkStatus() {
      if (!contracts || !postCid || !walletAddress) return;

      try {
        const [isRewarded, cooldown] = await Promise.all([
          contracts.verification.isPostRewarded(postCid),
          contracts.verification.getCooldownRemaining(walletAddress),
        ]);

        const canClaim = !isRewarded && cooldown === 0n;

        setStatus({
          isPostRewarded: isRewarded,
          cooldownRemaining: Number(cooldown),
          canClaim,
          loading: false,
        });
      } catch (error) {
        console.error("Failed to check status:", error);
        setStatus((prev) => ({ ...prev, loading: false }));
      }
    }

    checkStatus();
  }, [contracts, postCid, walletAddress]);

  return status;
}
```

### 3. Claim Reward

```typescript
// hooks/useClaimReward.ts
import { useState } from "react";
import { useContracts } from "./useContracts";
import type { Verdict } from "../types/verification";

export function useClaimReward() {
  const contracts = useContracts();
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function claimReward(verdict: Verdict, signature: string) {
    if (!contracts) {
      throw new Error("Contracts not initialized");
    }

    setClaiming(true);
    setError(null);

    try {
      // Submit transaction
      const tx = await contracts.verification.verifyAndReward(
        verdict,
        signature
      );

      console.log("Transaction submitted:", tx.hash);

      // Wait for confirmation
      const receipt = await tx.wait();

      console.log("Transaction confirmed:", receipt.hash);

      // Extract events
      const postVerifiedEvent = receipt.logs
        .map((log: any) => {
          try {
            return contracts.verification.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((event: any) => event?.name === "PostVerified");

      const rewardMintedEvent = receipt.logs
        .map((log: any) => {
          try {
            return contracts.verification.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((event: any) => event?.name === "RewardMinted");

      return {
        success: true,
        txHash: receipt.hash,
        events: {
          postVerified: postVerifiedEvent?.args,
          rewardMinted: rewardMintedEvent?.args,
        },
      };
    } catch (err: any) {
      console.error("Claim failed:", err);

      // Parse error message
      let errorMessage = "Transaction failed";

      if (err.reason) {
        errorMessage = err.reason;
      } else if (err.message) {
        // Extract revert reason from error message
        const match = err.message.match(/reverted with reason string '(.+)'/);
        if (match) {
          errorMessage = match[1];
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setClaiming(false);
    }
  }

  return { claimReward, claiming, error };
}
```

### 4. Get Token Balance

```typescript
// hooks/useTokenBalance.ts
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useContracts } from "./useContracts";

export function useTokenBalance(address: string | null) {
  const contracts = useContracts();
  const [balance, setBalance] = useState("0");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBalance() {
      if (!contracts || !address) {
        setBalance("0");
        setLoading(false);
        return;
      }

      try {
        const rawBalance = await contracts.rewardToken.balanceOf(address);
        const formatted = ethers.formatEther(rawBalance);
        setBalance(formatted);
      } catch (error) {
        console.error("Failed to fetch balance:", error);
        setBalance("0");
      } finally {
        setLoading(false);
      }
    }

    fetchBalance();

    // Refresh every 10 seconds
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [contracts, address]);

  return { balance, loading };
}
```

## 🎨 UI Components

### Claim Reward Button

```typescript
// components/ClaimRewardButton.tsx
import { useState } from "react";
import { useClaimReward } from "../hooks/useClaimReward";
import { useVerificationStatus } from "../hooks/useVerificationStatus";

interface Props {
  postCid: string;
  verdict: Verdict;
  signature: string;
  walletAddress: string;
  onSuccess?: (txHash: string) => void;
}

export function ClaimRewardButton({
  postCid,
  verdict,
  signature,
  walletAddress,
  onSuccess,
}: Props) {
  const { claimReward, claiming, error } = useClaimReward();
  const status = useVerificationStatus(postCid, walletAddress);

  async function handleClaim() {
    try {
      const result = await claimReward(verdict, signature);
      onSuccess?.(result.txHash);
    } catch (err) {
      // Error is handled in hook
    }
  }

  if (status.loading) {
    return <button disabled>Checking eligibility...</button>;
  }

  if (status.isPostRewarded) {
    return <div className="text-green-600">✅ Already claimed</div>;
  }

  if (status.cooldownRemaining > 0) {
    const hours = Math.ceil(status.cooldownRemaining / 3600);
    return (
      <div className="text-yellow-600">
        ⏳ Cooldown: {hours}h remaining
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleClaim}
        disabled={claiming || !status.canClaim}
        className="btn-primary"
      >
        {claiming ? "Claiming..." : "🪙 Claim 5 ECO Tokens"}
      </button>
      {error && <div className="text-red-600 mt-2">{error}</div>}
    </div>
  );
}
```

### Token Balance Display

```typescript
// components/TokenBalance.tsx
import { useTokenBalance } from "../hooks/useTokenBalance";

interface Props {
  address: string | null;
}

export function TokenBalance({ address }: Props) {
  const { balance, loading } = useTokenBalance(address);

  if (loading) {
    return <div>Loading balance...</div>;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl">🪙</span>
      <span className="font-bold">{balance} ECO</span>
    </div>
  );
}
```

## 🔄 Complete Flow

### 1. User Creates Post

```typescript
// User creates eco-friendly post
const postCid = await uploadToIPFS(postData);
```

### 2. Request Verification from Backend

```typescript
// Request verdict from your ML backend
const response = await fetch("/api/verify/verdict", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    post_cid: postCid,
    wallet_address: userWallet,
    eco_score: 0.85,
  }),
});

const { verdict, signature } = await response.json();

// Store for later use
setVerdictData({ verdict, signature });
```

### 3. Display Claim Button

```tsx
<ClaimRewardButton
  postCid={postCid}
  verdict={verdict}
  signature={signature}
  walletAddress={userWallet}
  onSuccess={(txHash) => {
    console.log("Reward claimed!", txHash);
    // Notify backend
    fetch("/api/verify/claim", {
      method: "POST",
      body: JSON.stringify({ post_cid: postCid, tx_hash: txHash }),
    });
  }}
/>
```

## 📊 TypeScript Types

```typescript
// types/verification.ts
export interface Verdict {
  postCid: string;
  isEco: boolean;
  confidence: bigint;
  timestamp: bigint;
  nonce: bigint;
  wallet: string;
}

export interface SignedVerdict {
  verdict: Verdict;
  signature: string;
  signer: string;
}

export interface ClaimResult {
  success: boolean;
  txHash: string;
  events: {
    postVerified?: any;
    rewardMinted?: any;
  };
}
```

## 🚨 Error Handling

### Common Errors

```typescript
function getErrorMessage(error: any): string {
  const errorMap: Record<string, string> = {
    "Verification: signer not authorized":
      "Verification failed - invalid signature",
    "Verification: post is not eco-friendly":
      "This post is not eco-friendly",
    "Verification: confidence too low":
      "Verification confidence too low",
    "Verification: nonce already used": "This verification was already used",
    "Verification: post already rewarded": "Reward already claimed",
    "Verification: wallet in cooldown period":
      "Please wait before claiming another reward",
    "Verification: verdict expired": "Verification expired - please try again",
    "user rejected transaction": "Transaction cancelled",
    "insufficient funds": "Insufficient funds for gas",
  };

  for (const [key, value] of Object.entries(errorMap)) {
    if (error.message?.includes(key)) {
      return value;
    }
  }

  return "Transaction failed - please try again";
}
```

## 🎯 Best Practices

1. **Always check eligibility** before showing claim button
2. **Cache verdicts** in local storage to avoid re-fetching
3. **Show transaction status** (pending, confirmed, failed)
4. **Handle network switching** if user is on wrong network
5. **Display gas estimates** before transaction
6. **Refresh balance** after successful claim
7. **Show transaction link** to block explorer

## 🧪 Testing

```typescript
// Test with Hardhat local network
import { expect } from "@playwright/test";

test("user can claim reward", async ({ page }) => {
  // Connect wallet
  await page.click('[data-testid="connect-wallet"]');

  // Create eco-friendly post
  await page.fill('[data-testid="post-input"]', "Solar panels!");
  await page.click('[data-testid="submit-post"]');

  // Wait for verification
  await page.waitForSelector('[data-testid="claim-button"]');

  // Claim reward
  await page.click('[data-testid="claim-button"]');

  // Confirm transaction in MetaMask
  // (You'll need to automate this with synpress or similar)

  // Check balance increased
  await expect(page.locator('[data-testid="token-balance"]')).toContainText(
    "5 ECO"
  );
});
```

## 📚 Resources

- [ethers.js v6 Docs](https://docs.ethers.org/v6/)
- [EIP-712 Specification](https://eips.ethereum.org/EIPS/eip-712)
- [Contract ABIs](../artifacts/contracts/)

## ✅ Checklist

- [ ] Install ethers.js v6
- [ ] Copy contract ABIs to frontend
- [ ] Configure contract addresses
- [ ] Implement wallet connection
- [ ] Implement eligibility checking
- [ ] Implement claim reward functionality
- [ ] Add token balance display
- [ ] Add error handling
- [ ] Test on local network
- [ ] Test on testnet
- [ ] Add transaction notifications
- [ ] Add loading states
- [ ] Add analytics tracking
