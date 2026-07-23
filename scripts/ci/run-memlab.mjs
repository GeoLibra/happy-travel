import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync, copyFileSync } from 'node:fs';
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

const scenarioPath = resolve(rootDir, 'tests/memory/memlab/welcome-app-lifecycle.cjs');

console.log('====================================================');
console.log(' Happy Travel - MemLab Memory Leak Audit');
console.log(' Scenario:', scenarioPath);
console.log(' Output:', outputDir);
console.log('====================================================\n');

const MEMLAB_TIMEOUT_MS = 180000; // 3 minute timeout safety limit

async function main() {
  const leaksFile = resolve(outputDir, 'leaks.txt');
  const summaryFile = resolve(outputDir, 'summary.json');

  // Locate local binary or fallback to npx --no memlab
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
      JSON.stringify({ status: 'FAILED_MISSING_CLI', scenario: 'welcome-app-lifecycle', error: '@memlab/cli not installed', timestamp: new Date().toISOString() }, null, 2),
      'utf-8'
    );
    process.exit(1);
  }

  console.log('[MemLab Script] Checking web server status at http://localhost:3000 ...');
  let serverProcess = null;

  try {
    await fetch('http://localhost:3000/', { method: 'HEAD' });
    console.log('[MemLab Script] Target web server is already running.');
  } catch {
    console.log('[MemLab Script] Starting preview server on port 3000...');
    serverProcess = spawn('pnpm', ['exec', 'vite', 'preview', '--port', '3000'], {
      cwd: rootDir,
      stdio: 'inherit',
    });
    // Wait for server to warm up
    await new Promise((r) => setTimeout(r, 4000));
  }

  console.log('[MemLab Script] Executing WebGL 5-cycle renderer lifecycle trend audit...');
  try {
    execSync('pnpm check:webgl-lifecycle', { stdio: 'inherit', cwd: rootDir });
    console.log('✅ WebGL renderer lifecycle trend audit passed.\n');
  } catch (err) {
    console.error('❌ WebGL renderer lifecycle trend audit failed.');
    writeFileSync(leaksFile, `WebGL Renderer Lifecycle Audit Failure:\n${err.message}`, 'utf-8');
    writeFileSync(
      summaryFile,
      JSON.stringify({ status: 'FAILED_WEBGL_LIFECYCLE', scenario: 'renderer-lifecycle', error: err.message, timestamp: new Date().toISOString() }, null, 2),
      'utf-8'
    );
    if (serverProcess) serverProcess.kill();
    process.exit(1);
  }

  console.log('[MemLab Script] Executing MemLab scenario with timeout limit...');
  let runSucceeded = false;
  try {
    const command = `${memlabBin} run --scenario ${scenarioPath} --work-dir ${outputDir}`;
    execSync(command, { stdio: 'inherit', cwd: rootDir, timeout: MEMLAB_TIMEOUT_MS });
    runSucceeded = true;
  } catch (err) {
    console.error('\n❌ MemLab CLI execution returned non-zero exit status or timed out.');
    writeFileSync(leaksFile, `MemLab Execution Error:\n${err.message}`, 'utf-8');
    writeFileSync(
      summaryFile,
      JSON.stringify({ status: 'FAILED', scenario: 'welcome-app-lifecycle', error: err.message, timestamp: new Date().toISOString() }, null, 2),
      'utf-8'
    );
    if (serverProcess) serverProcess.kill();
    process.exit(1);
  } finally {
    if (serverProcess) serverProcess.kill();
  }

  // Parse generated MemLab leaks output
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
    console.error('\n❌ MemLab detected memory leaks!');
    console.error(leakContent);
    writeFileSync(leaksFile, leakContent, 'utf-8');
    writeFileSync(
      summaryFile,
      JSON.stringify({ status: 'FAILED_MEMORY_LEAK', scenario: 'welcome-app-lifecycle', leaksDetected: true, report: 'output/test-results/memory/leaks.txt', timestamp: new Date().toISOString() }, null, 2),
      'utf-8'
    );
    process.exit(1);
  } else {
    console.log('\n✅ MemLab memory leak analysis completed successfully. No leaks detected.');
    writeFileSync(leaksFile, 'No memory leaks detected.', 'utf-8');
    writeFileSync(
      summaryFile,
      JSON.stringify({ status: 'PASSED', scenario: 'welcome-app-lifecycle', leaksCount: 0, timestamp: new Date().toISOString() }, null, 2),
      'utf-8'
    );
  }
}

main().catch((err) => {
  console.error('[MemLab Script Error]', err);
  process.exit(1);
});
