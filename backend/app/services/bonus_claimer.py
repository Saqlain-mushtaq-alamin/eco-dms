"""
Engagement Bonus Claimer — Celery periodic task.

Runs every 30 minutes. Finds all verified posts whose 24h
engagement window has ended, signs an engagement verdict, and
calls DynamicVerification.claimEngagementBonus() on-chain.

This completes Phase 2: Dynamic two-phase reward system.
"""
from __future__ import annotations

import json
import logging
import os
import time
from typing import Optional

logger = logging.getLogger(__name__)


def _sign_engagement_verdict(
    post_cid: str,
    likes: int,
    comments: int,
    views: int,
    shares: int,
) -> Optional[dict]:
    """Sign an engagement verdict with EIP-712 for DynamicVerification contract."""
    try:
        from eth_account import Account
        from web3 import Web3

        private_key = (
            os.getenv("VERIFIER_PRIVATE_KEY")
            or os.getenv("HARDHAT_DEPLOYER_PRIVATE_KEY")
        )
        if not private_key:
            logger.error("No verifier private key — cannot sign engagement verdict")
            return None

        chain_id = int(os.getenv("CHAIN_ID", os.getenv("VITE_CHAIN_ID", "31337")))
        contract_addr = (
            os.getenv("DYNAMIC_VERIFICATION_ADDRESS")
            or os.getenv("VITE_DYNAMIC_VERIFICATION_ADDRESS")
            or "0x0000000000000000000000000000000000000000"
        )

        nonce = int.from_bytes(os.urandom(6), byteorder="big")
        timestamp = int(time.time())

        domain = {
            "name": "EcoDMS DynamicVerification",
            "version": "2",
            "chainId": chain_id,
            "verifyingContract": Web3.to_checksum_address(contract_addr),
        }
        types = {
            "Engagement": [
                {"name": "postCid",   "type": "string"},
                {"name": "likes",     "type": "uint256"},
                {"name": "comments",  "type": "uint256"},
                {"name": "views",     "type": "uint256"},
                {"name": "shares",    "type": "uint256"},
                {"name": "timestamp", "type": "uint256"},
                {"name": "nonce",     "type": "uint256"},
            ]
        }
        message = {
            "postCid":   post_cid,
            "likes":     likes,
            "comments":  comments,
            "views":     views,
            "shares":    shares,
            "timestamp": timestamp,
            "nonce":     nonce,
        }

        account = Account.from_key(private_key)
        signed = Account.sign_typed_data(
            private_key=account.key,
            domain_data=domain,
            message_types=types,
            message_data=message,
        )

        return {
            "post_cid":  post_cid,
            "likes":     likes,
            "comments":  comments,
            "views":     views,
            "shares":    shares,
            "timestamp": timestamp,
            "nonce":     nonce,
            "signature": signed.signature.hex(),
            "signer":    account.address,
        }
    except Exception as e:
        logger.error("Engagement signing failed: %s", e)
        return None


def _submit_to_contract(signed: dict) -> bool:
    """Submit signed engagement verdict to DynamicVerification contract."""
    try:
        from web3 import Web3

        rpc_url = (
            os.getenv("RPC_URL")
            or os.getenv("HARDHAT_RPC_URL")
            or "http://127.0.0.1:8545"
        )
        w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not w3.is_connected():
            logger.warning("RPC not connected — skipping on-chain bonus claim")
            return False

        contract_addr = (
            os.getenv("DYNAMIC_VERIFICATION_ADDRESS")
            or os.getenv("VITE_DYNAMIC_VERIFICATION_ADDRESS")
        )
        if not contract_addr:
            logger.warning("DYNAMIC_VERIFICATION_ADDRESS not set — skipping claim")
            return False

        # Minimal ABI for claimEngagementBonus
        abi = [{
            "inputs": [
                {"name": "postCid",    "type": "string"},
                {"name": "likes",      "type": "uint256"},
                {"name": "comments",   "type": "uint256"},
                {"name": "views",      "type": "uint256"},
                {"name": "shares",     "type": "uint256"},
                {"name": "timestamp",  "type": "uint256"},
                {"name": "nonce",      "type": "uint256"},
                {"name": "signature",  "type": "bytes"},
            ],
            "name": "claimEngagementBonus",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function",
        }]

        private_key = (
            os.getenv("VERIFIER_PRIVATE_KEY")
            or os.getenv("HARDHAT_DEPLOYER_PRIVATE_KEY")
        )
        account = w3.eth.account.from_key(private_key)
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(contract_addr),
            abi=abi,
        )
        tx = contract.functions.claimEngagementBonus(
            signed["post_cid"],
            signed["likes"],
            signed["comments"],
            signed["views"],
            signed["shares"],
            signed["timestamp"],
            signed["nonce"],
            bytes.fromhex(signed["signature"].lstrip("0x")),
        ).build_transaction({
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas": 200_000,
            "gasPrice": w3.eth.gas_price,
        })
        signed_tx = w3.eth.account.sign_transaction(tx, private_key)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        logger.info(
            "Engagement bonus claimed for %s — tx: %s status: %s",
            signed["post_cid"][:12],
            tx_hash.hex()[:16],
            receipt.status,
        )
        return receipt.status == 1
    except Exception as e:
        logger.error("Contract submission failed: %s", e)
        return False


def run_bonus_claimer() -> dict:
    """
    Main entry point — called by Celery beat every 30 minutes.

    Returns:
        Summary dict: {processed, claimed, failed, skipped}
    """
    from backend.app.services.engagement_service import engagement_service

    ready_posts = engagement_service.get_posts_ready_for_bonus()
    logger.info("BonusClaimer: %d posts ready for engagement bonus", len(ready_posts))

    processed = claimed = failed = skipped = 0

    for post_info in ready_posts:
        post_cid = post_info.get("post_cid")
        author_wallet = post_info.get("author_wallet")
        processed += 1

        if not post_cid or not author_wallet:
            skipped += 1
            continue

        metrics = engagement_service.get_metrics(post_cid)
        logger.debug(
            "Post %s: likes=%d comments=%d views=%d shares=%d",
            post_cid[:12], metrics.likes, metrics.comments,
            metrics.views, metrics.shares,
        )

        signed = _sign_engagement_verdict(
            post_cid=post_cid,
            likes=metrics.likes,
            comments=metrics.comments,
            views=metrics.views,
            shares=metrics.shares,
        )
        if not signed:
            failed += 1
            continue

        success = _submit_to_contract(signed)
        if success:
            engagement_service.mark_bonus_claimed(post_cid)
            claimed += 1
        else:
            failed += 1

    return {
        "processed": processed,
        "claimed": claimed,
        "failed": failed,
        "skipped": skipped,
    }
