import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../../');
const outputDir = resolve(rootDir, 'output/test-results/memory');

const dataDir = resolve(outputDir, 'data');
if (existsSync(dataDir)) {
  rmSync(dataDir, { recursive: true, force: true });
}
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// Parse command line scenario selection: --scenario=f1|particles|rose|all
const args = process.argv.slice(2);
let selectedScenario = 'all';
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--scenario=')) {
    selectedScenario = arg.split('=')[1];
  } else if (arg === '--scenario' && args[i + 1]) {
    selectedScenario = args[i + 1];
  }
}

const scenarioMap = {
  f1: resolve(rootDir, 'tests/memory/memlab/f1-welcome.cjs'),
  particles: resolve(rootDir, 'tests/memory/memlab/particles-lifecycle.cjs'),
  rose: resolve(rootDir, 'tests/memory/memlab/rose-modal.cjs'),
};

let scenariosToRun = [];
if (selectedScenario === 'all') {
  scenariosToRun = ['f1', 'particles', 'rose'];
} else if (scenarioMap[selectedScenario]) {
  scenariosToRun = [selectedScenario];
} else {
  console.error(`❌ Unknown scenario "${selectedScenario}". Available scenarios: f1, particles, rose, all`);
  process.exit(1);
}

console.log('====================================================');
console.log(' Happy Travel - MemLab Memory Leak Audit');
console.log(' Scenario selection:', selectedScenario, '->', scenariosToRun.join(', '));
console.log(' Output:', outputDir);
console.log('====================================================\n');

const MEMLAB_TIMEOUT_MS = 180000; // 3 minute timeout safety limit per MemLab scenario
const targetUrl = process.env.TEST_TARGET_URL ?? process.env.APP_URL ?? 'http://localhost:3000';
const hasExternalTargetUrl = Boolean(process.env.TEST_TARGET_URL || process.env.APP_URL);
const shouldRunWebGLLifecycle = scenariosToRun.includes('f1');

async function main() {
  const leaksFile = resolve(outputDir, 'leaks.txt');
  const summaryFile = resolve(outputDir, 'summary.json');

  let memlabBin = resolve(rootDir, 'node_modules/.bin/memlab');
  let memlabBinAvailable = existsSync(memlabBin);

  if (!memlabBinAvailable) {
    try {
      execSync('npx --no memlab --version', { stdio: 'ignore' });
      memlabBin = 'npx --no memlab';
      memlabBinAvailable = true;
    } catch {
      memlabBinAvailable = false;
    }
  }

  if (!memlabBinAvailable) {
    console.error('❌ [MemLab Script] @memlab/cli executable binary not found in node_modules.');
    console.error('   Please run `pnpm install` before executing memory leak audit.');
    writeFileSync(leaksFile, 'MemLab CLI missing in environment.', 'utf-8');
    writeFileSync(
      summaryFile,
      JSON.stringify(
        { status: 'FAILED_MISSING_CLI', scenario: selectedScenario, error: '@memlab/cli not installed', timestamp: new Date().toISOString() },
        null,
        2
      ),
      'utf-8'
    );
    process.exit(1);
  }

  console.log(`[MemLab Script] Checking web server status at ${targetUrl} ...`);
  let serverProcess = null;

  try {
    await fetch(targetUrl, { method: 'GET' });
    console.log('[MemLab Script] Target web server is already running.');
  } catch {
    if (hasExternalTargetUrl) {
      console.error(`[MemLab Script] Target web server is not reachable at ${targetUrl}.`);
      process.exit(1);
    }
    console.log('[MemLab Script] Starting Vite dev server on port 3000...');
    serverProcess = spawn('pnpm', ['exec', 'vite', '--host', '127.0.0.1', '--port', '3000'], {
      cwd: rootDir,
      stdio: 'inherit',
    });
    await new Promise((r) => setTimeout(r, 4000));
  }

  if (shouldRunWebGLLifecycle) {
    console.log('[MemLab Script] Executing WebGL 5-cycle renderer lifecycle trend audit...');
    try {
      execSync('pnpm check:webgl-lifecycle', {
        stdio: 'inherit',
        cwd: rootDir,
        env: {
          ...process.env,
          APP_URL: targetUrl,
          TEST_TARGET_URL: targetUrl,
        },
      });
      console.log('✅ WebGL renderer lifecycle trend audit passed.\n');
    } catch (err) {
      console.error('❌ WebGL renderer lifecycle trend audit failed.');
      writeFileSync(leaksFile, `WebGL Renderer Lifecycle Audit Failure:\n${err.message}`, 'utf-8');
      writeFileSync(
        summaryFile,
        JSON.stringify(
          { status: 'FAILED_WEBGL_LIFECYCLE', scenario: selectedScenario, error: err.message, timestamp: new Date().toISOString() },
          null,
          2
        ),
        'utf-8'
      );
      if (serverProcess) serverProcess.kill();
      process.exit(1);
    }
  } else {
    console.log('[MemLab Script] Skipping F1 WebGL lifecycle audit for non-F1 scenario selection.\n');
  }

  const results = [];
  let anyLeakDetected = false;

  try {
    for (const scName of scenariosToRun) {
      const scenarioPath = scenarioMap[scName];
      console.log(`\n[MemLab Script] Executing MemLab scenario: ${scName} (${scenarioPath})...`);

      const command = `${memlabBin} run --scenario ${scenarioPath} --work-dir ${outputDir}`;
      execSync(command, {
        stdio: 'inherit',
        cwd: rootDir,
        timeout: MEMLAB_TIMEOUT_MS,
        env: {
          ...process.env,
          APP_URL: targetUrl,
          TEST_TARGET_URL: targetUrl,
        },
      });

      const curLeaksFile = resolve(outputDir, 'data/cur/leaks.txt');
      let leakContent = '';
      let hasLeakClusters = false;

      if (existsSync(curLeaksFile)) {
        leakContent = readFileSync(curLeaksFile, 'utf-8');
        const clusterMatch = leakContent.match(/------(\d+)\s+clusters------/);
        if (clusterMatch) {
          hasLeakClusters = parseInt(clusterMatch[1], 10) > 0;
        }
      }

      if (hasLeakClusters) {
        anyLeakDetected = true;
        results.push({ scenario: scName, status: 'FAILED_MEMORY_LEAK', report: leakContent });
      } else {
        results.push({ scenario: scName, status: 'PASSED' });
      }
    }
  } catch (err) {
    console.error('\n❌ MemLab CLI execution returned non-zero exit status or timed out.');
    writeFileSync(leaksFile, `MemLab Execution Error:\n${err.message}`, 'utf-8');
    writeFileSync(
      summaryFile,
      JSON.stringify(
        { status: 'FAILED', scenario: selectedScenario, error: err.message, timestamp: new Date().toISOString() },
        null,
        2
      ),
      'utf-8'
    );
    if (serverProcess) serverProcess.kill();
    process.exit(1);
  } finally {
    if (serverProcess) serverProcess.kill();
  }

  if (anyLeakDetected) {
    console.error('\n❌ MemLab detected memory leaks in one or more scenarios!');
    writeFileSync(leaksFile, JSON.stringify(results, null, 2), 'utf-8');
    writeFileSync(
      summaryFile,
      JSON.stringify({ status: 'FAILED_MEMORY_LEAK', scenario: selectedScenario, results, timestamp: new Date().toISOString() }, null, 2),
      'utf-8'
    );
    process.exit(1);
  } else {
    console.log('\n✅ MemLab memory leak analysis completed successfully. No leaks detected.');
    writeFileSync(leaksFile, 'No memory leaks detected.', 'utf-8');
    writeFileSync(
      summaryFile,
      JSON.stringify({ status: 'PASSED', scenario: selectedScenario, results, timestamp: new Date().toISOString() }, null, 2),
      'utf-8'
    );
  }
}

main().catch((err) => {
  console.error('[MemLab Script Error]', err);
  process.exit(1);
});
