const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("HybridOrchestrationRouter", function () {
    async function deployRouterFixture() {
        const [owner, broadcaster] = await ethers.getSigners();

        // Deploy ChainRegistry
        const ChainRegistry = await ethers.getContractFactory("ChainRegistry");
        const chainRegistry = await ChainRegistry.deploy();
        await chainRegistry.waitForDeployment();

        // Deploy Router
        const mockEndpoint = ethers.ZeroAddress;
        const HybridOrchestrationRouter = await ethers.getContractFactory("HybridOrchestrationRouter");
        const router = await HybridOrchestrationRouter.deploy(
            mockEndpoint,
            owner.address,
            await chainRegistry.getAddress()
        );
        await router.waitForDeployment();

        // Register test chains
        await chainRegistry.registerChain(1, 30101); // Ethereum
        await chainRegistry.registerChain(42161, 30110); // Arbitrum

        return { router, chainRegistry, owner, broadcaster };
    }

    describe("Deployment", function () {
        it("Should deploy with correct parameters", async function () {
            const { router, chainRegistry } = await loadFixture(deployRouterFixture);

            expect(await router.chainRegistry()).to.equal(await chainRegistry.getAddress());
        });
    });

    describe("Native Bridge Registration", function () {
        it("Should allow owner to register native bridge", async function () {
            const { router, owner } = await loadFixture(deployRouterFixture);

            const chainId = 42161;
            const l1Bridge = ethers.Wallet.createRandom().address;
            const l2Bridge = ethers.Wallet.createRandom().address;

            await expect(
                router.connect(owner).registerNativeBridge(chainId, l1Bridge, l2Bridge)
            ).to.not.be.reverted;

            expect(await router.l1BridgeConnectors(chainId)).to.equal(l1Bridge);
            expect(await router.l2BridgeConnectors(chainId)).to.equal(l2Bridge);
        });

        it("Should reject non-owner from registering bridges", async function () {
            const { router, broadcaster } = await loadFixture(deployRouterFixture);

            const chainId = 42161;
            const l1Bridge = ethers.Wallet.createRandom().address;
            const l2Bridge = ethers.Wallet.createRandom().address;

            await expect(
                router.connect(broadcaster).registerNativeBridge(chainId, l1Bridge, l2Bridge)
            ).to.be.reverted;
        });

        it("Should reject zero address bridges", async function () {
            const { router, owner } = await loadFixture(deployRouterFixture);

            const chainId = 42161;

            await expect(
                router.connect(owner).registerNativeBridge(chainId, ethers.ZeroAddress, ethers.Wallet.createRandom().address)
            ).to.be.revertedWith("Invalid L1 bridge");

            await expect(
                router.connect(owner).registerNativeBridge(chainId, ethers.Wallet.createRandom().address, ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid L2 bridge");
        });
    });

    describe("Message Receiver", function () {
        it("Should allow owner to set message receiver", async function () {
            const { router, owner } = await loadFixture(deployRouterFixture);

            const receiver = ethers.Wallet.createRandom().address;

            await expect(
                router.connect(owner).setMessageReceiver(receiver)
            ).to.not.be.reverted;

            expect(await router.messageReceiver()).to.equal(receiver);
        });

        it("Should reject zero address receiver", async function () {
            const { router, owner } = await loadFixture(deployRouterFixture);

            await expect(
                router.connect(owner).setMessageReceiver(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid receiver");
        });
    });
});

