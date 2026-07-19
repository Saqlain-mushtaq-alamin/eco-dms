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

    beforeEach(async () => {
        ;[owner, user, other] = await ethers.getSigners()

        const TokenFactory = await ethers.getContractFactory("RewardToken")
        rewardToken = await TokenFactory.deploy(owner.address)

        const CredFactory = await ethers.getContractFactory("EcoCredential")
        ecoCredential = await CredFactory.deploy(
            await rewardToken.getAddress(),
            owner.address
        )

        // Mint tokens and approve
        await rewardToken.addMinter(owner.address)
        await rewardToken.mint(user.address, ethers.parseEther("1000"))
        await rewardToken
            .connect(user)
            .approve(await ecoCredential.getAddress(), ethers.MaxUint256)
    })

    describe("mintCredential", () => {
        it("mints a soulbound credential with valid metadata URI", async () => {
            const metadataUri = "ipfs://QmCredential1"
            await expect(
                ecoCredential
                    .connect(user)
                    .mintCredential("Climate Champion", metadataUri, 0)
            )
                .to.emit(ecoCredential, "CredentialMinted")
                .withArgs(user.address, 1, "Climate Champion", metadataUri)

            expect(await ecoCredential.ownerOf(1)).to.equal(user.address)
        })

        it("burns ECO tokens on mint", async () => {
            const balBefore = await rewardToken.balanceOf(user.address)
            await ecoCredential
                .connect(user)
                .mintCredential("Eco Veteran", "ipfs://QmCred2", 0)
            const balAfter = await rewardToken.balanceOf(user.address)
            expect(balBefore - balAfter).to.be.gt(0n)
        })

        it("is soulbound — transfer reverts", async () => {
            await ecoCredential
                .connect(user)
                .mintCredential("Eco Veteran", "ipfs://QmSoulbound", 0)

            await expect(
                ecoCredential
                    .connect(user)
                    .transferFrom(user.address, other.address, 1)
            ).to.be.revertedWith("EcoCredential: soulbound")
        })

        it("safe transfer also reverts (soulbound)", async () => {
            await ecoCredential
                .connect(user)
                .mintCredential("Eco Veteran", "ipfs://QmSoulbound2", 0)

            await expect(
                ecoCredential
                    .connect(user)
                    ["safeTransferFrom(address,address,uint256)"](
                        user.address, other.address, 1
                    )
            ).to.be.revertedWith("EcoCredential: soulbound")
        })

        it("reverts with insufficient token balance", async () => {
            // Drain balance
            const bal = await rewardToken.balanceOf(user.address)
            await rewardToken.connect(user).transfer(owner.address, bal)

            await expect(
                ecoCredential
                    .connect(user)
                    .mintCredential("Broke", "ipfs://QmBroke", 0)
            ).to.be.reverted
        })
    })

    describe("tokenURI and metadata", () => {
        it("returns correct metadata URI", async () => {
            const uri = "ipfs://QmMetadataUri"
            await ecoCredential
                .connect(user)
                .mintCredential("Eco Pioneer", uri, 0)
            expect(await ecoCredential.tokenURI(1)).to.equal(uri)
        })
    })

    describe("admin: owner minting", () => {
        it("owner can mint without cost for awards", async () => {
            await expect(
                ecoCredential
                    .connect(owner)
                    .adminMint(other.address, "Partner Award", "ipfs://QmPartner", 99)
            )
                .to.emit(ecoCredential, "CredentialMinted")
                .withArgs(other.address, 1, "Partner Award", "ipfs://QmPartner")
        })
    })
})
