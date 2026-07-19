import { expect } from "chai"
import { ethers } from "hardhat"
import { time } from "@nomicfoundation/hardhat-network-helpers"
import { EcoDAO, RewardToken } from "../typechain-types"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"

describe("EcoDAO", () => {
    let rewardToken: RewardToken
    let dao: EcoDAO
    let owner: HardhatEthersSigner
    let proposer: HardhatEthersSigner
    let voter1: HardhatEthersSigner
    let voter2: HardhatEthersSigner

    const PROPOSAL_BURN  = ethers.parseEther("25")
    const PROPOSAL_STAKE = ethers.parseEther("25")
    const PROPOSAL_TOTAL = ethers.parseEther("50")
    const VOTING_PERIOD  = 7 * 24 * 3600  // 7 days in seconds

    beforeEach(async () => {
        ;[owner, proposer, voter1, voter2] = await ethers.getSigners()

        const TokenFactory = await ethers.getContractFactory("RewardToken")
        rewardToken = await TokenFactory.deploy(owner.address)

        const DAOFactory = await ethers.getContractFactory("EcoDAO")
        dao = await DAOFactory.deploy(await rewardToken.getAddress(), owner.address)

        // Mint ECO for all actors
        await rewardToken.addMinter(owner.address)
        await rewardToken.mint(proposer.address, ethers.parseEther("1000"))
        await rewardToken.mint(voter1.address,   ethers.parseEther("100"))
        await rewardToken.mint(voter2.address,   ethers.parseEther("400"))

        // Approve DAO to spend
        await rewardToken.connect(proposer).approve(await dao.getAddress(), ethers.MaxUint256)
        await rewardToken.connect(voter1).approve(await dao.getAddress(), ethers.MaxUint256)
        await rewardToken.connect(voter2).approve(await dao.getAddress(), ethers.MaxUint256)
    })

    // Helper: create a proposal
    async function createProposal(title = "Test Proposal", cid = "QmDesc1") {
        const tx = await dao.connect(proposer).createProposal(title, cid)
        const receipt = await tx.wait()
        const event = receipt?.logs
            .map(l => { try { return dao.interface.parseLog(l) } catch { return null } })
            .find(e => e?.name === "ProposalCreated")
        return Number(event?.args[0] ?? 0)
    }

    describe("createProposal", () => {
        it("burns 25 ECO and stakes 25 ECO", async () => {
            const balBefore = await rewardToken.balanceOf(proposer.address)
            const stakeBefore = await rewardToken.balanceOf(await dao.getAddress())

            await createProposal()

            const balAfter = await rewardToken.balanceOf(proposer.address)
            const stakeAfter = await rewardToken.balanceOf(await dao.getAddress())

            expect(balBefore - balAfter).to.equal(PROPOSAL_TOTAL)    // 50 ECO total spent
            expect(stakeAfter - stakeBefore).to.equal(PROPOSAL_STAKE) // 25 ECO held in contract
        })

        it("emits ProposalCreated with correct args", async () => {
            await expect(dao.connect(proposer).createProposal("My Proposal", "QmDesc2"))
                .to.emit(dao, "ProposalCreated")
                .withArgs(0, proposer.address, "My Proposal", (v: bigint) => v > 0n)
        })

        it("initializes proposal state as Active", async () => {
            const id = await createProposal()
            const proposal = await dao.getProposal(id)
            expect(proposal.state).to.equal(0) // ProposalState.Active = 0
        })

        it("reverts with empty title", async () => {
            await expect(
                dao.connect(proposer).createProposal("", "QmDesc3")
            ).to.be.revertedWith("DAO: empty title")
        })

        it("reverts with empty descriptionCid", async () => {
            await expect(
                dao.connect(proposer).createProposal("Title", "")
            ).to.be.revertedWith("DAO: empty description")
        })

        it("reverts if proposer has insufficient ECO", async () => {
            const bal = await rewardToken.balanceOf(voter1.address)
            // voter1 only has 100 ECO but needs 50 — should work
            // Drain their balance first
            await rewardToken.connect(voter1).transfer(owner.address, bal)
            await expect(
                dao.connect(voter1).createProposal("No Funds", "QmEmpty")
            ).to.be.reverted
        })
    })

    describe("vote", () => {
        let proposalId: number

        beforeEach(async () => {
            proposalId = await createProposal()
        })

        it("records a 'for' vote with quadratic weight", async () => {
            // voter1 has 100 ECO → sqrt(100) = 10 votes
            await expect(dao.connect(voter1).vote(proposalId, true))
                .to.emit(dao, "Voted")
                .withArgs(proposalId, voter1.address, true, 10n)

            const proposal = await dao.getProposal(proposalId)
            expect(proposal.forVotes).to.equal(10n)
        })

        it("records an 'against' vote correctly", async () => {
            // voter2 has 400 ECO → sqrt(400) = 20 votes
            await dao.connect(voter2).vote(proposalId, false)
            const proposal = await dao.getProposal(proposalId)
            expect(proposal.againstVotes).to.equal(20n)
        })

        it("quadratic weight: sqrt(balance) rounded down", async () => {
            // 100 ECO → sqrt(100) = 10; 400 ECO → sqrt(400) = 20
            await dao.connect(voter1).vote(proposalId, true)
            await dao.connect(voter2).vote(proposalId, true)
            const proposal = await dao.getProposal(proposalId)
            expect(proposal.forVotes).to.equal(30n) // 10 + 20
        })

        it("reverts on double vote", async () => {
            await dao.connect(voter1).vote(proposalId, true)
            await expect(
                dao.connect(voter1).vote(proposalId, true)
            ).to.be.revertedWith("DAO: already voted")
        })

        it("reverts after voting period ends", async () => {
            await time.increase(VOTING_PERIOD + 1)
            await expect(
                dao.connect(voter1).vote(proposalId, true)
            ).to.be.revertedWith("DAO: voting ended")
        })

        it("reverts for invalid proposal ID", async () => {
            await expect(
                dao.connect(voter1).vote(999, true)
            ).to.be.revertedWith("DAO: invalid proposal")
        })
    })

    describe("finalizeProposal", () => {
        let proposalId: number

        beforeEach(async () => {
            proposalId = await createProposal()
        })

        it("passes when forVotes > againstVotes", async () => {
            await dao.connect(voter2).vote(proposalId, true)   // 20 votes for
            await dao.connect(voter1).vote(proposalId, false)  // 10 votes against
            await time.increase(VOTING_PERIOD + 1)

            await expect(dao.finalizeProposal(proposalId))
                .to.emit(dao, "ProposalFinalized")
                .withArgs(proposalId, 1) // ProposalState.Passed = 1
        })

        it("rejects when againstVotes >= forVotes", async () => {
            await dao.connect(voter1).vote(proposalId, true)   // 10 for
            await dao.connect(voter2).vote(proposalId, false)  // 20 against
            await time.increase(VOTING_PERIOD + 1)

            await expect(dao.finalizeProposal(proposalId))
                .to.emit(dao, "ProposalFinalized")
                .withArgs(proposalId, 2) // ProposalState.Rejected = 2
        })

        it("returns staked ECO to proposer on finalization", async () => {
            await time.increase(VOTING_PERIOD + 1)
            const balBefore = await rewardToken.balanceOf(proposer.address)
            await dao.finalizeProposal(proposalId)
            const balAfter = await rewardToken.balanceOf(proposer.address)
            expect(balAfter - balBefore).to.equal(PROPOSAL_STAKE)
        })

        it("reverts if voting period has not ended", async () => {
            await expect(
                dao.finalizeProposal(proposalId)
            ).to.be.revertedWith("DAO: still voting")
        })

        it("reverts if already finalized", async () => {
            await time.increase(VOTING_PERIOD + 1)
            await dao.finalizeProposal(proposalId)
            await expect(
                dao.finalizeProposal(proposalId)
            ).to.be.revertedWith("DAO: not active")
        })
    })

    describe("executeProposal", () => {
        it("owner can execute a passed proposal", async () => {
            const id = await createProposal()
            await dao.connect(voter2).vote(id, true)
            await time.increase(VOTING_PERIOD + 1)
            await dao.finalizeProposal(id)

            await expect(dao.connect(owner).executeProposal(id))
                .to.emit(dao, "ProposalExecuted")
                .withArgs(id)

            const proposal = await dao.getProposal(id)
            expect(proposal.state).to.equal(3) // ProposalState.Executed = 3
        })

        it("reverts if proposal not passed", async () => {
            const id = await createProposal()
            await time.increase(VOTING_PERIOD + 1)
            await dao.finalizeProposal(id)
            // Proposal was rejected (no votes)
            await expect(
                dao.connect(owner).executeProposal(id)
            ).to.be.revertedWith("DAO: not passed")
        })

        it("reverts if called by non-owner", async () => {
            const id = await createProposal()
            await dao.connect(voter2).vote(id, true)
            await time.increase(VOTING_PERIOD + 1)
            await dao.finalizeProposal(id)
            await expect(
                dao.connect(voter1).executeProposal(id)
            ).to.be.reverted
        })
    })

    describe("view functions", () => {
        it("getProposalCount returns correct count", async () => {
            expect(await dao.getProposalCount()).to.equal(0)
            await createProposal("P1", "QmA")
            await createProposal("P2", "QmB")
            expect(await dao.getProposalCount()).to.equal(2)
        })

        it("getActiveProposals returns only active IDs", async () => {
            const id1 = await createProposal("Active1", "QmC")
            const id2 = await createProposal("Active2", "QmD")

            // Finalize id1
            await time.increase(VOTING_PERIOD + 1)
            await dao.finalizeProposal(id1)

            // Only id2 is still active
            const active = await dao.getActiveProposals()
            expect(active.map(Number)).to.not.include(id1)
            expect(active.map(Number)).to.include(id2)
        })

        it("totalBurned tracks burned ECO from proposals", async () => {
            await createProposal("P1", "QmE")
            await createProposal("P2", "QmF")
            const burned = await dao.totalBurned()
            expect(burned).to.equal(PROPOSAL_BURN * 2n)
        })
    })
})
