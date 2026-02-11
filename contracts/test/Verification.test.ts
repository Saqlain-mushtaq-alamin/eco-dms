import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { RewardToken, Verification } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Verification System", function () {
    let rewardToken: RewardToken;
    let verification: Verification;
    let owner: SignerWithAddress;
    let verifier: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let unauthorized: SignerWithAddress;

    const REWARD_AMOUNT = ethers.parseEther("5");
    const MIN_CONFIDENCE = 80n;
    const COOLDOWN_PERIOD = 24 * 60 * 60; // 24 hours in seconds

    // EIP-712 Domain
    let domain: any;
    const types = {
        Verdict: [
            { name: "postCid", type: "string" },
            { name: "isEco", type: "bool" },
            { name: "confidence", type: "uint256" },
            { name: "timestamp", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "wallet", type: "address" },
        ],
    };

    beforeEach(async function () {
        [owner, verifier, user1, user2, unauthorized] = await ethers.getSigners();

        // Deploy RewardToken
        const RewardTokenFactory = await ethers.getContractFactory("RewardToken");
        rewardToken = await RewardTokenFactory.deploy(owner.address);
        await rewardToken.waitForDeployment();

        // Deploy Verification
        const VerificationFactory = await ethers.getContractFactory("Verification");
        verification = await VerificationFactory.deploy(
            await rewardToken.getAddress(),
            owner.address
        );
        await verification.waitForDeployment();

        // Set up domain for EIP-712
        domain = {
            name: "EcoDMS Verification",
            version: "1",
            chainId: (await ethers.provider.getNetwork()).chainId,
            verifyingContract: await verification.getAddress(),
        };

        // Add verification contract as minter
        await rewardToken.addMinter(await verification.getAddress());

        // Add verifier as authorized
        await verification.addVerifier(verifier.address);
    });

    describe("RewardToken", function () {
        describe("Deployment", function () {
            it("Should set the correct name and symbol", async function () {
                expect(await rewardToken.name()).to.equal("EcoDMS Reward Token");
                expect(await rewardToken.symbol()).to.equal("ECO");
            });

            it("Should set the correct owner", async function () {
                expect(await rewardToken.owner()).to.equal(owner.address);
            });

            it("Should have zero initial supply", async function () {
                expect(await rewardToken.totalSupply()).to.equal(0);
            });
        });

        describe("Minter Management", function () {
            it("Should allow owner to add minter", async function () {
                await expect(rewardToken.addMinter(user1.address))
                    .to.emit(rewardToken, "MinterAdded")
                    .withArgs(user1.address);

                expect(await rewardToken.isMinter(user1.address)).to.be.true;
            });

            it("Should not allow non-owner to add minter", async function () {
                await expect(
                    rewardToken.connect(user1).addMinter(user2.address)
                ).to.be.revertedWithCustomError(rewardToken, "OwnableUnauthorizedAccount");
            });

            it("Should not allow adding zero address as minter", async function () {
                await expect(
                    rewardToken.addMinter(ethers.ZeroAddress)
                ).to.be.revertedWith("RewardToken: minter is zero address");
            });

            it("Should not allow adding duplicate minter", async function () {
                await rewardToken.addMinter(user1.address);
                await expect(
                    rewardToken.addMinter(user1.address)
                ).to.be.revertedWith("RewardToken: minter already added");
            });

            it("Should allow owner to remove minter", async function () {
                await rewardToken.addMinter(user1.address);

                await expect(rewardToken.removeMinter(user1.address))
                    .to.emit(rewardToken, "MinterRemoved")
                    .withArgs(user1.address);

                expect(await rewardToken.isMinter(user1.address)).to.be.false;
            });

            it("Should not allow removing non-existent minter", async function () {
                await expect(
                    rewardToken.removeMinter(user1.address)
                ).to.be.revertedWith("RewardToken: minter does not exist");
            });
        });

        describe("Minting", function () {
            beforeEach(async function () {
                await rewardToken.addMinter(owner.address);
            });

            it("Should allow minter to mint tokens", async function () {
                await rewardToken.mint(user1.address, REWARD_AMOUNT);
                expect(await rewardToken.balanceOf(user1.address)).to.equal(REWARD_AMOUNT);
            });

            it("Should not allow non-minter to mint", async function () {
                await expect(
                    rewardToken.connect(user1).mint(user1.address, REWARD_AMOUNT)
                ).to.be.revertedWith("RewardToken: caller is not a minter");
            });

            it("Should not allow minting to zero address", async function () {
                await expect(
                    rewardToken.mint(ethers.ZeroAddress, REWARD_AMOUNT)
                ).to.be.revertedWith("RewardToken: mint to zero address");
            });

            it("Should not allow minting zero amount", async function () {
                await expect(
                    rewardToken.mint(user1.address, 0)
                ).to.be.revertedWith("RewardToken: mint amount is zero");
            });
        });
    });

    describe("Verification", function () {
        describe("Deployment", function () {
            it("Should set the correct reward token", async function () {
                expect(await verification.rewardToken()).to.equal(
                    await rewardToken.getAddress()
                );
            });

            it("Should set the correct owner", async function () {
                expect(await verification.owner()).to.equal(owner.address);
            });

            it("Should not deploy with zero token address", async function () {
                const VerificationFactory = await ethers.getContractFactory("Verification");
                await expect(
                    VerificationFactory.deploy(ethers.ZeroAddress, owner.address)
                ).to.be.revertedWith("Verification: token address is zero");
            });
        });

        describe("Verifier Management", function () {
            it("Should allow owner to add verifier", async function () {
                await expect(verification.addVerifier(user1.address))
                    .to.emit(verification, "VerifierAdded")
                    .withArgs(user1.address);

                expect(await verification.isAuthorizedVerifier(user1.address)).to.be.true;
            });

            it("Should not allow non-owner to add verifier", async function () {
                await expect(
                    verification.connect(user1).addVerifier(user2.address)
                ).to.be.revertedWithCustomError(verification, "OwnableUnauthorizedAccount");
            });

            it("Should not allow adding zero address as verifier", async function () {
                await expect(
                    verification.addVerifier(ethers.ZeroAddress)
                ).to.be.revertedWith("Verification: verifier is zero address");
            });

            it("Should not allow adding duplicate verifier", async function () {
                await verification.addVerifier(user1.address);
                await expect(
                    verification.addVerifier(user1.address)
                ).to.be.revertedWith("Verification: verifier already authorized");
            });

            it("Should allow owner to remove verifier", async function () {
                await verification.addVerifier(user1.address);

                await expect(verification.removeVerifier(user1.address))
                    .to.emit(verification, "VerifierRemoved")
                    .withArgs(user1.address);

                expect(await verification.isAuthorizedVerifier(user1.address)).to.be.false;
            });

            it("Should not allow removing non-existent verifier", async function () {
                await expect(
                    verification.removeVerifier(user1.address)
                ).to.be.revertedWith("Verification: verifier not authorized");
            });
        });

        describe("Verify and Reward", function () {
            let verdict: any;
            let signature: string;

            beforeEach(async function () {
                const timestamp = await time.latest();
                verdict = {
                    postCid: "QmTest123456789",
                    isEco: true,
                    confidence: 85n,
                    timestamp: BigInt(timestamp),
                    nonce: 1n,
                    wallet: user1.address,
                };

                signature = await verifier.signTypedData(domain, types, verdict);
            });

            describe("Valid Verdicts", function () {
                it("Should verify valid verdict and mint rewards", async function () {
                    const tx = await verification.verifyAndReward(verdict, signature);
                    const receipt = await tx.wait();

                    // Check events were emitted
                    const postVerifiedEvent = receipt.logs.find(
                        (log: any) => {
                            try {
                                const parsed = verification.interface.parseLog(log);
                                return parsed?.name === "PostVerified";
                            } catch {
                                return false;
                            }
                        }
                    );

                    const rewardMintedEvent = receipt.logs.find(
                        (log: any) => {
                            try {
                                const parsed = verification.interface.parseLog(log);
                                return parsed?.name === "RewardMinted";
                            } catch {
                                return false;
                            }
                        }
                    );

                    expect(postVerifiedEvent).to.not.be.undefined;
                    expect(rewardMintedEvent).to.not.be.undefined;
                    expect(await rewardToken.balanceOf(user1.address)).to.equal(REWARD_AMOUNT);
                });

                it("Should mark nonce as used", async function () {
                    await verification.verifyAndReward(verdict, signature);
                    expect(await verification.usedNonces(verdict.nonce)).to.be.true;
                });

                it("Should mark post as rewarded", async function () {
                    await verification.verifyAndReward(verdict, signature);
                    expect(await verification.isPostRewarded(verdict.postCid)).to.be.true;
                });

                it("Should update last reward time", async function () {
                    await verification.verifyAndReward(verdict, signature);
                    const lastRewardTime = await verification.lastRewardTime(user1.address);
                    expect(lastRewardTime).to.be.greaterThan(0);
                });
            });

            describe("Signature Validation", function () {
                it("Should reject verdict with unauthorized signer", async function () {
                    const badSignature = await unauthorized.signTypedData(domain, types, verdict);

                    await expect(
                        verification.verifyAndReward(verdict, badSignature)
                    ).to.be.revertedWith("Verification: signer not authorized");
                });

                it("Should reject verdict with bad signature", async function () {
                    const badSignature = "0x" + "00".repeat(65);

                    await expect(
                        verification.verifyAndReward(verdict, badSignature)
                    ).to.be.reverted;
                });

                it("Should reject verdict with modified data", async function () {
                    const modifiedVerdict = { ...verdict, confidence: 90n };

                    await expect(
                        verification.verifyAndReward(modifiedVerdict, signature)
                    ).to.be.revertedWith("Verification: signer not authorized");
                });
            });

            describe("Verdict Rules", function () {
                it("Should reject non-eco verdict", async function () {
                    const nonEcoVerdict = { ...verdict, isEco: false };
                    const nonEcoSignature = await verifier.signTypedData(
                        domain,
                        types,
                        nonEcoVerdict
                    );

                    await expect(
                        verification.verifyAndReward(nonEcoVerdict, nonEcoSignature)
                    ).to.be.revertedWith("Verification: post is not eco-friendly");
                });

                it("Should reject low confidence verdict", async function () {
                    const lowConfidenceVerdict = { ...verdict, confidence: 79n };
                    const lowConfSignature = await verifier.signTypedData(
                        domain,
                        types,
                        lowConfidenceVerdict
                    );

                    await expect(
                        verification.verifyAndReward(lowConfidenceVerdict, lowConfSignature)
                    ).to.be.revertedWith("Verification: confidence too low");
                });

                it("Should accept verdict with exactly MIN_CONFIDENCE", async function () {
                    const minConfVerdict = { ...verdict, confidence: MIN_CONFIDENCE };
                    const minConfSignature = await verifier.signTypedData(
                        domain,
                        types,
                        minConfVerdict
                    );

                    await verification.verifyAndReward(minConfVerdict, minConfSignature);
                    expect(await rewardToken.balanceOf(user1.address)).to.equal(REWARD_AMOUNT);
                });

                it("Should reject future timestamp", async function () {
                    const futureTime = (await time.latest()) + 3600;
                    const futureVerdict = { ...verdict, timestamp: BigInt(futureTime) };
                    const futureSignature = await verifier.signTypedData(
                        domain,
                        types,
                        futureVerdict
                    );

                    await expect(
                        verification.verifyAndReward(futureVerdict, futureSignature)
                    ).to.be.revertedWith("Verification: timestamp in future");
                });

                it("Should reject expired verdict (>1 hour old)", async function () {
                    const oldTime = (await time.latest()) - 3700; // 1 hour + 100 seconds
                    const oldVerdict = { ...verdict, timestamp: BigInt(oldTime) };
                    const oldSignature = await verifier.signTypedData(domain, types, oldVerdict);

                    await expect(
                        verification.verifyAndReward(oldVerdict, oldSignature)
                    ).to.be.revertedWith("Verification: verdict expired");
                });

                it("Should reject verdict with zero wallet address", async function () {
                    const zeroWalletVerdict = { ...verdict, wallet: ethers.ZeroAddress };
                    const zeroWalletSignature = await verifier.signTypedData(
                        domain,
                        types,
                        zeroWalletVerdict
                    );

                    await expect(
                        verification.verifyAndReward(zeroWalletVerdict, zeroWalletSignature)
                    ).to.be.revertedWith("Verification: wallet is zero address");
                });
            });

            describe("Replay Protection", function () {
                it("Should reject reused nonce", async function () {
                    await verification.verifyAndReward(verdict, signature);

                    // Try to reuse the same verdict and signature
                    await expect(
                        verification.verifyAndReward(verdict, signature)
                    ).to.be.revertedWith("Verification: nonce already used");
                });

                it("Should allow different nonces for same post from different users", async function () {
                    await verification.verifyAndReward(verdict, signature);

                    const verdict2 = {
                        ...verdict,
                        postCid: "QmDifferentPost",
                        nonce: 2n,
                        wallet: user2.address,
                    };
                    const signature2 = await verifier.signTypedData(domain, types, verdict2);

                    await verification.verifyAndReward(verdict2, signature2);
                    expect(await rewardToken.balanceOf(user2.address)).to.equal(REWARD_AMOUNT);
                });
            });

            describe("Anti-Spam: Post CID", function () {
                it("Should reject duplicate post CID", async function () {
                    await verification.verifyAndReward(verdict, signature);

                    // Try to reward the same post again with different nonce
                    const duplicateVerdict = { ...verdict, nonce: 2n };
                    const duplicateSignature = await verifier.signTypedData(
                        domain,
                        types,
                        duplicateVerdict
                    );

                    await expect(
                        verification.verifyAndReward(duplicateVerdict, duplicateSignature)
                    ).to.be.revertedWith("Verification: post already rewarded");
                });

                it("Should allow different posts to be rewarded", async function () {
                    await verification.verifyAndReward(verdict, signature);

                    await time.increase(COOLDOWN_PERIOD);

                    const verdict2 = {
                        ...verdict,
                        postCid: "QmDifferentPost123",
                        timestamp: BigInt(await time.latest()),
                        nonce: 2n,
                    };
                    const signature2 = await verifier.signTypedData(domain, types, verdict2);

                    await verification.verifyAndReward(verdict2, signature2);

                    expect(await rewardToken.balanceOf(user1.address)).to.equal(
                        REWARD_AMOUNT * 2n
                    );
                });
            });

            describe("Cooldown Period", function () {
                it("Should reject reward within cooldown period", async function () {
                    await verification.verifyAndReward(verdict, signature);

                    // Try to reward again immediately
                    const verdict2 = {
                        ...verdict,
                        postCid: "QmDifferentPost",
                        nonce: 2n,
                    };
                    const signature2 = await verifier.signTypedData(domain, types, verdict2);

                    await expect(
                        verification.verifyAndReward(verdict2, signature2)
                    ).to.be.revertedWith("Verification: wallet in cooldown period");
                });

                it("Should allow reward after cooldown period", async function () {
                    await verification.verifyAndReward(verdict, signature);

                    // Advance time by cooldown period
                    await time.increase(COOLDOWN_PERIOD);

                    const verdict2 = {
                        ...verdict,
                        postCid: "QmDifferentPost",
                        timestamp: BigInt(await time.latest()),
                        nonce: 2n,
                    };
                    const signature2 = await verifier.signTypedData(domain, types, verdict2);

                    await verification.verifyAndReward(verdict2, signature2);
                    expect(await rewardToken.balanceOf(user1.address)).to.equal(
                        REWARD_AMOUNT * 2n
                    );
                });

                it("Should track cooldown per wallet independently", async function () {
                    await verification.verifyAndReward(verdict, signature);

                    // User2 should be able to get reward immediately
                    const verdict2 = {
                        ...verdict,
                        postCid: "QmDifferentPost",
                        nonce: 2n,
                        wallet: user2.address,
                    };
                    const signature2 = await verifier.signTypedData(domain, types, verdict2);

                    await verification.verifyAndReward(verdict2, signature2);
                    expect(await rewardToken.balanceOf(user2.address)).to.equal(REWARD_AMOUNT);
                });

                it("Should return correct cooldown remaining time", async function () {
                    await verification.verifyAndReward(verdict, signature);

                    const remaining = await verification.getCooldownRemaining(user1.address);
                    expect(remaining).to.be.closeTo(BigInt(COOLDOWN_PERIOD), 5n);

                    await time.increase(COOLDOWN_PERIOD);
                    const remainingAfter = await verification.getCooldownRemaining(user1.address);
                    expect(remainingAfter).to.equal(0);
                });
            });

            describe("View Functions", function () {
                it("Should return correct domain separator", async function () {
                    const domainSeparator = await verification.getDomainSeparator();
                    expect(domainSeparator).to.be.properHex(64);
                    it("Should return correct digest for verdict", async function () {
                        const digest = await verification.getDigest(verdict);
                        expect(digest).to.be.properHex(64);
                        it("Should check if verifier is authorized", async function () {
                            expect(await verification.isAuthorizedVerifier(verifier.address)).to.be.true;
                            expect(await verification.isAuthorizedVerifier(unauthorized.address)).to.be
                                .false;
                        });

                        it("Should check if post is rewarded", async function () {
                            expect(await verification.isPostRewarded(verdict.postCid)).to.be.false;
                            await verification.verifyAndReward(verdict, signature);
                            expect(await verification.isPostRewarded(verdict.postCid)).to.be.true;
                        });
                    });
                });

                describe("Edge Cases", function () {
                    it("Should handle multiple users and posts correctly", async function () {
                        const timestamp = await time.latest();

                        // User1, Post1
                        const verdict1 = {
                            postCid: "QmPost1",
                            isEco: true,
                            confidence: 85n,
                            timestamp: BigInt(timestamp),
                            nonce: 1n,
                            wallet: user1.address,
                        };
                        const sig1 = await verifier.signTypedData(domain, types, verdict1);
                        await verification.verifyAndReward(verdict1, sig1);

                        // User2, Post2
                        const verdict2 = {
                            postCid: "QmPost2",
                            isEco: true,
                            confidence: 90n,
                            timestamp: BigInt(timestamp),
                            nonce: 2n,
                            wallet: user2.address,
                        };
                        const sig2 = await verifier.signTypedData(domain, types, verdict2);
                        await verification.verifyAndReward(verdict2, sig2);

                        expect(await rewardToken.balanceOf(user1.address)).to.equal(REWARD_AMOUNT);
                        expect(await rewardToken.balanceOf(user2.address)).to.equal(REWARD_AMOUNT);
                        expect(await rewardToken.totalSupply()).to.equal(REWARD_AMOUNT * 2n);
                    });

                    it("Should handle high confidence values", async function () {
                        const timestamp = await time.latest();
                        const verdict = {
                            postCid: "QmHighConf",
                            isEco: true,
                            confidence: 100n,
                            timestamp: BigInt(timestamp),
                            nonce: 100n,
                            wallet: user1.address,
                        };
                        const signature = await verifier.signTypedData(domain, types, verdict);

                        await verification.verifyAndReward(verdict, signature);
                        expect(await rewardToken.balanceOf(user1.address)).to.equal(REWARD_AMOUNT);
                    });

                    it("Should handle long post CIDs", async function () {
                        const timestamp = await time.latest();
                        const longCid = "Qm" + "a".repeat(100);
                        const verdict = {
                            postCid: longCid,
                            isEco: true,
                            confidence: 85n,
                            timestamp: BigInt(timestamp),
                            nonce: 200n,
                            wallet: user1.address,
                        };
                        const signature = await verifier.signTypedData(domain, types, verdict);

                        await verification.verifyAndReward(verdict, signature);
                        expect(await rewardToken.balanceOf(user1.address)).to.equal(REWARD_AMOUNT);
                    });
                });
            });
        });
    });
});