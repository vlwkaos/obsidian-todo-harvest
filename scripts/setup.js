#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

const arg = process.argv[2];
if (!arg) {
	console.error('Usage: npm run setup -- <vault-name>');
	process.exit(1);
}

const root = path.resolve(__dirname, '..');

try {
	console.log('Building…');
	execSync('node esbuild.config.mjs production', { cwd: root, stdio: 'inherit' });
} catch {
	console.error('Build failed.');
	process.exit(1);
}

try {
	console.log('Linking…');
	execSync(`node scripts/link-to-vault.js ${JSON.stringify(arg)}`, { cwd: root, stdio: 'inherit' });
} catch {
	console.error(`Link failed.`);
	process.exit(1);
}
