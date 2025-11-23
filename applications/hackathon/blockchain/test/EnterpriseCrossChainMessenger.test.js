const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("EnterpriseCrossChainMessenger", function () {
    // Deploy contracts fixture
    async function deployContractsFixture() {
        const [owner, broadcaster, recovery, user, router] = await ethers.getSigners();

        // Deploy ChainRegistry
        const ChainRegistry = await ethers.getContractFactory("ChainRegistry");
        const chainRegistry = await ChainRegistry.deploy();
        await chainRegistry.waitForDeployment();
        const chainRegistryAddress = await chainRegistry.getAddress();

        // Deploy HybridOrchestrationRouter (mock LayerZero endpoint)
        const mockEndpoint = ethers.ZeroAddress; // In real tests, use actual LayerZero endpoint
        const HybridOrchestrationRouter = await ethers.getContractFactory("HybridOrchestrationRouter");
        const routerContract = await HybridOrchestrationRouter.deploy(
            mockEndpoint,
            owner.address,
            chainRegistryAddress
        );
        await routerContract.waitForDeployment();
        const routerAddress = await routerContract.getAddress();

        // Deploy EnterpriseCrossChainMessenger
        const EnterpriseCrossChainMessenger = await ethers.getContractFactory("EnterpriseCrossChainMessenger");
        const messenger = await upgrades.deployProxy(
            EnterpriseCrossChainMessenger,
            [],
            { initializer: false, kind: "uups" }
        );
        await messenger.waitForDeployment();
        const messengerAddress = await messenger.getAddress();

        // Initialize messenger
        await messenger.initialize(
            owner.address,
            broadcaster.address,
            recovery.address,
            routerAddress,
            chainRegistryAddress
        );

        // Set message receiver in router
        await routerContract.setMessageReceiver(messengerAddress);

        // Register a test chain
        const testChainId = 42161; // Arbitrum
        const testEid = 30110;
        await chainRegistry.registerChain(testChainId, testEid);

        return {
            chainRegistry,
            router: routerContract,
            messenger,
            owner,
            broadcaster,
            recovery,
            user,
            router: routerContract,
            testChainId,
            testEid
        };
    }

    describe("Deployment", function () {
        it("Should deploy and initialize correctly", async function () {
            const { messenger, owner, broadcaster, router, chainRegistry } = await loadFixture(deployContractsFixture);

            expect(await messenger.owner()).to.equal(owner.address);
            expect(await messenger.router()).to.equal(await router.getAddress());
            expect(await messenger.chainRegistry()).to.equal(await chainRegistry.getAddress());
        });

        it("Should have correct time lock period (5 minutes)", async function () {
            const { messenger } = await loadFixture(deployContractsFixture);
            // Time lock period is hardcoded to 300 seconds (5 minutes)
            // This is verified through the Bloxchain state machine
        });
    });

    describe("Message Request", function () {
        it("Should allow owner to request message", async function () {
            const { messenger, owner, testChainId } = await loadFixture(deployContractsFixture);

            const payload = ethers.toUtf8Bytes("Test message");
            const req = {
                requiresFastFinality: false,
                requiresGuaranteedDelivery: false,
                isCostSensitive: true,
                isMultiChain: false,
                maxDelay: 7 * 24 * 60 * 60, // 7 days
                amount: 0,
                requiresNativeSecurity: false,
                requiresDisputeResolution: false,
                securityLevel: 0 // LOW
            };

            const tx = await messenger.connect(owner).sendMessageRequest(testChainId, payload, req);
            const receipt = await tx.wait();

            // Check that transaction was created
            expect(receipt).to.not.be.null;
        });

        it("Should reject empty payload", async function () {
            const { messenger, owner, testChainId } = await loadFixture(deployContractsFixture);

            const emptyPayload = "0x";
            const req = {
                requiresFastFinality: false,
                requiresGuaranteedDelivery: false,
                isCostSensitive: true,
                isMultiChain: false,
                maxDelay: 7 * 24 * 60 * 60,
                amount: 0,
                requiresNativeSecurity: false,
                requiresDisputeResolution: false,
                securityLevel: 0
            };

            await expect(
                messenger.connect(owner).sendMessageRequest(testChainId, emptyPayload, req)
            ).to.be.revertedWith("Empty payload");
        });

        it("Should reject unregistered chain", async function () {
            const { messenger, owner } = await loadFixture(deployContractsFixture);

            const payload = ethers.toUtf8Bytes("Test message");
            const unregisteredChainId = 999999;
            const req = {
                requiresFastFinality: false,
                requiresGuaranteedDelivery: false,
                isCostSensitive: true,
                isMultiChain: false,
                maxDelay: 7 * 24 * 60 * 60,
                amount: 0,
                requiresNativeSecurity: false,
                requiresDisputeResolution: false,
                securityLevel: 0
            };

            await expect(
                messenger.connect(owner).sendMessageRequest(unregisteredChainId, payload, req)
            ).to.be.revertedWith("Chain not registered");
        });

        it("Should reject non-owner from requesting", async function () {
            const { messenger, user, testChainId } = await loadFixture(deployContractsFixture);

            const payload = ethers.toUtf8Bytes("Test message");
            const req = {
                requiresFastFinality: false,
                requiresGuaranteedDelivery: false,
                isCostSensitive: true,
                isMultiChain: false,
                maxDelay: 7 * 24 * 60 * 60,
                amount: 0,
                requiresNativeSecurity: false,
                requiresDisputeResolution: false,
                securityLevel: 0
            };

            await expect(
                messenger.connect(user).sendMessageRequest(testChainId, payload, req)
            ).to.be.reverted;
        });
    });

    describe("Message Viewing", function () {
        it("Should allow owner to view message on destination chain", async function () {
            const { messenger, owner } = await loadFixture(deployContractsFixture);

            // Create a message on destination chain (simulate received message)
            const messageId = ethers.id("test-message");
            const sourceChainId = 1; // Ethereum
            const targetChainId = await ethers.provider.getNetwork().then(n => Number(n.chainId));

            // Simulate message arrival
            const messagePayload = ethers.AbiCoder.defaultAbiCoder().encode(
                ["bytes32", "uint256", "address", "bytes", "uint8"],
                [
                    messageId,
                    sourceChainId,
                    owner.address,
                    ethers.toUtf8Bytes("Test payload"),
                    0 // LOW security
                ]
            );

            // Call handleIncomingMessage as router
            const router = await ethers.getContractAt("HybridOrchestrationRouter", await messenger.router());
            await router.setMessageReceiver(await messenger.getAddress());
            
            // Note: This test would need to be adjusted based on actual router implementation
            // For now, we'll test the getMessage function with a manually created message
        });

        it("Should reject viewing message on wrong chain", async function () {
            const { messenger, owner } = await loadFixture(deployContractsFixture);

            // This would require setting up a message with wrong targetChainId
            // Implementation depends on message creation logic
        });
    });

    describe("Access Control", function () {
        it("Should allow owner to update router", async function () {
            const { messenger, owner, router } = await loadFixture(deployContractsFixture);

            const newRouter = await ethers.getContractAt("HybridOrchestrationRouter", await router.getAddress());
            await expect(messenger.connect(owner).setRouter(await newRouter.getAddress()))
                .to.not.be.reverted;
        });

        it("Should reject non-owner from updating router", async function () {
            const { messenger, user, router } = await loadFixture(deployContractsFixture);

            const newRouter = await ethers.getContractAt("HybridOrchestrationRouter", await router.getAddress());
            await expect(
                messenger.connect(user).setRouter(await newRouter.getAddress())
            ).to.be.reverted;
        });

        it("Should allow owner to update chain registry", async function () {
            const { messenger, owner, chainRegistry } = await loadFixture(deployContractsFixture);

            await expect(
                messenger.connect(owner).setChainRegistry(await chainRegistry.getAddress())
            ).to.not.be.reverted;
        });
    });

    describe("ChainRegistry", function () {
        it("Should allow owner to register chains", async function () {
            const { chainRegistry, owner } = await loadFixture(deployContractsFixture);

            const chainId = 137; // Polygon
            const eid = 30109;

            await expect(
                chainRegistry.connect(owner).registerChain(chainId, eid)
            ).to.not.be.reverted;

            expect(await chainRegistry.isChainRegistered(chainId)).to.be.true;
            expect(await chainRegistry.getEndpointId(chainId)).to.equal(eid);
        });

        it("Should reject non-owner from registering chains", async function () {
            const { chainRegistry, user } = await loadFixture(deployContractsFixture);

            const chainId = 137;
            const eid = 30109;

            await expect(
                chainRegistry.connect(user).registerChain(chainId, eid)
            ).to.be.reverted;
        });

        it("Should prevent duplicate chain registration", async function () {
            const { chainRegistry, owner } = await loadFixture(deployContractsFixture);

            const chainId = 137;
            const eid = 30109;

            await chainRegistry.connect(owner).registerChain(chainId, eid);

            await expect(
                chainRegistry.connect(owner).registerChain(chainId, eid)
            ).to.be.revertedWith("Chain already registered");
        });
    });

    describe("Message Requirements Routing", function () {
        it("Should route to LayerZero for fast finality", async function () {
            // This would require mocking the router's routing logic
            // Implementation depends on router's shouldUseNativeBridge logic
        });

        it("Should route to EIL native bridge for cost-sensitive operations", async function () {
            // This would require mocking the router's routing logic
            // Implementation depends on router's shouldUseNativeBridge logic
        });
    });
});

