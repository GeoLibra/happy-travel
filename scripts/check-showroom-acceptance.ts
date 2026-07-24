import { spawnSync } from 'node:child_process';

const SHOWROOM_ACCEPTANCE_PROJECTS = [
  'app-desktop-chromium',
  'showroom-desktop-chromium',
  'showroom-mobile-chromium',
  'showroom-arrival-timeline-chromium',
  'showroom-webkit-smoke',
];

const forwardedArguments = process.argv.slice(2).filter((arg) => arg !== '--');
const hasExplicitProject = forwardedArguments.some(
  (arg) => arg === '--project' || arg.startsWith('--project='),
);
const projectArguments = hasExplicitProject
  ? []
  : SHOWROOM_ACCEPTANCE_PROJECTS.flatMap((project) => [
      '--project',
      project,
    ]);
const result = spawnSync(
  process.execPath,
  ['node_modules/playwright/cli.js', 'test', ...projectArguments, ...forwardedArguments],
  { stdio: 'inherit' },
);

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
