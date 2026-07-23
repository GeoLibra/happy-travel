import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const manifestPath = path.join(rootDir, 'ci/asset-validators.json');

export function parseArgs(args) {
  let group = 'all';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--group' && i + 1 < args.length) {
      group = args[i + 1];
      i++;
    } else if (args[i].startsWith('--group=')) {
      group = args[i].split('=')[1];
    }
  }
  return { group };
}

export function selectValidators(manifest, targetGroups) {
  const allValidators = manifest.validators || [];
  const knownGroups = new Set(['all', ...allValidators.map((v) => v.group), ...allValidators.map((v) => v.id)]);

  for (const g of targetGroups) {
    if (!knownGroups.has(g)) {
      throw new Error(`Unknown validator group: ${g}`);
    }
  }

  if (targetGroups.includes('all')) {
    return allValidators;
  }

  return allValidators.filter(
    (v) => targetGroups.includes(v.group) || targetGroups.includes(v.id)
  );
}

export function runAssetValidators(options = {}) {
  const targetGroups = options.groups && options.groups.length > 0 ? options.groups : ['all'];
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const validators = selectValidators(manifest, targetGroups);

  console.log(`Executing asset validators for group(s): ${targetGroups.join(', ')} (${validators.length} validators)`);

  const results = [];
  let hasFailure = false;

  for (const item of validators) {
    const startTime = Date.now();
    console.log(`\n--- Running [${item.id}] (${item.group}): ${item.description} ---`);
    console.log(`Command: ${item.command}`);

    const [cmd, ...args] = item.command.split(' ');
    const proc = spawnSync(cmd, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: false,
    });

    const durationMs = Date.now() - startTime;
    const status = proc.status === 0 ? 'passed' : 'failed';
    if (status === 'failed') {
      hasFailure = true;
    }

    results.push({
      id: item.id,
      group: item.group,
      description: item.description,
      command: item.command,
      status,
      durationMs,
      exitCode: proc.status,
    });
  }

  const outputDir = path.join(rootDir, 'output/test-results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(outputDir, 'asset-validators.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), results, hasFailure }, null, 2),
    'utf8'
  );

  console.log(`\n=== Asset Validation Summary ===`);
  console.log(`Passed: ${results.filter((r) => r.status === 'passed').length}/${results.length}`);
  if (hasFailure) {
    console.error('FAILED: One or more asset validators failed.');
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }

  return results;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { group } = parseArgs(process.argv.slice(2));
  runAssetValidators({ groups: [group] });
}
