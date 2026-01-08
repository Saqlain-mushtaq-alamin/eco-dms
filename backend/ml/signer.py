"""
Verdict Signer Service
Cryptographically signs ML verification verdicts for auditability
Supports AWS KMS and local key storage
"""
import os
import json
import hashlib
from datetime import datetime
from typing import Dict
from eth_account import Account
from eth_account.messages import encode_defunct
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
        
        if not private_key:
            # Generate a new key if none exists (development only!)
            print("WARNING: No VERIFIER_PRIVATE_KEY found. Generating new key...")
            account = Account.create()
            private_key = account.key.hex()
            print(f"Generated verifier private key: {private_key}")
            print(f"Verifier address: {account.address}")
            print("IMPORTANT: Save this key to .env as VERIFIER_PRIVATE_KEY")
        
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
    
    def sign_verdict(self, verdict_data: Dict) -> Dict:
        """
        Sign a verification verdict with nonce and timestamp to prevent replays.
        
        Args:
            verdict_data: The ML verification result to sign
        
        Returns:
            Signed verdict with signature, nonce, and verifier address
        """
        # Add anti-replay protections
        nonce = self._generate_nonce()
        timestamp = datetime.utcnow().isoformat()
        
        # Create signable payload
        payload = {
            **verdict_data,
            'nonce': nonce,
            'timestamp': timestamp,
        }
        
        # Create deterministic hash of payload
        payload_hash = self._hash_payload(payload)
        
        # Sign the hash
        if self.use_kms:
            signature = self._sign_with_kms(payload_hash)
        else:
            signature = self._sign_with_local_key(payload_hash)
        
        # Return signed verdict
        signed_verdict = {
            'verdict': verdict_data,
            'nonce': nonce,
            'timestamp': timestamp,
            'payload_hash': payload_hash,
            'signature': signature,
            'verifier_address': self.verifier_address,
            'version': '1.0',
        }
        
        return signed_verdict
    
    def _generate_nonce(self) -> str:
        """Generate a unique nonce for this signature."""
        import secrets
        return secrets.token_hex(32)
    
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
    
    def _sign_with_local_key(self, message_hash: str) -> str:
        """
        Sign message hash with local private key.
        
        Args:
            message_hash: Hex string of hash to sign
        
        Returns:
            Hex string of signature
        """
        # Create Ethereum signed message
        message = encode_defunct(hexstr=message_hash)
        
        # Sign with account
        signed_message = self.account.sign_message(message)
        
        # Return signature as hex string
        return signed_message.signature.hex()
    
    def _sign_with_kms(self, message_hash: str) -> str:
        """
        Sign message hash with AWS KMS.
        
        Args:
            message_hash: Hex string of hash to sign
        
        Returns:
            Hex string of signature
        """
        # Convert hash to bytes
        message_bytes = bytes.fromhex(message_hash)
        
        # Sign with KMS
        response = self.kms_client.sign(
            KeyId=self.kms_key_id,
            Message=message_bytes,
            MessageType='DIGEST',
            SigningAlgorithm='ECDSA_SHA_256'
        )
        
        signature_bytes = response['Signature']
        return signature_bytes.hex()
    
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
            # Extract components
            verdict = signed_verdict['verdict']
            nonce = signed_verdict['nonce']
            timestamp = signed_verdict['timestamp']
            payload_hash = signed_verdict['payload_hash']
            signature = signed_verdict['signature']
            verifier_address = signed_verdict['verifier_address']
            
            # Reconstruct payload
            payload = {
                **verdict,
                'nonce': nonce,
                'timestamp': timestamp,
            }
            
            # Recreate hash
            payload_json = json.dumps(payload, sort_keys=True)
            payload_bytes = payload_json.encode('utf-8')
            expected_hash = hashlib.sha256(payload_bytes).hexdigest()
            
            # Check hash matches
            if expected_hash != payload_hash:
                print("Hash mismatch!")
                return False
            
            # Verify signature
            message = encode_defunct(hexstr=payload_hash)
            recovered_address = Account.recover_message(
                message,
                signature=signature
            )
            
            # Check if recovered address matches verifier
            if recovered_address.lower() != verifier_address.lower():
                print(f"Address mismatch: {recovered_address} != {verifier_address}")
                return False
            
            return True
        
        except Exception as e:
            print(f"Signature verification error: {e}")
            return False
