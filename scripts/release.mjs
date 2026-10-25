// Gets a Chrome Web Store release ready: checks, then dist/webling-<version>.zip. Run: npm run release
// It never uploads or tags anything; store/RELEASE.md has the steps that follow.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkExtension, extensionZip } from './zip.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const problems = [], notes = [];

const manifest = checkExtension();
const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8'));
const { version } = manifest;
if (pkg.version !== version) problems.push(`package.json says ${pkg.version}, manifest.json says ${version}`);
if (git('tag', '--list', `v${version}`)) problems.push(`v${version} is already tagged: bump "version" in extension/manifest.json and package.json`);
if (git('status', '--porcelain')) problems.push('uncommitted changes: commit them so the zip matches a commit');
if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') notes.push('not on main');

const config = readFileSync(`${root}extension/shared/config.js`, 'utf8');
notes.push(/presenceUrl: ''/.test(config) ? 'presence is off (what the listing and privacy policy say)' : 'presence is ON: the listing and privacy policy must say so');
if (/devInstall|chrome-shim/.test(readFileSync(`${root}extension/background.js`, 'utf8'))) problems.push('dev-only code in background.js');

console.log(`Webling ${version}\n`);
try {
  execFileSync('npm', ['run', 'test:unit', '--silent'], { cwd: root, stdio: 'ignore' });
  console.log('✓ unit tests');
} catch {
  problems.push('unit tests fail: npm run test:unit');
}

for (const n of notes) console.log(`• ${n}`);
if (problems.length) {
  for (const p of problems) console.log(`✗ ${p}`);
  process.exit(1);
}
mkdirSync(`${root}dist`, { recursive: true });
const out = `dist/webling-${version}.zip`;
writeFileSync(`${root}${out}`, extensionZip());
console.log(`✓ ${out}

Next (store/RELEASE.md):
  1. Upload ${out} at https://chrome.google.com/webstore/devconsole
  2. Once it's submitted: git tag v${version} && git push origin v${version}`);
