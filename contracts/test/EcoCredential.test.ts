import { expect } from "chai"
import { ethers } from "hardhat"
import { EcoCredential, RewardToken } from "../typechain-types"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"

describe("EcoCredential", () => {
    let rewardToken: RewardToken
    let ecoCredential: EcoCredential
    let owner: HardhatEthersSigner
    let user: HardhatEthersSigner
    let other: HardhatEthersSigner

    // Costs from constructor defaults
    const MILESTONE_COST = ethers.parseEther("20")
    const COMMUNITY_COST = ethers.parseEther("10")

    beforeEach(async () => {
        ;[owner, user, other] = await ethers.getSigners()

        const TokenFactory = await ethers.getContractFactory("RewardToken")
        rewardToken = await TokenFactory.deploy(owner.address)

        const CredFactory = await ethers.getContractFactory("EcoCredential")
        ecoCredential = await CredFactory.deploy(
            await rewardToken.getAddress(),
            owner.address
        )

        // Mint tokens for user and approve
        await rewardToken.addMinter(owner.address)
        await rewardToken.mint(user.address, ethers.parseEther("1000"))
        await rewardToken
            .connect(user)
            .approve(await ecoCredential.getAddress(), ethers.MaxUint256)
    })

    // Helper: mint credential via owner (required by onlyOwner modifier)
    async function mintMilestone(earner: string, title: string, cid: string) {
        return ecoCredential
            .connect(owner)
            .mintCredential(earner, "milestone", title, cid)
    }

    describe("mintCredential", () => {
        it("mints a credential and emits CredentialMinted", async () => {
            const tx = await mintMilestone(user.address, "100-Day Streak", "QmCredMeta1")
            const receipt = await tx.wait()

            // Event: CredentialMinted(tokenId, earner, credentialType, title, ecoBurned)
            const event = receipt?.logs
                .map((log) => {
                    try { return ecoCredential.interface.parseLog(log) } catch { return null }
                })
                .find((e) => e?.name === "CredentialMinted")

            expect(event).to.not.be.undefined
            expect(event!.args[1]).to.equal(user.address)        // earner
            expect(event!.args[2]).to.equal("milestone")         // credentialType
            expect(event!.args[3]).to.equal("100-Day Streak")    // title
            expect(event!.args[4]).to.equal(MILESTONE_COST)      // ecoBurned
        })

        it("owner becomes the ERC721 token owner after mint", async () => {
            await mintMilestone(user.address, "Tree Planter", "QmCredMeta2")
            // tokenId 0 (nextTokenId starts at 0)
            expect(await ecoCredential.ownerOf(0)).to.equal(user.address)
        })

        it("burns ECO from earner on mint", async () => {
            const balBefore = await rewardToken.balanceOf(user.address)
            await mintMilestone(user.address, "Eco Pioneer", "QmCredMeta3")
            const balAfter = await rewardToken.balanceOf(user.address)
            expect(balBefore - balAfter).to.equal(MILESTONE_COST)
        })

        it("increments totalMinted and totalBurned", async () => {
            await mintMilestone(user.address, "Solar Champion", "QmCredMeta4")
            expect(await ecoCredential.totalMinted()).to.equal(1)
            expect(await ecoCredential.totalBurned()).to.equal(MILESTONE_COST)
        })

        it("reverts when earner has insufficient balance", async () => {
            const bal = await rewardToken.balanceOf(user.address)
            await rewardToken.connect(user).transfer(other.address, bal)

            await expect(
                mintMilestone(user.address, "Broke", "QmBroke")
            ).to.be.reverted
        })

        it("reverts on duplicate credential title for same earner", async () => {
            await mintMilestone(user.address, "Unique Title", "QmCredDup1")
            await expect(
                mintMilestone(user.address, "Unique Title", "QmCredDup2")
            ).to.be.revertedWith("EcoCredential: credential already earned")
        })

        it("reverts for unknown credential type", async () => {
            await expect(
                ecoCredential
                    .connect(owner)
                    .mintCredential(user.address, "unknown_type", "Test", "QmX")
            ).to.be.revertedWith("EcoCredential: unknown credential type")
        })

        it("only owner can call mintCredential", async () => {
            await expect(
                ecoCredential
                    .connect(user)
                    .mintCredential(user.address, "milestone", "Self Mint", "QmSelf")
            ).to.be.reverted  // Ownable revert
        })
    })

    describe("soulbound — transfers disabled", () => {
        beforeEach(async () => {
            await mintMilestone(user.address, "Soulbound Test", "QmSoul")
        })

        it("transferFrom reverts (soulbound)", async () => {
            await expect(
                ecoCredential
                    .connect(user)
                    .transferFrom(user.address, other.address, 0)
            ).to.be.revertedWith("EcoCredential: soulbound - transfers disabled")
        })

        it("safeTransferFrom reverts (soulbound)", async () => {
            await expect(
                ecoCredential
                    .connect(user)
                    ["safeTransferFrom(address,address,uint256)"](
                        user.address, other.address, 0
                    )
            ).to.be.revertedWith("EcoCredential: soulbound - transfers disabled")
        })
    })

    describe("tokenURI and metadata", () => {
        it("returns ipfs:// prefixed URI from metadataCid", async () => {
            const cid = "QmMetadataCid123"
            await mintMilestone(user.address, "URI Test", cid)
            const uri = await ecoCredential.tokenURI(0)
            expect(uri).to.equal(`ipfs://${cid}`)
        })

        it("getCredential returns full struct", async () => {
            await mintMilestone(user.address, "Struct Test", "QmStruct")
            const cred = await ecoCredential.getCredential(0)
            expect(cred.title).to.equal("Struct Test")
            expect(cred.credentialType).to.equal("milestone")
            expect(cred.earner).to.equal(user.address)
        })
    })

    describe("getCredentialsByOwner", () => {
        it("returns all token IDs for a wallet", async () => {
            // Mint 2 credentials for user
            await mintMilestone(user.address, "Cred A", "QmA")
            await rewardToken.mint(user.address, ethers.parseEther("200"))
            await mintMilestone(user.address, "Cred B", "QmB")

            const ids = await ecoCredential.getCredentialsByOwner(user.address)
            expect(ids.length).to.equal(2)
        })

        it("returns empty array for wallet with no credentials", async () => {
            const ids = await ecoCredential.getCredentialsByOwner(other.address)
            expect(ids.length).to.equal(0)
        })
    })

    describe("admin: setMintCost", () => {
        it("owner can update mint cost for a credential type", async () => {
            await ecoCredential.setMintCost("milestone", ethers.parseEther("25"))
            expect(await ecoCredential.mintCosts("milestone")).to.equal(
                ethers.parseEther("25")
            )
        })
    })
})
