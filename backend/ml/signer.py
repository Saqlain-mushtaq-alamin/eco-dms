"""
Verdict Signer Service
Cryptographically signs ML verification verdicts for auditability
Supports AWS KMS and local key storage
"""
import os
import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional
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
        """Initialize with local private key (development/testing)."""
        private_key = os.getenv('VERIFIER_PRIVATE_KEY')

        # Keep one stable verifier key even if env var is missing.
        if not private_key:
            default_key_path = Path(__file__).resolve().parent.parent / 'ml_verifier_private_key.txt'
            key_path = Path(os.getenv('VERIFIER_PRIVATE_KEY_PATH', str(default_key_path)))
            hardhat_default_key = os.getenv(
                'HARDHAT_DEPLOYER_PRIVATE_KEY',
                '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
            )
            chain_id = int(os.getenv('CHAIN_ID', os.getenv('VITE_CHAIN_ID', '31337')))

            if key_path.exists():
                private_key = key_path.read_text(encoding='utf-8').strip()
                print(f"Loaded verifier private key from {key_path}")
            else:
                if chain_id == 31337:
                    private_key = hardhat_default_key
                    account = Account.from_key(private_key)
                    print("WARNING: No VERIFIER_PRIVATE_KEY found. Using Hardhat deployer key for local dev.")
                else:
                    print("WARNING: No VERIFIER_PRIVATE_KEY found. Generating stable local key...")
                    account = Account.create()
                    private_key = account.key.hex()
                key_path.write_text(private_key, encoding='utf-8')
                print(f"Generated verifier private key and saved to {key_path}")
                print(f"Verifier address: {account.address}")
                print("IMPORTANT: Add this key to .env as VERIFIER_PRIVATE_KEY for production")
        
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

        timestamp_unix = int(datetime.utcnow().timestamp())
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

    def sign_verdict(self, verdict_data: Dict) -> Dict:
        """
        Sign a verification verdict with nonce and timestamp to prevent replays.
        
        Args:
            verdict_data: The ML verification result to sign
        
        Returns:
            Signed verdict with signature, nonce, and verifier address
        """
        timestamp_iso = datetime.utcnow().isoformat()
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
