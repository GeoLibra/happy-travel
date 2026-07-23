import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs, resolveImpact } from './resolve-impact.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

function getGitDiffFiles(base, head) {
  try {
    const cmd = base && head ? ['diff', '--name-only', base, head] : ['diff', '--name-only', 'HEAD'];
    const proc = spawnSync('git', cmd, { cwd: rootDir, encoding: 'utf8' });
    if (proc.status === 0 && proc.stdout) {
      return proc.stdout.split('\n').map((f) => f.trim()).filter(Boolean);
    }
  } catch (err) {
    console.warn('Could not retrieve git diff files:', err.message);
  }
  return [];
}

export function runImpactTests() {
  const { files: inputFiles, all, base, head } = parseArgs(process.argv.slice(2));

  let files = inputFiles;
  if (!all && files.length === 0) {
    files = getGitDiffFiles(base, head);
  }

  const selection = resolveImpact({ files, all });

  console.log('=== Impact Resolver Output ===');
  console.log(`Full Suite: ${selection.full}`);
  console.log(`Unit Suites: ${selection.unit.join(', ') || 'none'}`);
  console.log(`Asset Suites: ${selection.assets.join(', ') || 'none'}`);
  console.log(`E2E Suites: ${selection.e2e.join(', ') || 'none'}`);
  console.log(`Memory Suites: ${selection.memory.join(', ') || 'none'}`);
  console.log(`Reasons:\n  - ${selection.reasons.join('\n  - ')}`);

  let hasFailure = false;

  // 1. Run Unit Tests
  if (selection.unit.length > 0) {
    console.log(`\n>>> Executing Unit Tests: ${selection.unit.join(' ')} <<<`);
    const vitestCliPath = path.join(rootDir, 'node_modules/vitest/vitest.mjs');
    const proc = spawnSync('node', [vitestCliPath, 'run', ...selection.unit], {
      cwd: rootDir,
      stdio: 'inherit',
      shell: false,
    });
    if (proc.status !== 0) {
      hasFailure = true;
      console.error('Unit tests failed.');
    }
  } else {
    console.log('\n>>> Skipping Unit Tests (No impacted unit suites) <<<');
  }

  // 2. Run Asset Validators
  if (selection.assets.length > 0) {
    console.log(`\n>>> Executing Asset Validators: ${selection.assets.join(' ')} <<<`);
    for (const group of selection.assets) {
      const proc = spawnSync('node', ['scripts/ci/run-asset-validators.mjs', '--group', group], {
        cwd: rootDir,
        stdio: 'inherit',
        shell: false,
      });
      if (proc.status !== 0) {
        hasFailure = true;
        console.error(`Asset validator group '${group}' failed.`);
      }
    }
  } else {
    console.log('\n>>> Skipping Asset Validators (No impacted asset suites) <<<');
  }

  if (hasFailure) {
    console.error('\n=== Impact Tests Failed ===');
    process.exit(1);
  }

  console.log('\n=== Impact Tests Completed Successfully ===');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runImpactTests();
}
