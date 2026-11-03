/**
 * The app's CI, run by `sdxc ci` on a laptop and on GitHub Actions alike: the kit's checks,
 * formatting, lint and types, then the build and the tests. A green local run signs the commit
 * off, and GitHub Actions skips its own run for a commit a contributor signed off.
 */

import { defineCI } from "@sdxc/ci";

export default defineCI(async (ci) => {
	if (ci.runner === "remote") {
		await ci.step("Example secrets", ["cp", ".env.example", ".dev.vars"], { halt: true });
	}

	await ci.parallel("Checks", [
		() => ci.step("Doctor", "bunx sdxc doctor"),
		() => ci.step("Format, lint and types", "bun run check"),
	]);

	await ci.parallel("Build and test", [
		() => ci.step("Build", "bun run build"),
		() => ci.step("Test", "bun run test", { cache: true }),
	]);

	if (ci.status === "passing") await ci.signoff("All systems go.");
	else ci.failure("CI failed. Do not push.", "Fix the steps above and run `sdxc ci` again.");
});
