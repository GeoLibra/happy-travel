import { spawnSync } from 'node:child_process';

const forwardedArguments = process.argv.slice(2);
const result = spawnSync(
  process.execPath,
  ['node_modules/playwright/cli.js', 'test', ...forwardedArguments],
  { stdio: 'inherit' },
);

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
