// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./RewardToken.sol";

/**
 * @title Verification
 * @dev Verifies ML verdicts with EIP-712 signatures and mints ECO rewards
 * Implements anti-spam measures and replay protection
 */
contract Verification is Ownable, EIP712 {
    using ECDSA for bytes32;

    // Constants
    uint256 public constant REWARD_AMOUNT = 5 * 10 ** 18; // 5 ECO tokens
    uint256 public constant MIN_CONFIDENCE = 80; // 0.8 * 100 for precision
    uint256 public constant COOLDOWN_PERIOD = 24 hours; // Cooldown per wallet

    // EIP-712 type hash for Verdict struct
    bytes32 public constant VERDICT_TYPEHASH =
        keccak256(
            "Verdict(string postCid,bool isEco,uint256 confidence,uint256 timestamp,uint256 nonce,address wallet)"
        );

    // Reward token contract
    RewardToken public rewardToken;

    // Authorized verifiers (ML backend addresses)
    mapping(address => bool) public authorizedVerifiers;

    // Replay protection: track used nonces
    mapping(uint256 => bool) public usedNonces;

    // Anti-spam: track rewarded post CIDs
    mapping(string => bool) public rewardedPosts;

    // Cooldown: track last reward timestamp per wallet
    mapping(address => uint256) public lastRewardTime;

    // Events for The Graph indexing
    event PostVerified(
        string indexed postCid,
        address indexed wallet,
        bool isEco,
        uint256 confidence,
        uint256 timestamp,
        uint256 nonce
    );

    event RewardMinted(
        address indexed wallet,
        string indexed postCid,
        uint256 amount,
        uint256 timestamp
    );

    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);

    /**
     * @dev Verdict structure matching ML backend output
     */
    struct Verdict {
        string postCid; // IPFS CID of the post
        bool isEco; // True if eco-friendly
        uint256 confidence; // Confidence score (0-100)
        uint256 timestamp; // Timestamp of verdict
        uint256 nonce; // Unique nonce for replay protection
        address wallet; // Wallet to reward
    }

    /**
     * @dev Constructor
     * @param _rewardToken Address of the RewardToken contract
     * @param initialOwner Address of the contract owner
     */
    constructor(
        address _rewardToken,
        address initialOwner
    ) EIP712("EcoDMS Verification", "1") Ownable(initialOwner) {
        require(
            _rewardToken != address(0),
            "Verification: token address is zero"
        );
        rewardToken = RewardToken(_rewardToken);
    }

    /**
     * @dev Add an authorized verifier (ML backend)
     * @param verifier Address to authorize
     */
    function addVerifier(address verifier) external onlyOwner {
        require(
            verifier != address(0),
            "Verification: verifier is zero address"
        );
        require(
            !authorizedVerifiers[verifier],
            "Verification: verifier already authorized"
        );

        authorizedVerifiers[verifier] = true;
        emit VerifierAdded(verifier);
    }

    /**
     * @dev Remove an authorized verifier
     * @param verifier Address to deauthorize
     */
    function removeVerifier(address verifier) external onlyOwner {
        require(
            authorizedVerifiers[verifier],
            "Verification: verifier not authorized"
        );

        authorizedVerifiers[verifier] = false;
        emit VerifierRemoved(verifier);
    }

    /**
     * @dev Verify a signed verdict and mint rewards if valid
     * @param verdict The verdict data
     * @param signature EIP-712 signature from authorized verifier
     */
    function verifyAndReward(
        Verdict calldata verdict,
        bytes calldata signature
    ) external {
        // 1. Verify signature and recover signer
        bytes32 structHash = keccak256(
            abi.encode(
                VERDICT_TYPEHASH,
                keccak256(bytes(verdict.postCid)),
                verdict.isEco,
                verdict.confidence,
                verdict.timestamp,
                verdict.nonce,
                verdict.wallet
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);

        // 2. Check if signer is authorized
        require(
            authorizedVerifiers[signer],
            "Verification: signer not authorized"
        );

        // 3. Validate verdict rules
        require(verdict.isEco, "Verification: post is not eco-friendly");
        require(
            verdict.confidence >= MIN_CONFIDENCE,
            "Verification: confidence too low"
        );
        require(
            verdict.timestamp <= block.timestamp,
            "Verification: timestamp in future"
        );
        require(
            block.timestamp - verdict.timestamp <= 1 hours,
            "Verification: verdict expired"
        );
        require(
            verdict.wallet != address(0),
            "Verification: wallet is zero address"
        );

        // 4. Check replay protection (nonce)
        require(!usedNonces[verdict.nonce], "Verification: nonce already used");
        usedNonces[verdict.nonce] = true;

        // 5. Check anti-spam: one reward per post CID
        require(
            !rewardedPosts[verdict.postCid],
            "Verification: post already rewarded"
        );
        rewardedPosts[verdict.postCid] = true;

        // 6. Check cooldown: one reward per wallet per X hours
        require(
            block.timestamp >= lastRewardTime[verdict.wallet] + COOLDOWN_PERIOD,
            "Verification: wallet in cooldown period"
        );
        lastRewardTime[verdict.wallet] = block.timestamp;

        // 7. Mint reward tokens
        rewardToken.mint(verdict.wallet, REWARD_AMOUNT);

        // 8. Emit events for The Graph
        emit PostVerified(
            verdict.postCid,
            verdict.wallet,
            verdict.isEco,
            verdict.confidence,
            verdict.timestamp,
            verdict.nonce
        );

        emit RewardMinted(
            verdict.wallet,
            verdict.postCid,
            REWARD_AMOUNT,
            block.timestamp
        );
    }

    /**
     * @dev Get the EIP-712 domain separator
     * @return bytes32 The domain separator
     */
    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @dev Get the digest hash for a verdict (useful for testing/debugging)
     * @param verdict The verdict to hash
     * @return bytes32 The digest hash
     */
    function getDigest(
        Verdict calldata verdict
    ) external view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                VERDICT_TYPEHASH,
                keccak256(bytes(verdict.postCid)),
                verdict.isEco,
                verdict.confidence,
                verdict.timestamp,
                verdict.nonce,
                verdict.wallet
            )
        );

        return _hashTypedDataV4(structHash);
    }

    /**
     * @dev Check if a verifier is authorized
     * @param verifier Address to check
     * @return bool True if authorized
     */
    function isAuthorizedVerifier(
        address verifier
    ) external view returns (bool) {
        return authorizedVerifiers[verifier];
    }

    /**
     * @dev Check if a post has been rewarded
     * @param postCid The post CID to check
     * @return bool True if already rewarded
     */
    function isPostRewarded(
        string calldata postCid
    ) external view returns (bool) {
        return rewardedPosts[postCid];
    }

    /**
     * @dev Get remaining cooldown time for a wallet
     * @param wallet Address to check
     * @return uint256 Seconds remaining in cooldown (0 if ready)
     */
    function getCooldownRemaining(
        address wallet
    ) external view returns (uint256) {
        uint256 nextAllowedTime = lastRewardTime[wallet] + COOLDOWN_PERIOD;
        if (block.timestamp >= nextAllowedTime) {
            return 0;
        }
        return nextAllowedTime - block.timestamp;
    }
}
