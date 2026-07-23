import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const mapPath = path.join(rootDir, 'ci/impact-map.json');

export function resolveImpact({ files = [], map = null, all = false } = {}) {
  const impactMap = map || JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  const rules = impactMap.rules || [];
  const fullFallback = impactMap.fullFallback || {
    unit: ['tests/unit/ci', 'tests/unit/f1', 'tests/unit/particles', 'tests/unit/rose', 'tests/unit/i18n'],
    assets: ['all'],
    e2e: ['f1', 'itinerary-particles', 'rose', 'smoke'],
    memory: ['f1', 'particles', 'rose'],
  };

  if (all || files.length === 0) {
    return {
      unit: Array.from(new Set(fullFallback.unit)),
      assets: Array.from(new Set(fullFallback.assets)),
      e2e: Array.from(new Set(fullFallback.e2e)),
      memory: Array.from(new Set(fullFallback.memory)),
      full: true,
      reasons: [all ? 'Explicit --all requested' : 'No changed files provided, running full suite'],
    };
  }

  const selectedUnit = new Set();
  const selectedAssets = new Set();
  const selectedE2E = new Set();
  const selectedMemory = new Set();
  const reasons = [];
  let full = false;

  for (const file of files) {
    let matched = false;
    for (const rule of rules) {
      const regex = new RegExp(rule.pattern);
      if (regex.test(file)) {
        matched = true;
        (rule.suites.unit || []).forEach((s) => selectedUnit.add(s));
        (rule.suites.assets || []).forEach((s) => selectedAssets.add(s));
        (rule.suites.e2e || []).forEach((s) => selectedE2E.add(s));
        (rule.suites.memory || []).forEach((s) => selectedMemory.add(s));
        reasons.push(`${file} matched ${rule.pattern}`);
      }
    }

    if (!matched) {
      full = true;
      reasons.push(`Unmatched path '${file}' triggering fail-open full suite`);
    }
  }

  if (full) {
    return {
      unit: Array.from(new Set(fullFallback.unit)),
      assets: Array.from(new Set(fullFallback.assets)),
      e2e: Array.from(new Set(fullFallback.e2e)),
      memory: Array.from(new Set(fullFallback.memory)),
      full: true,
      reasons,
    };
  }

  return {
    unit: Array.from(selectedUnit),
    assets: Array.from(selectedAssets),
    e2e: Array.from(selectedE2E),
    memory: Array.from(selectedMemory),
    full: false,
    reasons,
  };
}

export function parseArgs(args) {
  let files = [];
  let all = false;
  let base = null;
  let head = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--all') {
      all = true;
    } else if (args[i] === '--files' && i + 1 < args.length) {
      files = args[i + 1].split(',').map((f) => f.trim()).filter(Boolean);
      i++;
    } else if (args[i] === '--base' && i + 1 < args.length) {
      base = args[i + 1];
      i++;
    } else if (args[i] === '--head' && i + 1 < args.length) {
      head = args[i + 1];
      i++;
    }
  }

  return { files, all, base, head };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const parsed = parseArgs(process.argv.slice(2));
  const result = resolveImpact(parsed);
  console.log(JSON.stringify(result, null, 2));
}
