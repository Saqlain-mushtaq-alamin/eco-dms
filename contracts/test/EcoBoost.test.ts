import { expect } from "chai"
import { ethers } from "hardhat"
import { EcoBoost, RewardToken } from "../typechain-types"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"

describe("EcoBoost", () => {
    let rewardToken: RewardToken
    let ecoBoost: EcoBoost
    let owner: HardhatEthersSigner
    let user: HardhatEthersSigner

    const TIER_COSTS = [
        ethers.parseEther("5"),   // Tier 1
        ethers.parseEther("15"),  // Tier 2
        ethers.parseEther("50"),  // Tier 3
    ]

    beforeEach(async () => {
        ;[owner, user] = await ethers.getSigners()

        const TokenFactory = await ethers.getContractFactory("RewardToken")
        rewardToken = await TokenFactory.deploy(owner.address)

        const BoostFactory = await ethers.getContractFactory("EcoBoost")
        ecoBoost = await BoostFactory.deploy(
            await rewardToken.getAddress(),
            owner.address
        )

        // Mint tokens for user to spend
        await rewardToken.addMinter(owner.address)
        await rewardToken.mint(user.address, ethers.parseEther("1000"))

        // Approve EcoBoost to spend user tokens
        await rewardToken
            .connect(user)
            .approve(await ecoBoost.getAddress(), ethers.MaxUint256)
    })

    describe("boostPost", () => {
        it("burns tokens and emits PostBoosted for tier 1", async () => {
            const postCid = "QmBoostTier1"
            const totalBurnedBefore = await rewardToken.totalBurned()

            await expect(ecoBoost.connect(user).boostPost(postCid, 1))
                .to.emit(ecoBoost, "PostBoosted")
                .withArgs(user.address, postCid, 1, TIER_COSTS[0])

            const burned = await rewardToken.totalBurned()
            expect(burned - totalBurnedBefore).to.equal(TIER_COSTS[0])
        })

        it("burns correct amounts for all tiers", async () => {
            for (let tier = 1; tier <= 3; tier++) {
                const postCid = `QmBoostTier${tier}_v2`
                const before = await rewardToken.balanceOf(user.address)
                await ecoBoost.connect(user).boostPost(postCid, tier)
                const after = await rewardToken.balanceOf(user.address)
                expect(before - after).to.equal(TIER_COSTS[tier - 1])
            }
        })

        it("reverts for invalid tier 0", async () => {
            await expect(
                ecoBoost.connect(user).boostPost("QmInvalid", 0)
            ).to.be.reverted
        })

        it("reverts for invalid tier 4", async () => {
            await expect(
                ecoBoost.connect(user).boostPost("QmInvalid", 4)
            ).to.be.reverted
        })

        it("reverts with insufficient balance", async () => {
            // Drain user balance
            const bal = await rewardToken.balanceOf(user.address)
            await rewardToken
                .connect(user)
                .transfer(owner.address, bal)

            await expect(
                ecoBoost.connect(user).boostPost("QmBroke", 1)
            ).to.be.reverted
        })

        it("records boost multiplier for a post", async () => {
            await ecoBoost.connect(user).boostPost("QmMultiplier", 3)
            const multiplier = await ecoBoost.getBoostMultiplier("QmMultiplier")
            expect(multiplier).to.be.gt(0)
        })

        it("allows re-boosting the same post", async () => {
            await ecoBoost.connect(user).boostPost("QmReboost", 1)
            // Second boost should succeed (upgrade)
            await expect(
                ecoBoost.connect(user).boostPost("QmReboost", 2)
            ).to.not.be.reverted
        })
    })

    describe("totalBurned tracking", () => {
        it("accumulates total burned across multiple boosts", async () => {
            await ecoBoost.connect(user).boostPost("QmAcc1", 1)
            await ecoBoost.connect(user).boostPost("QmAcc2", 2)
            await ecoBoost.connect(user).boostPost("QmAcc3", 3)

            const totalBurned = await rewardToken.totalBurned()
            const expected = TIER_COSTS[0] + TIER_COSTS[1] + TIER_COSTS[2]
            expect(totalBurned).to.be.gte(expected)
        })
    })
})
