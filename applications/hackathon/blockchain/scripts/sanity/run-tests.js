/**
 * Test Runner for EnterpriseCrossChainMessenger Sanity Tests
 */

const MessageCancellationTests = require("./message-cancellation-tests");
const MessageMetaTxApprovalTests = require("./message-meta-tx-approval-tests");

// Parse command line arguments
const args = process.argv.slice(2);
const testSuite = args[0] || "--all";

async function runTests() {
    console.log("🧪 ENTERPRISE CROSS-CHAIN MESSENGER SANITY TESTS");
    console.log("=".repeat(60));
    console.log(`📋 Test Suite: ${testSuite}`);
    console.log("=".repeat(60) + "\n");

    let success = false;

    try {
        if (testSuite === "--all" || testSuite === "--cancellation") {
            console.log("🚀 Running Message Cancellation Tests...\n");
            const cancellationTests = new MessageCancellationTests();
            const cancellationSuccess = await cancellationTests.runTest();
            
            if (!cancellationSuccess && testSuite === "--all") {
                console.log("\n⚠️  Cancellation tests failed, but continuing with other suites...\n");
            }
            success = cancellationSuccess;
        }

        if (testSuite === "--all" || testSuite === "--meta-tx") {
            console.log("🚀 Running Message Meta-Transaction Approval Tests...\n");
            const metaTxTests = new MessageMetaTxApprovalTests();
            const metaTxSuccess = await metaTxTests.runTest();
            
            if (!metaTxSuccess && testSuite === "--all") {
                console.log("\n⚠️  Meta-transaction tests failed, but continuing with other suites...\n");
            }
            // For --all, success is true only if all tests pass
            if (testSuite === "--all") {
                success = success && metaTxSuccess;
            } else {
                success = metaTxSuccess;
            }
        }

        if (testSuite === "--all") {
            console.log("\n✅ All test suites completed");
        }

        process.exit(success ? 0 : 1);

    } catch (error) {
        console.error("\n❌ Test runner failed:", error.message);
        if (error.stack) {
            console.error("Stack:", error.stack);
        }
        process.exit(1);
    }
}

// Show usage if help requested
if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: node run-tests.js [test-suite]");
    console.log("\nAvailable test suites:");
    console.log("  --all          Run all test suites");
    console.log("  --cancellation Run message cancellation tests");
    console.log("  --meta-tx       Run message meta-transaction approval tests");
    console.log("\nExamples:");
    console.log("  node run-tests.js --all");
    console.log("  node run-tests.js --cancellation");
    console.log("  node run-tests.js --meta-tx");
    process.exit(0);
}

runTests();

