/**
 * Scanners for the one test-suite failure that reports nothing: a test file that no Vitest
 * project collects. `vp test run` matches files against each project's `include`, so a file
 * outside every one of them is not skipped and not counted — it is invisible, and the run
 * still exits 0.
 *
 * The two shapes this can take are checked separately because the repo treats apps and
 * packages differently: every app needs its own project entry, while one project covers all
 * packages through a `src/`-anchored glob.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A `packages/<name>/src/…` path, the only shape the packages project's glob can match. */
const PACKAGE_SRC_TEST = /^packages\/[^/]+\/src\//;

/**
 * Apps that ship at least one test file but have no Vitest project rooted
 * at them, so none of their tests run. Arguments are repo-relative
 * directory paths (`apps/uptime`), returned sorted for a stable message.
 */
export function findUnregisteredApps(appsWithTests: string[], projectRoots: string[]): string[] {
	let roots = new Set(projectRoots);
	return appsWithTests.filter((app) => !roots.has(app)).sort();
}

/**
 * Package test files the packages project cannot collect, because its glob
 * is anchored at `packages/*​/src/` and these sit outside it. Returned in
 * the order given, matching how the caller enumerated the filesystem.
 */
export function findUncollectablePackageTests(testFiles: string[]): string[] {
	return testFiles.filter((file) => !PACKAGE_SRC_TEST.test(file));
}
