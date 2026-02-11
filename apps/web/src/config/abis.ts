export const REWARD_TOKEN_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
] as const;

export const VERIFICATION_ABI = [
    "function REWARD_AMOUNT() view returns (uint256)",
    "function MIN_CONFIDENCE() view returns (uint256)",
    "function COOLDOWN_PERIOD() view returns (uint256)",
    "function rewardToken() view returns (address)",
    "function isPostRewarded(string calldata postCid) view returns (bool)",
    "function getCooldownRemaining(address wallet) view returns (uint256)",
    "function isAuthorizedVerifier(address verifier) view returns (bool)",
    "function verifyAndReward((string postCid, bool isEco, uint256 confidence, uint256 timestamp, uint256 nonce, address wallet) verdict, bytes calldata signature)",
    "event PostVerified(string indexed postCid, address indexed wallet, bool isEco, uint256 confidence, uint256 timestamp, uint256 nonce)",
    "event RewardMinted(address indexed wallet, string indexed postCid, uint256 amount, uint256 timestamp)",
] as const;
