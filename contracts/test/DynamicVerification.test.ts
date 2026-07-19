import { expect } from "chai"
import { ethers } from "hardhat"
import { time } from "@nomicfoundation/hardhat-network-helpers"
import { DynamicVerification, RewardToken } from "../typechain-types"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"

describe("DynamicVerification", () => {
    let rewardToken: RewardToken
    let verification: DynamicVerification
    let owner: HardhatEthersSigner
    let verifier: HardhatEthersSigner
    let user: HardhatEthersSigner

    const DOMAIN_NAME = "EcoDMS DynamicVerification"
    const DOMAIN_VERSION = "2"
    const BASE_REWARD = ethers.parseEther("5")

    async function signVerdict(
        postCid: string,
        isEco: boolean,
        confidence: number,
        timestamp: number,
        nonce: number,
        wallet: string,
        signer: HardhatEthersSigner
    ) {
        const domain = {
            name: DOMAIN_NAME,
            version: DOMAIN_VERSION,
            chainId: (await ethers.provider.getNetwork()).chainId,
            verifyingContract: await verification.getAddress(),
        }
        const types = {
            Verdict: [
                { name: "postCid",     type: "string" },
                { name: "isEco",       type: "bool" },
                { name: "confidence",  type: "uint256" },
                { name: "timestamp",   type: "uint256" },
                { name: "nonce",       type: "uint256" },
                { name: "wallet",      type: "address" },
            ],
        }
        const value = { postCid, isEco, confidence, timestamp, nonce, wallet }
        return signer.signTypedData(domain, types, value)
    }

    async function signEngagement(
        postCid: string,
        likes: number, comments: number, views: number, shares: number,
        timestamp: number, nonce: number,
        signer: HardhatEthersSigner
    ) {
        const domain = {
            name: DOMAIN_NAME,
            version: DOMAIN_VERSION,
            chainId: (await ethers.provider.getNetwork()).chainId,
            verifyingContract: await verification.getAddress(),
        }
        const types = {
            Engagement: [
                { name: "postCid",    type: "string" },
                { name: "likes",      type: "uint256" },
                { name: "comments",   type: "uint256" },
                { name: "views",      type: "uint256" },
                { name: "shares",     type: "uint256" },
                { name: "timestamp",  type: "uint256" },
                { name: "nonce",      type: "uint256" },
            ],
        }
        const value = { postCid, likes, comments, views, shares, timestamp, nonce }
        return signer.signTypedData(domain, types, value)
    }

    beforeEach(async () => {
        ;[owner, verifier, user] = await ethers.getSigners()

        const TokenFactory = await ethers.getContractFactory("RewardToken")
        rewardToken = await TokenFactory.deploy(owner.address)

        const DVFactory = await ethers.getContractFactory("DynamicVerification")
        verification = await DVFactory.deploy(
            await rewardToken.getAddress(),
            owner.address
        )

        // Grant minting rights and add verifier
        await rewardToken.addMinter(await verification.getAddress())
        await verification.addVerifier(verifier.address)
    })

    describe("Phase 1: verifyAndReward", () => {
        it("mints BASE_REWARD for a valid eco verdict", async () => {
            const postCid = "QmTestPost1"
            const ts = await time.latest()
            const nonce = 1001

            const sig = await signVerdict(
                postCid, true, 90, ts, nonce, user.address, verifier
            )

            await verification.verifyAndReward(
                postCid, true, 90, ts, nonce, user.address, sig
            )

            const balance = await rewardToken.balanceOf(user.address)
            expect(balance).to.equal(BASE_REWARD)
        })

        it("reverts for low confidence", async () => {
            const ts = await time.latest()
            const sig = await signVerdict(
                "QmLowConf", true, 70, ts, 2001, user.address, verifier
            )
            await expect(
                verification.verifyAndReward(
                    "QmLowConf", true, 70, ts, 2001, user.address, sig
                )
            ).to.be.revertedWith("DV: low confidence")
        })

        it("reverts for non-eco verdict", async () => {
            const ts = await time.latest()
            const sig = await signVerdict(
                "QmNotEco", false, 95, ts, 3001, user.address, verifier
            )
            await expect(
                verification.verifyAndReward(
                    "QmNotEco", false, 95, ts, 3001, user.address, sig
                )
            ).to.be.revertedWith("DV: not eco")
        })

        it("reverts on duplicate nonce", async () => {
            const ts = await time.latest()
            const nonce = 4001
            const sig = await signVerdict(
                "QmDupNonce", true, 90, ts, nonce, user.address, verifier
            )
            await verification.verifyAndReward(
                "QmDupNonce", true, 90, ts, nonce, user.address, sig
            )
            await expect(
                verification.verifyAndReward(
                    "QmDupNonce", true, 90, ts, nonce, user.address, sig
                )
            ).to.be.revertedWith("DV: nonce used")
        })

        it("reverts on cooldown", async () => {
            const ts = await time.latest()
            const sig1 = await signVerdict(
                "QmFirst", true, 90, ts, 5001, user.address, verifier
            )
            await verification.verifyAndReward(
                "QmFirst", true, 90, ts, 5001, user.address, sig1
            )

            // Try second post within 24h
            const ts2 = await time.latest()
            const sig2 = await signVerdict(
                "QmSecond", true, 90, ts2, 5002, user.address, verifier
            )
            await expect(
                verification.verifyAndReward(
                    "QmSecond", true, 90, ts2, 5002, user.address, sig2
                )
            ).to.be.revertedWith("DV: cooldown")
        })

        it("reverts with unauthorized signer", async () => {
            const ts = await time.latest()
            // user signs instead of verifier
            const sig = await signVerdict(
                "QmUnauth", true, 90, ts, 6001, user.address, user
            )
            await expect(
                verification.verifyAndReward(
                    "QmUnauth", true, 90, ts, 6001, user.address, sig
                )
            ).to.be.revertedWith("DV: unauthorized signer")
        })
    })

    describe("Phase 2: claimEngagementBonus", () => {
        let postCid: string

        beforeEach(async () => {
            postCid = "QmEngagementTest"
            const ts = await time.latest()
            const sig = await signVerdict(
                postCid, true, 90, ts, 9001, user.address, verifier
            )
            await verification.verifyAndReward(
                postCid, true, 90, ts, 9001, user.address, sig
            )
        })

        it("pays bonus after 24h window with engagement", async () => {
            // Advance 25 hours
            await time.increase(25 * 3600)

            const ts = await time.latest()
            const nonce = 9002
            const likes = 100, comments = 20, views = 500, shares = 10

            const sig = await signEngagement(
                postCid, likes, comments, views, shares, ts, nonce, verifier
            )

            const balanceBefore = await rewardToken.balanceOf(user.address)
            await verification.claimEngagementBonus(
                postCid, likes, comments, views, shares, ts, nonce, sig
            )
            const balanceAfter = await rewardToken.balanceOf(user.address)
            expect(balanceAfter).to.be.gt(balanceBefore)
        })

        it("reverts if window still open", async () => {
            // Only 1 hour has passed
            await time.increase(3600)
            const ts = await time.latest()
            const sig = await signEngagement(
                postCid, 10, 2, 50, 1, ts, 9003, verifier
            )
            await expect(
                verification.claimEngagementBonus(
                    postCid, 10, 2, 50, 1, ts, 9003, sig
                )
            ).to.be.revertedWith("DV: engagement window open")
        })

        it("reverts on double bonus claim", async () => {
            await time.increase(25 * 3600)
            const ts = await time.latest()
            const sig1 = await signEngagement(
                postCid, 10, 2, 50, 1, ts, 9004, verifier
            )
            await verification.claimEngagementBonus(
                postCid, 10, 2, 50, 1, ts, 9004, sig1
            )

            const sig2 = await signEngagement(
                postCid, 10, 2, 50, 1, ts + 1, 9005, verifier
            )
            await expect(
                verification.claimEngagementBonus(
                    postCid, 10, 2, 50, 1, ts + 1, 9005, sig2
                )
            ).to.be.revertedWith("DV: bonus claimed")
        })
    })

    describe("Admin", () => {
        it("owner can add/remove verifiers", async () => {
            const [, , , newVerifier] = await ethers.getSigners()
            await verification.addVerifier(newVerifier.address)
            expect(await verification.authorizedVerifiers(newVerifier.address)).to.be.true
            await verification.removeVerifier(newVerifier.address)
            expect(await verification.authorizedVerifiers(newVerifier.address)).to.be.false
        })

        it("owner can set user levels", async () => {
            await verification.setUserLevel(user.address, 5)
            expect(await verification.userLevel(user.address)).to.equal(5)
        })
    })
})
