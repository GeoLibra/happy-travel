import {
  resolveAffectedPlaywrightProjects,
  toPlaywrightMatrix,
} from './lib/affected-playwright-projects.ts';

async function readChangedPaths(): Promise<string[]> {
  if (process.argv.length > 2) {
    return process.argv.slice(2);
  }

  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return input.split(/\r?\n/).filter(Boolean);
}

const changedPaths = await readChangedPaths();
const projects = resolveAffectedPlaywrightProjects(changedPaths);

process.stdout.write(JSON.stringify(toPlaywrightMatrix(projects)));
