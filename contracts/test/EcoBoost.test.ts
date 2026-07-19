import { expect } from "chai"
import { ethers } from "hardhat"
import { EcoBoost, RewardToken } from "../typechain-types"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"

describe("EcoBoost", () => {
    let rewardToken: RewardToken
    let ecoBoost: EcoBoost
    let owner: HardhatEthersSigner
    let user: HardhatEthersSigner
    let other: HardhatEthersSigner

    // Costs from contract constants
    const SPARK_COST    = ethers.parseEther("5")
    const FLAME_COST    = ethers.parseEther("15")
    const WILDFIRE_COST = ethers.parseEther("50")
    const TIER_COSTS    = [SPARK_COST, FLAME_COST, WILDFIRE_COST]

    beforeEach(async () => {
        ;[owner, user, other] = await ethers.getSigners()

        const TokenFactory = await ethers.getContractFactory("RewardToken")
        rewardToken = await TokenFactory.deploy(owner.address)

        const BoostFactory = await ethers.getContractFactory("EcoBoost")
        ecoBoost = await BoostFactory.deploy(
            await rewardToken.getAddress(),
            owner.address
        )

        // Mint tokens for user
        await rewardToken.addMinter(owner.address)
        await rewardToken.mint(user.address, ethers.parseEther("1000"))

        // Approve EcoBoost to spend user tokens
        await rewardToken
            .connect(user)
            .approve(await ecoBoost.getAddress(), ethers.MaxUint256)
    })

    describe("boostPost — tier costs and events", () => {
        it("tier 1 (Spark): burns 5 ECO and emits PostBoosted", async () => {
            const postCid = "QmBoostSpark"
            const tx = await ecoBoost.connect(user).boostPost(postCid, 1)
            const receipt = await tx.wait()

            // Check event (PostBoosted(postCid, booster, level, amount, timestamp))
            const event = receipt?.logs
                .map((log) => {
                    try { return ecoBoost.interface.parseLog(log) } catch { return null }
                })
                .find((e) => e?.name === "PostBoosted")

            expect(event).to.not.be.undefined
            expect(event!.args[0]).to.equal(postCid)           // postCid
            expect(event!.args[1]).to.equal(user.address)      // booster
            expect(event!.args[2]).to.equal(1)                 // level
            expect(event!.args[3]).to.equal(SPARK_COST)        // amount
        })

        it("tier 2 (Flame): burns 15 ECO", async () => {
            const balBefore = await rewardToken.balanceOf(user.address)
            await ecoBoost.connect(user).boostPost("QmFlame", 2)
            const balAfter = await rewardToken.balanceOf(user.address)
            expect(balBefore - balAfter).to.equal(FLAME_COST)
        })

        it("tier 3 (Wildfire): burns 50 ECO", async () => {
            const balBefore = await rewardToken.balanceOf(user.address)
            await ecoBoost.connect(user).boostPost("QmWildfire", 3)
            const balAfter = await rewardToken.balanceOf(user.address)
            expect(balBefore - balAfter).to.equal(WILDFIRE_COST)
        })

        it("reverts for tier 0 (below minimum)", async () => {
            await expect(
                ecoBoost.connect(user).boostPost("QmInvalid", 0)
            ).to.be.revertedWith("EcoBoost: invalid level")
        })

        it("reverts for tier 4 (above maximum)", async () => {
            await expect(
                ecoBoost.connect(user).boostPost("QmInvalid", 4)
            ).to.be.revertedWith("EcoBoost: invalid level")
        })

        it("reverts when user has insufficient balance", async () => {
            // Drain user balance entirely
            const bal = await rewardToken.balanceOf(user.address)
            await rewardToken.connect(user).transfer(owner.address, bal)

            await expect(
                ecoBoost.connect(user).boostPost("QmBroke", 1)
            ).to.be.reverted
        })

        it("allows multiple boosts on the same post", async () => {
            await ecoBoost.connect(user).boostPost("QmMulti", 1)
            await ecoBoost.connect(user).boostPost("QmMulti", 2)
            const count = await ecoBoost.getBoostCount("QmMulti")
            expect(count).to.equal(2)
        })
    })

    describe("getActiveBoostLevel", () => {
        it("returns 0 for un-boosted post", async () => {
            const level = await ecoBoost.getActiveBoostLevel("QmNotBoosted")
            expect(level).to.equal(0)
        })

        it("returns correct level immediately after boost", async () => {
            await ecoBoost.connect(user).boostPost("QmActive", 2)
            const level = await ecoBoost.getActiveBoostLevel("QmActive")
            expect(level).to.equal(2)
        })

        it("returns highest active level for multiple boosts", async () => {
            await ecoBoost.connect(user).boostPost("QmHighest", 1)
            await ecoBoost.connect(user).boostPost("QmHighest", 3)
            const level = await ecoBoost.getActiveBoostLevel("QmHighest")
            expect(level).to.equal(3)
        })
    })

    describe("getBoosts view", () => {
        it("returns all boost records for a post", async () => {
            await ecoBoost.connect(user).boostPost("QmRecord", 1)
            const boostList = await ecoBoost.getBoosts("QmRecord")
            expect(boostList.length).to.equal(1)
            expect(boostList[0].booster).to.equal(user.address)
            expect(boostList[0].level).to.equal(1)
            expect(boostList[0].amount).to.equal(SPARK_COST)
        })
    })

    describe("aggregate stats", () => {
        it("tracks totalBoosts across all posts", async () => {
            await ecoBoost.connect(user).boostPost("QmStat1", 1)
            await ecoBoost.connect(user).boostPost("QmStat2", 2)
            const total = await ecoBoost.totalBoosts()
            expect(total).to.equal(2)
        })

        it("tracks totalBurned (via dead address transfers)", async () => {
            await ecoBoost.connect(user).boostPost("QmBurn1", 1)
            await ecoBoost.connect(user).boostPost("QmBurn2", 3)
            const burned = await ecoBoost.totalBurned()
            expect(burned).to.equal(SPARK_COST + WILDFIRE_COST)
        })
    })
})
