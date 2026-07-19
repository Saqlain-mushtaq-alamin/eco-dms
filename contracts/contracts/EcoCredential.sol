// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./RewardToken.sol";

/**
 * @title EcoCredential
 * @dev Soulbound (non-transferable) NFTs for eco achievements.
 *
 * Key properties:
 *   - Soulbound: cannot be transferred after minting
 *   - ECO token burned on mint (proves commitment + deflationary)
 *   - Four credential types: milestone, community, partner, annual
 *   - Metadata stored on IPFS — fully decentralized
 *
 * This is the on-chain proof layer of the Eco Portfolio.
 * A "100-Day Eco Streak" credential here = verifiable career asset.
 */
contract EcoCredential is ERC721, Ownable {
    RewardToken public ecoToken;
    address public constant BURN_ADDRESS = address(0xdEaD);

    struct Credential {
        string  credentialType;     // "milestone" | "community" | "partner" | "annual"
        string  title;              // "100-Day Eco Streak"
        string  metadataCid;        // IPFS CID of full metadata JSON
        uint256 earnedAt;
        address earner;
    }

    mapping(uint256 => Credential) public credentials;
    uint256 public nextTokenId;

    // Mint costs by type (in ECO tokens with 18 decimals)
    mapping(string => uint256) public mintCosts;

    // Track whether a wallet has a specific titled credential (prevents duplicates)
    mapping(address => mapping(string => bool)) public hasCredential;

    // Aggregate stats
    uint256 public totalBurned;
    uint256 public totalMinted;

    // ─── Events ─────────────────────────────────────────────
    event CredentialMinted(
        uint256 indexed tokenId,
        address indexed earner,
        string  credentialType,
        string  title,
        uint256 ecoBurned
    );

    // ─── Constructor ────────────────────────────────────────
    constructor(
        address _ecoToken,
        address initialOwner
    ) ERC721("EcoDMS Credential", "ECOCRED") Ownable(initialOwner) {
        require(_ecoToken != address(0), "EcoCredential: zero token");
        ecoToken = RewardToken(_ecoToken);

        // Default mint costs
        mintCosts["milestone"] = 20 * 10**18;   // 20 ECO
        mintCosts["community"] = 10 * 10**18;   // 10 ECO
        mintCosts["partner"]   = 5  * 10**18;   // 5 ECO
        mintCosts["annual"]    = 30 * 10**18;   // 30 ECO
    }

    // ─── Soulbound: Disable Transfers ───────────────────────
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        require(
            from == address(0),
            "EcoCredential: soulbound - transfers disabled"
        );
        return super._update(to, tokenId, auth);
    }

    // ─── Mint Credential ────────────────────────────────────
    /**
     * @notice Mint a new soulbound credential for an earner.
     * @dev Only callable by contract owner (backend verifier).
     *      ECO tokens are burned from the earner's wallet.
     *      Earner must have approved this contract to spend ECO.
     */
    function mintCredential(
        address earner,
        string calldata credentialType,
        string calldata title,
        string calldata metadataCid
    ) external onlyOwner returns (uint256) {
        require(
            !hasCredential[earner][title],
            "EcoCredential: credential already earned"
        );

        uint256 cost = mintCosts[credentialType];
        require(cost > 0, "EcoCredential: unknown credential type");

        // Burn ECO from earner
        require(
            ecoToken.transferFrom(earner, BURN_ADDRESS, cost),
            "EcoCredential: ECO burn failed - check allowance"
        );
        totalBurned += cost;
        totalMinted += 1;

        uint256 tokenId = nextTokenId++;
        credentials[tokenId] = Credential({
            credentialType: credentialType,
            title:          title,
            metadataCid:    metadataCid,
            earnedAt:       block.timestamp,
            earner:         earner
        });

        hasCredential[earner][title] = true;
        _safeMint(earner, tokenId);

        emit CredentialMinted(tokenId, earner, credentialType, title, cost);
        return tokenId;
    }

    // ─── Admin ──────────────────────────────────────────────
    function setMintCost(string calldata credType, uint256 cost) external onlyOwner {
        mintCosts[credType] = cost;
    }

    // ─── Views ──────────────────────────────────────────────
    function getCredential(uint256 tokenId) external view returns (Credential memory) {
        _requireOwned(tokenId);
        return credentials[tokenId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string(abi.encodePacked("ipfs://", credentials[tokenId].metadataCid));
    }

    /// @notice Get all token IDs owned by a wallet (for portfolio display)
    function getCredentialsByOwner(address owner) external view returns (uint256[] memory) {
        uint256 count = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < nextTokenId && idx < count; i++) {
            if (_ownerOf(i) == owner) {
                tokenIds[idx++] = i;
            }
        }
        return tokenIds;
    }
}
