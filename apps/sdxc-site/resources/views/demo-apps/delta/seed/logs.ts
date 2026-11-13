/**
 * The text of Delta's seeded job logs: what a runner prints while it sets up, checks out the
 * real commit, installs, checks, tests, builds and deploys, with the ANSI colours and
 * `##[group]` folds a CI log carries. A failing test quotes the real lines it fails on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Colours a line the way a terminal would, then resets. */
const ESC = "\u001b[";

/** Wraps text in one SGR code. */
function sgr(code: string, text: string): string {
	return `${ESC}${code}m${text}${ESC}0m`;
}

/** Text in green, the colour a passing check prints in. */
export function green(text: string): string {
	return sgr("32", text);
}
/** Text in red, the colour a failure prints in. */
export function red(text: string): string {
	return sgr("31", text);
}
/** Text in yellow, for warnings and slow tests. */
export function yellow(text: string): string {
	return sgr("33", text);
}
/** Text in cyan, for paths and commands. */
export function cyan(text: string): string {
	return sgr("36", text);
}
/** Dimmed text, for durations and counters. */
export function dim(text: string): string {
	return sgr("2", text);
}
/** Bold text, for headings in the tool's output. */
export function bold(text: string): string {
	return sgr("1", text);
}

/** A test the seeded suite reports, by the describe blocks and title in the real test file. */
interface SeededTest {
	title: string;
	ms: number;
}

/** Tests from Delta's own browser suite, as its describe blocks and titles read. */
const BROWSER_TESTS: SeededTest[] = [
	{
		title:
			"Delta works like an app once its script runs > moving between screens swaps only main, keeping the sidebar, top bar and tree",
		ms: 412,
	},
	{
		title:
			"Delta works like an app once its script runs > the file pane shows beside code and steps aside for every other screen",
		ms: 188,
	},
	{
		title:
			"Delta works like an app once its script runs > the tree keeps its open folders and follows the open file across swaps",
		ms: 233,
	},
	{
		title:
			"Delta works like an app once its script runs > one entry per file opened, and Back and Forward restore the address, screen and scroll",
		ms: 671,
	},
	{ title: "Delta's line links > a `?L=` range is painted on the first render", ms: 97 },
	{
		title:
			"Delta's line links > a click and a shift-click cite a range in the address without adding history",
		ms: 143,
	},
	{ title: 'Delta on a phone > screen "" never scrolls sideways at 375px', ms: 64 },
	{ title: 'Delta on a phone > screen "delta" never scrolls sideways at 375px', ms: 81 },
	{
		title: 'Delta on a phone > screen "delta/commits/main" never scrolls sideways at 375px',
		ms: 72,
	},
	{ title: "Delta on a phone > a file trades the tree for a parent link", ms: 118 },
];

/** Tests from the router suite that answers Delta's addresses. */
const ROUTER_TESTS: SeededTest[] = [
	{ title: "Delta's repository home > lists every top-level file and folder, each linked", ms: 38 },
	{
		title: "Delta's file view > numbers every line and marks the file the tree follows",
		ms: 54,
	},
	{ title: "Delta's file view > paints the lines `?L=` cites without script", ms: 21 },
	{ title: "Delta's file view > pins its permalink to the commit the build read", ms: 19 },
	{
		title: "Delta's Go to file > ranks paths against the query and marks the matched characters",
		ms: 26,
	},
	{
		title:
			"Delta's commits > lists every commit in the history, newest day first, each linking to its page",
		ms: 33,
	},
	{ title: "Delta's commits > names authors and never an email", ms: 12 },
	{ title: "Delta's forms > Reset the demo redirects home with its toast", ms: 9 },
];

/** The runner's setup, which every job opens with. */
export function setUpJob(job: string): string[] {
	return [
		"Current runner version: '2.321.0'",
		"##[group]Operating System",
		"Ubuntu",
		"24.04.1",
		"LTS",
		"##[endgroup]",
		"##[group]Runner Image",
		"Image: ubuntu-24.04",
		"Version: 20261103.1.0",
		"Included Software: https://github.com/actions/runner-images/blob/ubuntu24/20261103.1/images/ubuntu/Ubuntu2404-Readme.md",
		"##[endgroup]",
		"Secret source: Actions",
		"Prepare workflow directory",
		"Prepare all required actions",
		"Getting action download info",
		"Download action repository 'actions/checkout@v4' (SHA:11bd71901bbe5b1630ceea73d27597364c9af683)",
		"Download action repository 'oven-sh/setup-bun@v2' (SHA:4bc047ad259df6fc24a6c9b0f9a0cb08cf17fbe5)",
		`Complete job name: ${job}`,
	];
}

/** Checking out the commit the run builds, by its real sha. */
export function checkout(sha: string, branch: string): string[] {
	return [
		"##[group]Run actions/checkout@v4",
		"with:",
		"  fetch-depth: 0",
		"  repository: sdxc/delta",
		"##[endgroup]",
		"Syncing repository: sdxc/delta",
		"##[group]Getting Git version info",
		"Working directory is '/home/runner/work/delta/delta'",
		"[command]/usr/bin/git version",
		"git version 2.47.1",
		"##[endgroup]",
		"##[group]Fetching the repository",
		`[command]/usr/bin/git -c protocol.version=2 fetch --prune --no-recurse-submodules origin +refs/heads/*:refs/remotes/origin/*`,
		`From https://github.com/sdxc/delta`,
		` * [new branch]      ${branch.padEnd(16)} -> origin/${branch}`,
		"##[endgroup]",
		"##[group]Checking out the ref",
		`[command]/usr/bin/git checkout --progress --force -B ${branch} refs/remotes/origin/${branch}`,
		`Switched to a new branch '${branch}'`,
		"##[endgroup]",
		"[command]/usr/bin/git log -1 --format=%H",
		sha,
	];
}

/** Setting up Bun from the runner's cache. */
export function setupBun(): string[] {
	return [
		"##[group]Run oven-sh/setup-bun@v2",
		"with:",
		"  bun-version-file: package.json",
		"##[endgroup]",
		"Cache hit for: bun-1.3.2-linux-x64",
		`Using a cached version of Bun: ${cyan("1.3.2")}`,
		"/home/runner/.bun/bin/bun --revision",
		"1.3.2+b131639c",
	];
}

/** `bun install` against the frozen lockfile. */
export function install(): string[] {
	return [
		"##[group]Run bun install --frozen-lockfile",
		"bun install --frozen-lockfile",
		"shell: /usr/bin/bash -e {0}",
		"##[endgroup]",
		`${bold("bun install")} ${dim("v1.3.2 (b131639c)")}`,
		"",
		`${green("+")} @sdxc/ui@workspace:packages/ui`,
		`${green("+")} @sdxc/highlight@workspace:packages/highlight`,
		`${green("+")} @sdxc/diff@workspace:packages/diff`,
		`${green("+")} remix@3.0.0-alpha.4`,
		`${green("+")} vite-plus@0.4.2`,
		"",
		`${green("1847")} packages installed ${dim("[9.42s]")}`,
	];
}

/** `bun check`: formatting, lint and the type-aware pass. */
export function check(warning?: { path: string; line: number; message: string }): string[] {
	return [
		"##[group]Run bun check",
		"bun check",
		"shell: /usr/bin/bash -e {0}",
		"##[endgroup]",
		`${dim("$")} vp check`,
		`${bold("fmt")}   1,284 files ${green("ok")} ${dim("(812ms)")}`,
		`${bold("lint")}  1,284 files ${warning === undefined ? green("0 warnings") : yellow("1 warning")} ${dim("(2.31s)")}`,
		...(warning === undefined
			? []
			: [
					"",
					`  ${yellow("⚠")} ${cyan(`${warning.path}:${warning.line}`)}`,
					`    ${warning.message}`,
					`##[warning]${warning.message}`,
					"",
				]),
		`${bold("types")} 1,284 files ${green("ok")} ${dim("(5.04s)")}`,
		`${green("✓")} check passed`,
	];
}

/** The line Vitest prints for one test. */
function testLine(test: SeededTest): string {
	let time = test.ms > 300 ? yellow(`${test.ms}ms`) : dim(`${test.ms}ms`);
	return `   ${green("✓")} ${test.title} ${time}`;
}

/** Vitest's header, which every test step opens with. */
function vitestHeader(shard: string, browser: boolean): string[] {
	return [
		`##[group]Run bun run test --shard=${shard}`,
		`bun run test --shard=${shard}`,
		"shell: /usr/bin/bash -e {0}",
		"env:",
		"  CI: true",
		...(browser ? ["  PLAYWRIGHT_BROWSERS_PATH: /home/runner/.cache/ms-playwright"] : []),
		"##[endgroup]",
		"",
		` ${bold(cyan("RUN"))} ${cyan("v4.0.8")} ${dim("/home/runner/work/delta/delta")}`,
		` ${dim(`Shard ${shard}`)}`,
		"",
	];
}

/** A passing shard: each file's tests, then the totals. */
export function passingTests(shard: string, browser: boolean): string[] {
	let tests = browser ? BROWSER_TESTS : ROUTER_TESTS;
	let file = browser ? "frames.browser.test.tsx" : "delta.test.tsx";
	let total = tests.reduce((sum, test) => sum + test.ms, 0);
	return [
		...vitestHeader(shard, browser),
		` ${green("✓")} ${file} ${dim(`(${tests.length} tests)`)} ${dim(`${total}ms`)}`,
		...tests.map(testLine),
		"",
		` ${dim("Test Files")}  ${bold(green("4 passed"))} ${dim("(4)")}`,
		` ${dim("     Tests")}  ${bold(green(`${tests.length + 38} passed`))} ${dim(`(${tests.length + 38})`)}`,
		` ${dim("  Start at")}  14:02:11`,
		` ${dim("  Duration")}  ${((total + 9800) / 1000).toFixed(2)}s`,
	];
}

/** The real lines a failing assertion sits in, with its line number. */
export interface FailureSite {
	path: string;
	/** The failing line's number in the file at the pinned commit. */
	line: number;
	/** The lines from two before the failing one to one after, as the file holds them. */
	excerpt: string[];
}

/**
 * A failing shard: one screen's phone test overflows. Vitest quotes the assertion's source,
 * which here is the real file at the run's commit.
 */
export function failingTests(shard: string, site: FailureSite): string[] {
	let title = 'Delta on a phone > screen "delta/actions" never scrolls sideways at 375px';
	let first = site.line - 2;
	let width = String(site.line + 1).length;
	let code = site.excerpt.map((text, index) => {
		let n = String(first + index).padStart(width);
		let marker = first + index === site.line ? red("❯") : " ";
		return ` ${marker} ${dim(`${n}|`)} ${text.replaceAll("\t", "  ")}`;
	});
	return [
		...vitestHeader(shard, true),
		` ${red("❯")} ${site.path} ${dim("(11 tests | 1 failed)")} ${dim("2.31s")}`,
		...BROWSER_TESTS.slice(0, 7).map(testLine),
		`   ${red("×")} ${title} ${dim("96ms")}`,
		`     ${red("→ expected 391 to be less than or equal to 375")}`,
		...BROWSER_TESTS.slice(7).map(testLine),
		"",
		red(`⎯⎯⎯⎯⎯⎯⎯ ${bold("Failed Tests 1")} ⎯⎯⎯⎯⎯⎯⎯`),
		"",
		` ${bold(red(" FAIL "))} ${site.path} > ${title}`,
		`${bold(red("AssertionError"))}: expected 391 to be less than or equal to 375`,
		` ${red("❯")} ${cyan(`${site.path}:${site.line}:50`)}`,
		...code,
		"",
		red("⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯"),
		"",
		` ${dim("Test Files")}  ${bold(red("1 failed"))} | ${bold(green("3 passed"))} ${dim("(4)")}`,
		` ${dim("     Tests")}  ${bold(red("1 failed"))} | ${bold(green("47 passed"))} ${dim("(48)")}`,
		` ${dim("  Start at")}  14:02:09`,
		` ${dim("  Duration")}  12.84s`,
		`##[error]${site.path}:${site.line}: AssertionError: expected 391 to be less than or equal to 375`,
		"##[error]Process completed with exit code 1.",
	];
}

/** A Vite build of the site, its biggest chunks listed. */
export function build(): string[] {
	return [
		"##[group]Run bun run build",
		"bun run build",
		"shell: /usr/bin/bash -e {0}",
		"##[endgroup]",
		`${dim("$")} bun run delta && vite build`,
		`${cyan("delta")} pinned HEAD, 21 files, 3 commits, 1 anchor`,
		`${cyan("vite v7.2.4")} ${green("building for production...")}`,
		`${green("✓")} 2,418 modules transformed.`,
		`${dim("dist/client/")}${cyan("assets/delta-index.js")}        ${bold("64.12 kB")} ${dim("│ gzip: 18.40 kB")}`,
		`${dim("dist/client/")}${cyan("assets/log-viewer.js")}         ${bold("11.87 kB")} ${dim("│ gzip:  4.21 kB")}`,
		`${dim("dist/client/")}${cyan("assets/code-view.js")}          ${bold(" 9.30 kB")} ${dim("│ gzip:  3.66 kB")}`,
		`${dim("dist/server/")}${cyan("index.js")}                  ${bold("2,961.44 kB")}`,
		`${green("✓")} built in 18.62s`,
	];
}

/** Uploading the Worker, failed or done. */
export function deploy(failed: boolean): string[] {
	let head = [
		"##[group]Run sdxc deploy --skip migrate --yes",
		"sdxc deploy --skip migrate --yes",
		"shell: /usr/bin/bash -e {0}",
		"env:",
		"  CLOUDFLARE_API_TOKEN: ***",
		"##[endgroup]",
		`${bold("sdxc deploy")} ${dim("sdxc-site")}`,
		`${green("✓")} build ${dim("(reused from the build job)")}`,
		`${dim("–")} migrate ${dim("skipped")}`,
		`${cyan("→")} Uploading sdxc-site (2961.44 KiB / gzip: 642.18 KiB)`,
	];
	if (failed) {
		return [
			...head,
			`${red("✘")} ${bold("[ERROR]")} A request to the Cloudflare API failed.`,
			`  Script startup exceeded CPU time limit. [code: 10021]`,
			"",
			`  ${yellow("If the module does work at load time, move it into the first request.")}`,
			"##[error]Script startup exceeded CPU time limit. [code: 10021]",
			"##[error]Process completed with exit code 1.",
		];
	}
	return [
		...head,
		`Worker Startup Time: 41 ms`,
		`${green("✓")} Uploaded sdxc-site (6.12 sec)`,
		`${green("✓")} Deployed sdxc-site triggers (0.84 sec)`,
		`  https://sdxc.dev`,
		`Current Version ID: 7c1e5d2a-93b0-4f6e-b8a1-0d42c9e6f317`,
	];
}

/** Uploading an artifact the run keeps. */
export function upload(name: string, size: string): string[] {
	return [
		"##[group]Run actions/upload-artifact@v4",
		"with:",
		`  name: ${name}`,
		"  retention-days: 14",
		"##[endgroup]",
		`With the provided path, there will be 128 files uploaded`,
		`Artifact ${name}.zip successfully finalized. Artifact size is ${size}`,
	];
}

/** Cleaning up after the job, which every finished job closes with. */
export function completeJob(): string[] {
	return [
		"Post job cleanup.",
		"[command]/usr/bin/git version",
		"git version 2.47.1",
		"Cleaning up orphan processes",
	];
}
