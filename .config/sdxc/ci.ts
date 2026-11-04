/**
 * The monorepo's CI, run by `sdxc ci` on a laptop and by GitHub Actions alike: typegen, the
 * doctor, `bun check` and the commit bodies, then every workspace's tests as one matrix entry
 * each. A green local run signs the commit off, and the hosted workflow skips a signed commit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Runner } from "@sdxc/ci";

import { defineCI } from "@sdxc/ci";
import { isFailure } from "@sdxc/result";

/** The suites outside any workspace (`test/`, `scripts/`, `cli/`, the repo checks), as an entry. */
const ROOT_SUITE = { name: "root", path: "root", inputs: ["**"] };

/**
 * What every app's `typegen` command reads: the Worker config and committed variables it types,
 * the command line that runs it, and the lockfile that pins `cf` and `wrangler`, whose versions
 * decide the runtime types written beside the bindings.
 */
const TYPEGEN_INPUTS = [
	"apps/*/cloudflare.config.ts",
	"apps/*/wrangler.jsonc",
	"apps/*/.env.example",
	"apps/*/package.json",
	"apps/*/bootstrap/cli.ts",
	"apps/*/app/commands/**",
	"apps/*/app/initializers/**",
	"packages/cli/src/**",
	"package.json",
	"bun.lock",
];

/**
 * Bytes reserved for a Vitest browser suite (Chromium plus the suite process). Declared rather
 * than sampled, so concurrency stays predictable under the run's memory budget.
 */
const BROWSER_TEST_MEMORY = "2GB";

/**
 * Vitest workers a local test entry runs with, and the concurrency slots it holds, so the
 * entries running at once add up to about one worker per core. A CI host runs one entry per
 * machine, and Vitest there keeps its own default of a worker per core.
 */
export const LOCAL_TEST_WORKERS = 2;

/** How one workspace's test entry runs on `runner`: its command and the slots it holds. */
export interface TestStep {
	command: string;
	weight: number;
}

/**
 * The test step for `target` (`--project root` or a quoted workspace path). Locally every
 * entry shares one machine, so each caps its workers and holds that many slots of the run's
 * concurrency, which `--concurrency` sets and defaults to the core count.
 */
export function testStep(target: string, runner: Runner): TestStep {
	if (runner === "remote") return { command: `bun run test ${target}`, weight: 1 };
	return {
		command: `bun run test ${target} --maxWorkers=${LOCAL_TEST_WORKERS}`,
		weight: LOCAL_TEST_WORKERS,
	};
}

/**
 * The git-ignored files `typegen` writes, per app: `wrangler types` writes beside a
 * `wrangler.jsonc`, `cf workers types` under `.cloudflare/types`. A cached pass counts only while
 * they still hold what it left, since the checks and tests after it compile against them.
 */
async function typegenOutputs(files: (glob: string) => Promise<string[]>): Promise<string[]> {
	let wrangler = await files("apps/*/wrangler.jsonc");
	let cf = await files("apps/*/cloudflare.config.ts");
	return [
		...wrangler.map((config) => config.replace(/wrangler\.jsonc$/, "worker-configuration.d.ts")),
		...cf.map((config) => config.replace(/cloudflare\.config\.ts$/, ".cloudflare/types")),
	];
}

/**
 * Doctor's key: every file in the tree, plus the variables that make it also check commit
 * messages, which GitHub Actions sets for the whole run.
 */
const DOCTOR_CACHE = { env: ["SDXC_COMMIT_RANGE", "SDXC_COMMIT_MSG_FILE"] };

/**
 * The commits a local run checks. The Commits step runs every time: this range names other
 * commits as either end moves while every file stays the same, so no file key can stand for it.
 */
const LOCAL_COMMIT_RANGE = "origin/main..HEAD";

/** The kit binary this checkout runs doctor through, so a scoped app doctor needs no global `sdxc`. */
const KIT_BIN = "packages/kit/src/bin.ts";

export default defineCI(async (ci) => {
	if (ci.runner === "remote") {
		let examples = await ci.files("apps/*/.env.example");
		await ci.step(
			"Example secrets",
			async (step) => {
				for (let example of examples) {
					await step.run(["cp", example, example.replace(/\.env\.example$/, ".dev.vars")]);
				}
			},
			{ halt: true },
		);
	}

	let all = await ci.workspaces();
	let scoped = ci.scope === null ? all : all.filter((ws) => ci.scope?.includes(ws.path) === true);
	let scopedApps = scoped.filter((ws) => ws.path.startsWith("apps/"));

	if (ci.scope === null) {
		await ci.step("Typegen", "bun --filter '*' cli typegen", {
			halt: true,
			cache: { inputs: TYPEGEN_INPUTS, outputs: await typegenOutputs((glob) => ci.files(glob)) },
		});
	} else if (scopedApps.length > 0) {
		await ci.step(
			"Typegen",
			async (step) => {
				for (let app of scopedApps) {
					let ran = await step.run(["bun", "--filter", `./${app.path}`, "cli", "typegen"]);
					if (isFailure(ran)) return ran;
				}
			},
			{
				halt: true,
				cache: {
					inputs: TYPEGEN_INPUTS,
					outputs: await typegenOutputs((glob) => ci.files(glob)),
				},
			},
		);
	}

	await ci.parallel("Static checks", [
		() => {
			if (ci.scope === null) {
				return ci.step("Doctor", "bun run doctor", { cache: DOCTOR_CACHE });
			}
			return ci.step(
				"Doctor",
				async (step) => {
					for (let app of scopedApps) {
						let ran = await step.run(["bun", KIT_BIN, "doctor"], { cwd: app.path });
						if (isFailure(ran)) return ran;
					}
				},
				{ cache: DOCTOR_CACHE },
			);
		},
		() => {
			/**
			 * `vp check <paths>` formats, lints and type-checks only those paths, which is safe for a
			 * scoped run; a full run keeps `bun check` so the whole tree stays one step.
			 */
			if (ci.scope === null) {
				return ci.step("Check", "bun run check", { cache: true });
			}
			let paths = [...new Set(scoped.map((ws) => ws.path))];
			return ci.step("Check", ["vp", "check", ...paths], { cache: true });
		},
		() =>
			ci.step("Commits", "bun packages/kit/src/bin.ts doctor --only commits", {
				env: ci.runner === "local" ? { SDXC_COMMIT_RANGE: LOCAL_COMMIT_RANGE } : {},
			}),
	]);

	let tested = all.filter((ws) => ws.has("**/*.test.{ts,tsx}"));
	await ci.matrix(
		"Tests",
		[ROOT_SUITE, ...tested],
		async (suite) => {
			let target = suite === ROOT_SUITE ? "--project root" : `"${ci.root}/${suite.path}/"`;
			let browser =
				suite !== ROOT_SUITE &&
				"has" in suite &&
				typeof suite.has === "function" &&
				(suite.has("**/*.browser.test.ts") || suite.has("**/*.browser.test.tsx"));
			let { command, weight } = testStep(target, ci.runner);
			await ci.step(`Tests for ${suite.path}`, command, {
				cache: { inputs: [...suite.inputs, "test/**"] },
				memory: browser ? BROWSER_TEST_MEMORY : undefined,
				weight,
			});
		},
		{ key: (suite) => suite.path },
	);

	if (ci.status === "passing") await ci.signoff("All systems go. Ready to push.");
	else ci.failure("CI failed. Do not push.", "Fix the steps above and run `sdxc ci` again.");
});
