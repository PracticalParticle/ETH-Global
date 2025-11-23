/**
 * Test Runner for EnterpriseCrossChainMessenger Sanity Tests
 */

const MessageCancellationTests = require("./message-cancellation-tests");

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
            success = await cancellationTests.runTest();
            
            if (!success && testSuite === "--all") {
                console.log("\n⚠️  Some tests failed, but continuing with other suites...\n");
            }
        }

        if (testSuite === "--all") {
            // Add more test suites here as they are created
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
    console.log("\nExamples:");
    console.log("  node run-tests.js --all");
    console.log("  node run-tests.js --cancellation");
    process.exit(0);
}

runTests();

