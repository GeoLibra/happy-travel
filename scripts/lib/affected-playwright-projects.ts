export const ALL_PLAYWRIGHT_PROJECTS = [
  'app-desktop-chromium',
  'showroom-desktop-chromium',
  'showroom-mobile-chromium',
  'showroom-arrival-timeline-chromium',
  'showroom-webkit-smoke',
] as const;

export type PlaywrightProject = (typeof ALL_PLAYWRIGHT_PROJECTS)[number];

const DOCUMENTATION_ONLY = [
  /^(?:docs\/|README(?:\.[^/]+)?$)/i,
  /\.md$/i,
];

const FULL_MATRIX_PATHS = [
  /^\.github\/workflows\/showroom-browser-acceptance\.yml$/,
  /^(?:package\.json|pnpm-lock\.yaml)$/,
  /^playwright\.config\.ts$/,
  /^tests\/e2e\//,
  /^scripts\/(?:check-showroom-acceptance|resolve-playwright-projects)(?:\.test)?\.ts$/,
  /^scripts\/lib\/affected-playwright-projects\.ts$/,
  /^index\.html$/,
  /^src\/App\.tsx$/,
  /^src\/i18n\.tsx$/,
  /^src\/components\/(?:WelcomePage|ParticleBackground)\.tsx$/,
  /^src\/components\/showroom\//,
  /^src\/lib\/(?:f1-|showroom-)/,
  /^public\/models\/.*\.glb$/i,
];

const APP_MATRIX_PATHS = [
  /^src\//,
  /^public\//,
  /^(?:tailwind|postcss)\.config\.[cm]?[jt]s$/,
];

function normalizedPath(filePath: string): string {
  return filePath.trim().replaceAll('\\', '/').replace(/^\.\/+/, '');
}

function matchesAny(filePath: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(filePath));
}

export function resolveAffectedPlaywrightProjects(
  changedPaths: string[],
): PlaywrightProject[] {
  const paths = changedPaths.map(normalizedPath).filter(Boolean);

  if (paths.length === 0 || paths.some((path) => matchesAny(path, FULL_MATRIX_PATHS))) {
    return [...ALL_PLAYWRIGHT_PROJECTS];
  }

  const relevantPaths = paths.filter(
    (path) => !matchesAny(path, DOCUMENTATION_ONLY),
  );

  if (relevantPaths.length === 0) {
    return [];
  }

  if (relevantPaths.every((path) => matchesAny(path, APP_MATRIX_PATHS))) {
    return ['app-desktop-chromium'];
  }

  // Unknown code, configuration, or asset paths are deliberately conservative.
  return [...ALL_PLAYWRIGHT_PROJECTS];
}

export function toPlaywrightMatrix(projects: readonly PlaywrightProject[]) {
  const selected = new Set(projects);
  return {
    include: ALL_PLAYWRIGHT_PROJECTS
      .filter((project) => selected.has(project))
      .map((project) => ({
        project,
        browser: project === 'showroom-webkit-smoke' ? 'webkit' : 'chromium',
      })),
  };
}

