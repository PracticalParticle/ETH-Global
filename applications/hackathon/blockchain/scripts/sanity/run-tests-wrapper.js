/**
 * Wrapper script to run tests with Hardhat
 * Sets environment variable and calls Hardhat
 */

const { spawn } = require('child_process');
const path = require('path');

// Get test suite from command line
const testSuite = process.argv[2] || '--all';
process.env.TEST_SUITE = testSuite;

// Get network from command line or default to sepolia
const networkIndex = process.argv.indexOf('--network');
const network = networkIndex !== -1 && process.argv[networkIndex + 1] 
    ? process.argv[networkIndex + 1] 
    : 'sepolia';

// Use npx to run hardhat (avoids path issues)
const args = ['hardhat', 'run', 'scripts/sanity/run-tests.js', '--network', network];

console.log(`🚀 Running tests with suite: ${testSuite}, network: ${network}`);

// Spawn Hardhat process using npx
const hardhat = spawn('npx', args, {
    stdio: 'inherit',
    shell: true,
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env, TEST_SUITE: testSuite }
});

hardhat.on('close', (code) => {
    process.exit(code);
});

hardhat.on('error', (err) => {
    console.error('Failed to start Hardhat:', err);
    process.exit(1);
});

