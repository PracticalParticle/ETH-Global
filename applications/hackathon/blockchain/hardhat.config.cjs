require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

const path = require("path");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.25",
        settings: {
            optimizer: {
                enabled: true,
                runs: 1  // Minimal optimization to reduce bytecode size
            },
            viaIR: true  // Use IR-based codegen which can produce smaller bytecode
        }
    },
    networks: {
        hardhat: {
            chainId: 31337
        },
        localhost: {
            url: "http://127.0.0.1:8545",
            chainId: 31337
        },
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 11155111
        },
        arbitrum: {
            url: process.env.ARBITRUM_RPC_URL || "",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 42161
        },
        arbitrumSepolia: {
            url: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 421614
        },
        optimism: {
            url: process.env.OPTIMISM_RPC_URL || "",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 10
        }
    },
    etherscan: {
        apiKey: {
            sepolia: process.env.ETHERSCAN_API_KEY || "",
            arbitrumOne: process.env.ARBISCAN_API_KEY || "",
            optimisticEthereum: process.env.OPTIMISTIC_ETHERSCAN_API_KEY || ""
        }
    },
    paths: {
        sources: path.resolve(__dirname, "./contracts"),
        tests: path.resolve(__dirname, "./test"),
        cache: path.resolve(__dirname, "./cache"),
        artifacts: path.resolve(__dirname, "./artifacts"),
        root: path.resolve(__dirname, "../../..")
    },
    // Allow imports from parent directories (for Bloxchain contracts)
    allowUnlimitedContractSize: true
};

