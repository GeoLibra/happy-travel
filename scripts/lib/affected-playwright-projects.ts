export const ALL_PLAYWRIGHT_PROJECTS = [
  'app-desktop-chromium',
  'showroom-desktop-chromium',
  'showroom-mobile-chromium',
  'showroom-arrival-timeline-chromium',
  'webgl-renderer-lifecycle-chromium',
  'race-countdown-desktop-chromium',
  'race-countdown-mobile-chromium',
  'showroom-webkit-smoke',
  'f1-e2e-chromium',
  'particles-e2e-chromium',
  'rose-e2e-chromium',
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
  /^tests\/e2e\/(?:support|app-desktop|showroom-|.*\.setup)\b/,
  /^scripts\/(?:check-showroom-acceptance|resolve-playwright-projects)(?:\.test)?\.ts$/,
  /^scripts\/lib\/affected-playwright-projects\.ts$/,
  /^index\.html$/,
  /^src\/App\.tsx$/,
  /^src\/i18n\.tsx$/,
  /^src\/lib\/test-observability\.ts$/,
  /^src\/components\/(?:WelcomePage|ParticleBackground)\.tsx$/,
];

const APP_MATRIX_PATHS = [
  /^src\//,
  /^public\//,
  /^(?:tailwind|postcss)\.config\.[cm]?[jt]s$/,
];

const APP_BROWSER_PATHS = [
  /^src\/components\/digit\.ts$/,
  /^src\/components\/MiniFirework\.tsx$/,
];

const F1_BROWSER_PATHS = [
  /^src\/App\.tsx$/,
  /^src\/components\/(?:WelcomePage|ParticleBackground)\.tsx$/,
  /^src\/components\/effects\/(?:f1|studio|gpu|showroom|.*Reflection)/,
  /^src\/components\/showroom\//,
  /^src\/lib\/(?:f1-|showroom-)/,
  /^src\/lib\/model-loader\.ts$/,
  /^public\/models\/.*(?:f1|rb20|redbull|showroom).*\.glb$/i,
  /^tests\/e2e\/f1\//,
  /^tests\/e2e\/renderer-lifecycle\.spec\.ts$/,
  /^tests\/e2e\/pages\/(?:WelcomePage|ShowroomPage)\.ts$/,
  /^tests\/memory\/memlab\/f1-welcome\.cjs$/,
  /^scripts\/(?:check-f1|verify-f1|verify-rb20|f1-|run-f1)/,
];

const COUNTDOWN_BROWSER_PATHS = [
  /^src\/features\/race-countdown\//,
  /^src\/components\/RaceCountdown\.tsx$/,
  /^src\/components\/(?:MapComponent|MiniFirework)\.tsx$/,
  /^src\/components\/digit\.ts$/,
  /^src\/components\/showroom\/(?:asset-manager|showroom-assets|showroom-resource-lifecycle)\.ts$/,
  /^src\/lib\/model-loader\.ts$/,
  /^src\/lib\/showroom-quality\.ts$/,
  /^public\/environments\/lythwood_room_1k\.hdr$/,
  /^public\/models\/.*(?:rb20|redbull|showroom).*\.glb$/i,
  /^tests\/(?:e2e|unit)\/race-countdown\//,
  /^tests\/e2e\/pages\/RaceCountdownPage\.ts$/,
];

const PARTICLES_BROWSER_PATHS = [
  /^src\/components\/(?:Itinerary|Particle|Map|.*Particle)/,
  /^src\/components\/effects\/gpuParticles\.ts$/,
  /^tests\/e2e\/itinerary-particles\//,
  /^tests\/memory\/memlab\/particles-lifecycle\.cjs$/,
];

const ROSE_BROWSER_PATHS = [
  /^src\/components\/(?:Rose|.*Rose)/,
  /^src\/lib\/model-loader\.ts$/,
  /^src\/lib\/rose-/,
  /^public\/models\/rose\.glb$/i,
  /^tests\/e2e\/rose\//,
  /^tests\/memory\/memlab\/rose-modal\.cjs$/,
  /^scripts\/(?:check-rose|verify-rose)/,
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

  const selected = new Set<PlaywrightProject>();

  if (relevantPaths.some((path) => matchesAny(path, APP_BROWSER_PATHS))) {
    selected.add('app-desktop-chromium');
  }

  if (relevantPaths.some((path) => matchesAny(path, F1_BROWSER_PATHS))) {
    selected.add('showroom-desktop-chromium');
    selected.add('showroom-mobile-chromium');
    selected.add('showroom-arrival-timeline-chromium');
    selected.add('showroom-webkit-smoke');
    selected.add('f1-e2e-chromium');
    selected.add('webgl-renderer-lifecycle-chromium');
  }

  if (relevantPaths.some((path) => matchesAny(path, COUNTDOWN_BROWSER_PATHS))) {
    selected.add('webgl-renderer-lifecycle-chromium');
    selected.add('race-countdown-desktop-chromium');
    selected.add('race-countdown-mobile-chromium');
  }

  if (relevantPaths.some((path) => matchesAny(path, PARTICLES_BROWSER_PATHS))) {
    selected.add('app-desktop-chromium');
    selected.add('particles-e2e-chromium');
  }

  if (relevantPaths.some((path) => matchesAny(path, ROSE_BROWSER_PATHS))) {
    selected.add('app-desktop-chromium');
    selected.add('rose-e2e-chromium');
  }

  if (selected.size > 0) {
    return ALL_PLAYWRIGHT_PROJECTS.filter((project) => selected.has(project));
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
