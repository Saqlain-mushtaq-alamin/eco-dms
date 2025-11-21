import { ethers } from "hardhat";

async function main() {
    const Factory = await ethers.getContractFactory("ProfileRegistry");
    const contract = await Factory.deploy();
    await contract.waitForDeployment();
    console.log("ProfileRegistry deployed:", await contract.getAddress());
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});