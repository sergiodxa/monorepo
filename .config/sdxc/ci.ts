/**
 * The monorepo's CI, run by `sdxc ci` on a laptop and by GitHub Actions alike: typegen, the
 * doctor, `bun check` and the commit bodies, then every workspace's tests as one matrix entry
 * each. A green local run signs the commit off, and the hosted workflow skips a signed commit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defineCI } from "@sdxc/ci";

/** The suites outside any workspace (`test/`, `scripts/`, `cli/`, the repo checks), as an entry. */
const ROOT_SUITE = { name: "root", path: "root", inputs: ["**"] };

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

	await ci.step("Typegen", "bun --filter '*' cli typegen", { halt: true });

	await ci.parallel("Static checks", [
		() => ci.step("Doctor", "bun run doctor"),
		() => ci.step("Check", "bun run check"),
		() =>
			ci.step("Commits", "bun packages/kit/src/bin.ts doctor --only commits", {
				env: ci.runner === "local" ? { SDXC_COMMIT_RANGE: "origin/main..HEAD" } : {},
			}),
	]);

	let tested = (await ci.workspaces()).filter((ws) => ws.has("**/*.test.{ts,tsx}"));
	await ci.matrix(
		"Tests",
		[ROOT_SUITE, ...tested],
		async (suite) => {
			let target = suite === ROOT_SUITE ? "--project root" : `"${ci.root}/${suite.path}/"`;
			await ci.step(`Tests for ${suite.path}`, `bun run test ${target}`, {
				cache: { inputs: [...suite.inputs, "test/**"] },
			});
		},
		{ key: (suite) => suite.path, concurrency: Math.max(1, Math.floor(ci.cores / 3)) },
	);

	if (ci.status === "passing") await ci.signoff("All systems go. Ready to push.");
	else ci.failure("CI failed. Do not push.", "Fix the steps above and run `sdxc ci` again.");
});
