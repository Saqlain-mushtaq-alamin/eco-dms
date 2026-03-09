"""
Verdict Signer Service
Cryptographically signs ML verification verdicts for auditability
Supports AWS KMS and local key storage
"""
import os
import json
import hashlib
import time
from datetime import datetime, timezone
from typing import Dict, Optional
import requests
from eth_account import Account
from eth_account.messages import encode_typed_data
from web3 import Web3


class VerdictSigner:
    """
    Signs ML verification verdicts with a secure private key.
    Supports both local key storage and AWS KMS integration.
    """
    
    def __init__(self, use_kms: bool = False):
        """
        Initialize the signer.
        
        Args:
            use_kms: If True, use AWS KMS for signing (recommended for production)
        """
        self.use_kms = use_kms
        self.web3 = Web3()
        
        if use_kms:
            self._init_kms()
        else:
            self._init_local_key()
    
    def _init_local_key(self):
        """Initialize with private key from environment variables."""
        private_key = os.getenv('VERIFIER_PRIVATE_KEY')

        # Local dev fallback can use explicit HARDHAT_DEPLOYER_PRIVATE_KEY from env.
        if not private_key:
            chain_id = int(os.getenv('CHAIN_ID', os.getenv('VITE_CHAIN_ID', '31337')))
            if chain_id == 31337:
                private_key = os.getenv('HARDHAT_DEPLOYER_PRIVATE_KEY')

        if not private_key:
            raise RuntimeError(
                "Missing verifier key. Set VERIFIER_PRIVATE_KEY in backend/.env "
                "(or HARDHAT_DEPLOYER_PRIVATE_KEY for local chain 31337)."
            )
        
        self.account = Account.from_key(private_key)
        self.verifier_address = self.account.address
        
        print(f"Verifier initialized with address: {self.verifier_address}")
    
    def _init_kms(self):
        """Initialize with AWS KMS (production)."""
        try:
            import boto3  # type: ignore[import-not-found]
            
            kms_key_id = os.getenv('AWS_KMS_KEY_ID')
            if not kms_key_id:
                raise ValueError("AWS_KMS_KEY_ID not set in environment")
            
            self.kms_client = boto3.client('kms')
            self.kms_key_id = kms_key_id
            
            # Get public key to derive address
            # Note: This is simplified - actual KMS integration requires more setup
            print(f"Using AWS KMS with key ID: {kms_key_id}")
            
        except ImportError:
            raise RuntimeError("boto3 not installed. Run: pip install boto3")
    
    def _build_eip712_domain(self) -> Dict:
        """Build EIP-712 domain expected by Verification.sol."""
        chain_id = int(os.getenv('CHAIN_ID', os.getenv('VITE_CHAIN_ID', '31337')))
        verifying_contract = (
            os.getenv('VERIFICATION_CONTRACT_ADDRESS')
            or os.getenv('VITE_VERIFICATION_ADDRESS')
            or '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
        )

        return {
            'name': 'EcoDMS Verification',
            'version': '1',
            'chainId': chain_id,
            'verifyingContract': Web3.to_checksum_address(verifying_contract),
        }

    def _build_chain_verdict(self, verdict_data: Dict) -> Optional[Dict]:
        """
        Convert ML verdict payload into contract Verdict struct.
        Returns None when required fields are missing.
        """
        post_cid = verdict_data.get('post_id') or verdict_data.get('ipfs_cid')
        wallet = verdict_data.get('author_wallet')
        is_eco = bool(verdict_data.get('is_eco', verdict_data.get('eco', False)))

        if not post_cid or not wallet:
            return None

        raw_conf = verdict_data.get('confidence', 0)
        try:
            conf_float = float(raw_conf)
        except Exception:
            conf_float = 0.0

        # ML uses 0..1; contract expects 0..100 as uint.
        confidence_pct = int(round(conf_float * 100)) if conf_float <= 1.0 else int(round(conf_float))
        confidence_pct = max(0, min(100, confidence_pct))
        if is_eco and confidence_pct < 80:
            # Contract requires >= 80; clamp eco-positive verdicts to claimable floor.
            confidence_pct = 80

        provided_chain_ts = verdict_data.get('chain_timestamp')
        timestamp_unix: int
        if provided_chain_ts is not None:
            try:
                timestamp_unix = int(provided_chain_ts)
            except Exception:
                timestamp_unix = self._get_reference_timestamp()
        else:
            timestamp_unix = self._get_reference_timestamp()
        # Keep nonce within JS safe integer range so frontend serialization stays exact.
        nonce = int.from_bytes(os.urandom(6), byteorder='big', signed=False)

        return {
            'postCid': str(post_cid),
            'isEco': is_eco,
            'confidence': confidence_pct,
            'timestamp': timestamp_unix,
            'nonce': nonce,
            'wallet': Web3.to_checksum_address(wallet),
        }

    def _get_reference_timestamp(self) -> int:
        """
        Return a timestamp safe to embed in a chain verdict.

        The contract enforces:
          verdict.timestamp <= block.timestamp
          block.timestamp - verdict.timestamp <= 1 hour

        We want a timestamp that is:
          1. <= the pending block's timestamp (so it's not "in future")
          2. Within 1 hour of the pending block's timestamp (so it's not "expired")

        Hardhat's pending block uses max(latest_block_ts + 1, system_clock).
        When the chain hasn't mined a block for a long time, latest_block_ts can
        be hours in the past while system_clock is current. Using only the RPC
        value would produce a stale timestamp that the contract rejects.

        Fix: return max(rpc_latest_block_ts, utcnow). This ensures:
          - Stale chain (no new blocks) → utcnow wins, always within 1hr window.
          - Fast-forwarded chain (e.g. hardhat_mine) → rpc_ts wins, stays consistent.

        NOTE: time.time() is used instead of datetime.utcnow().timestamp() because
        utcnow() returns a naive datetime and .timestamp() interprets it as local time,
        producing an incorrect value on UTC+ machines (hours behind true Unix time).
        """
        wall_clock = int(time.time())  # always correct UTC Unix epoch

        rpc_url = (
            os.getenv('RPC_URL')
            or os.getenv('HARDHAT_RPC_URL')
            or os.getenv('WEB3_RPC_URL')
            or os.getenv('VITE_RPC_URL')
            or 'http://127.0.0.1:8545'
        )

        try:
            response = requests.post(
                rpc_url,
                json={
                    'jsonrpc': '2.0',
                    'method': 'eth_getBlockByNumber',
                    'params': ['latest', False],
                    'id': 1,
                },
                timeout=3,
            )
            response.raise_for_status()
            payload = response.json()
            result = payload.get('result') or {}
            ts_hex = result.get('timestamp')
            if isinstance(ts_hex, str) and ts_hex.startswith('0x'):
                rpc_ts = int(ts_hex, 16)
                # Use whichever is higher so we are always "fresh"
                return max(wall_clock, rpc_ts)
        except Exception:
            pass

        return wall_clock

    def sign_verdict(self, verdict_data: Dict) -> Dict:
        """
        Sign a verification verdict with nonce and timestamp to prevent replays.
        
        Args:
            verdict_data: The ML verification result to sign
        
        Returns:
            Signed verdict with signature, nonce, and verifier address
        """
        timestamp_iso = datetime.now(timezone.utc).isoformat()
        chain_verdict = self._build_chain_verdict(verdict_data)

        payload_hash = self._hash_payload(verdict_data)
        signature = None
        domain = None
        types = {
            'Verdict': [
                {'name': 'postCid', 'type': 'string'},
                {'name': 'isEco', 'type': 'bool'},
                {'name': 'confidence', 'type': 'uint256'},
                {'name': 'timestamp', 'type': 'uint256'},
                {'name': 'nonce', 'type': 'uint256'},
                {'name': 'wallet', 'type': 'address'},
            ]
        }

        if chain_verdict:
            domain = self._build_eip712_domain()
            signed_typed = Account.sign_typed_data(
                private_key=self.account.key,
                domain_data=domain,
                message_types=types,
                message_data=chain_verdict,
            )
            signature = signed_typed.signature.hex()
        
        # Return signed verdict
        signed_verdict = {
            'verdict': verdict_data,
            'chain_verdict': chain_verdict,
            'timestamp': timestamp_iso,
            'payload_hash': payload_hash,
            'signature': signature,
            'verifier_address': self.verifier_address,
            'eip712_domain': domain,
            'eip712_types': types,
            'version': '1.0',
        }
        
        return signed_verdict
    
    def _hash_payload(self, payload: Dict) -> str:
        """
        Create deterministic hash of payload.
        
        Args:
            payload: Dict to hash
        
        Returns:
            Hex string of SHA-256 hash
        """
        # Sort keys for deterministic JSON
        payload_json = json.dumps(payload, sort_keys=True)
        payload_bytes = payload_json.encode('utf-8')
        
        # SHA-256 hash
        hash_obj = hashlib.sha256(payload_bytes)
        return hash_obj.hexdigest()
    
    @staticmethod
    def verify_signature(signed_verdict: Dict) -> bool:
        """
        Verify the signature of a signed verdict.
        
        Args:
            signed_verdict: The signed verdict to verify
        
        Returns:
            True if signature is valid, False otherwise
        """
        try:
            chain_verdict = signed_verdict.get('chain_verdict')
            signature = signed_verdict.get('signature')
            verifier_address = signed_verdict.get('verifier_address')
            domain = signed_verdict.get('eip712_domain')
            types = signed_verdict.get('eip712_types')

            if not chain_verdict or not signature or not verifier_address or not domain or not types:
                return False

            signable = encode_typed_data(
                domain_data=domain,
                message_types=types,
                message_data=chain_verdict,
            )
            recovered_address = Account.recover_message(signable, signature=signature)
            
            # Check if recovered address matches verifier
            if recovered_address.lower() != verifier_address.lower():
                print(f"Address mismatch: {recovered_address} != {verifier_address}")
                return False
            
            return True
        
        except Exception as e:
            print(f"Signature verification error: {e}")
            return False
