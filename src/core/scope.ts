/**
 * Where a file sits in a project: shipped code, tests, or examples. Test and example code is not
 * deployed, so code and dependency findings there are hidden by default (`--include-tests` shows
 * them), and an import that only appears there doesn't make a dependency reachable in production.
 */
export type PathScope = "prod" | "test" | "example" | "tooling";

/** Directory names that hold tests or test data (`test/`, `__tests__/`, `e2e/`, `integration-tests/`). */
const TEST_DIR = /^(?:__)?(?:tests?|specs?|testing|e2e|fixtures?|mocks?|testdata|test[-_]data)(?:__)?$|[-_](?:tests?|e2e|specs?)$/i;
/** Test files outside a test directory. */
const TEST_FILE =
  /\.(?:test|spec|e2e|cy|stories|story)\.[cm]?[jt]sx?$|^test_.*\.py$|_test\.py$|^conftest\.py$|^tests?\.py$/i;
/** JVM test classes by naming convention (`UserServiceTest`, `OrderIT`, `TestUtils`). Case-sensitive, so `Contest.java` isn't one. */
const JVM_TEST_FILE = /[a-z0-9](?:Test|Tests|TestCase|IT|ITCase)\.(?:java|kt)$|^Test[A-Z]\w*\.(?:java|kt)$/;
const EXAMPLE_DIR = /^(?:examples?|samples?|demos?|playground)$/i;
/**
 * Build and maintenance scripts: a top-level `scripts/` or `tools/` directory, or one at a monorepo
 * package's root (`packages/web/scripts/`). Only there: `src/app/tools/` is an app route, not tooling.
 */
const TOOLING_DIR = /^(?:(?:packages|apps|libs|services)\/[^/]+\/)?(?:scripts|tools)\//;

/** A JVM source root: the directories below it are a package name (`com/example/shop`), not a layout. */
const JVM_SOURCE_ROOT = /^(?:java|kotlin|scala|groovy)$/;

export function pathScope(relPath: string): PathScope {
  const all = relPath.replace(/\\/g, "/").replace(/^\.\//, "").split("/");
  const file = all.pop() ?? "";
  // `src/main/java/com/example/...`: only the directories up to the source root say what this is.
  const root = all.findIndex((s, i) => JVM_SOURCE_ROOT.test(s) && i > 0 && /^(?:main|test|it|integrationTest)$/.test(all[i - 1]!));
  const segments = root >= 0 ? all.slice(0, root) : all;
  if (segments.some((s) => TEST_DIR.test(s)) || TEST_FILE.test(file) || JVM_TEST_FILE.test(file)) return "test";
  if (segments.some((s) => EXAMPLE_DIR.test(s))) return "example";
  if (TOOLING_DIR.test(`${all.join("/")}/`)) return "tooling";
  return "prod";
}

/** Files only read by build, lint and test tools (`jest.config.ts`, `.eslintrc.js`, `setup.py`). */
const DEV_CONFIG_FILE =
  /\.config\.[cm]?[jt]s$|^(?:jest|vitest|karma|babel|webpack|rollup|gulpfile|gruntfile|playwright|cypress|eslint|prettier|commitlint|lint-staged)\b[\w.-]*\.(?:[cm]?[jt]s|json)$|^\.[\w-]+rc(?:\.(?:json|ya?ml|[cm]?js))?$|^(?:setup|noxfile|fabfile|tasks)\.py$/i;
/** Tooling that runs the deployed app rather than building or testing it. */
const RUNTIME_TOOLING = /^(?:Dockerfile.*|Containerfile|Procfile)$/;

/**
 * True when evidence found at this path only shows a package is used while developing: test and
 * example code, tool config, and tooling such as package.json scripts, CI files and Makefiles.
 * Dockerfiles and Procfiles run the deployed app, so they count as production.
 */
export function isDevContext(relPath: string, tooling: boolean): boolean {
  if (pathScope(relPath) !== "prod") return true;
  const file = relPath.replace(/\\/g, "/").split("/").pop() ?? "";
  if (RUNTIME_TOOLING.test(file)) return false;
  return tooling || DEV_CONFIG_FILE.test(file);
}
