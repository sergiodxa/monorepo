/**
 * `app register`: wires an app that `sdxc create` already wrote under `apps/<name>` into this
 * monorepo — Vitest project and layout allowlist. Pass `--deploy` to add the Deploy-app workflow
 * choice only when the app is ready to ship.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createCommand, exit, success, usage } from "@sdxc/cli";
import { failure, isFailure, success as ok, wrap } from "@sdxc/result";

import { REPO_ROOT } from "../../scripts/release/workspace.js";

import commandset from "./index.js";

/** Kebab-case app directory name. */
const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Wires the named app into vite.config.ts, the layout allowlist, and optionally deploy-apps.yml. */
export default createCommand(commandset.app.register, async (ctx) => {
	let name = ctx.arguments.name.trim();
	if (!NAME.test(name)) return usage(`"${name}" is not a kebab-case app name`);
	let appDir = join(REPO_ROOT, "apps", name);
	if (!existsSync(join(appDir, "package.json"))) {
		return exit(
			1,
			`apps/${name} has no package.json; create it with \`sdxc create apps/${name}\` first`,
		);
	}
	let planned = await planRegister(name, {
		converted: ctx.flags.converted !== false,
		deploy: ctx.flags.deploy === true,
	});
	if (isFailure(planned)) return exit(1, planned.error.message);
	if (ctx.flags.dryRun) {
		for (let edit of planned.data) ctx.stdout(`would edit ${edit.path}\n`);
		return success();
	}
	for (let edit of planned.data) {
		await writeFile(join(REPO_ROOT, edit.path), edit.after);
		ctx.stdout(`edited ${edit.path}\n`);
	}
	ctx.stdout(`\nProve the project: vp test run --project ${name}\n`);
	return success();
});

/** One text edit relative to the repo root. */
interface PlannedEdit {
	path: string;
	after: string;
}

/** Plans the monorepo wiring edits for `name`. */
async function planRegister(name: string, options: { converted: boolean; deploy: boolean }) {
	let edits: PlannedEdit[] = [];
	let vite = await wrap(() => readFile(join(REPO_ROOT, "vite.config.ts"), "utf8"));
	if (isFailure(vite)) return vite;
	let viteAfter = ensureVitestProject(vite.data, name);
	if (isFailure(viteAfter)) return viteAfter;
	if (viteAfter.data !== vite.data) edits.push({ path: "vite.config.ts", after: viteAfter.data });

	if (options.converted) {
		let layout = await wrap(() => readFile(join(REPO_ROOT, "test/app-layout.ts"), "utf8"));
		if (isFailure(layout)) return layout;
		let layoutAfter = ensureConvertedApp(layout.data, name);
		if (isFailure(layoutAfter)) return layoutAfter;
		if (layoutAfter.data !== layout.data) {
			edits.push({ path: "test/app-layout.ts", after: layoutAfter.data });
		}
	}

	if (options.deploy) {
		let deploy = await wrap(() =>
			readFile(join(REPO_ROOT, ".github/workflows/deploy-apps.yml"), "utf8"),
		);
		if (isFailure(deploy)) return deploy;
		let deployAfter = ensureDeployOption(deploy.data, name);
		if (isFailure(deployAfter)) return deployAfter;
		if (deployAfter.data !== deploy.data) {
			edits.push({ path: ".github/workflows/deploy-apps.yml", after: deployAfter.data });
		}
	}

	if (edits.length === 0) {
		return failure(new Error(`apps/${name} is already registered`));
	}
	return ok(edits);
}

/** Inserts a Vitest project for `apps/<name>` when one is missing. */
function ensureVitestProject(source: string, name: string) {
	if (source.includes(`name: "${name}"`) && source.includes(`root: "apps/${name}"`)) {
		return ok(source);
	}
	let block = `
			{
				root: "apps/${name}",
				plugins: [cloudflareWorkersStub()],
				resolve: {
					tsconfigPaths: true,
					alias: {
						"@pitlane/assets/manifest": \`\${import.meta.dirname}/apps/${name}/app/test/assets-manifest.ts\`,
					},
				},
				test: {
					name: "${name}",
					include: ["**/*.test.ts?(x)"],
					pool: "threads",
					testTimeout: 20_000,
				},
			},`;
	let marker = "\t\ttest: {\n\t\t\tprojects: [";
	let index = source.indexOf(marker);
	if (index === -1) {
		return failure(new Error("vite.config.ts has no test.projects array to append to"));
	}
	let insertAt = index + marker.length;
	return ok(`${source.slice(0, insertAt)}${block}${source.slice(insertAt)}`);
}

/** Adds `name` to `CONVERTED_APPS` when absent. */
function ensureConvertedApp(source: string, name: string) {
	if (source.includes(`"${name}"`)) return ok(source);
	let marker = "export const CONVERTED_APPS = [";
	let index = source.indexOf(marker);
	if (index === -1) {
		return failure(new Error("test/app-layout.ts has no CONVERTED_APPS list"));
	}
	let open = index + marker.length;
	return ok(`${source.slice(0, open)}\n\t"${name}",${source.slice(open)}`);
}

/** Adds `name` to the Deploy-app workflow choice list when absent (before `all` when present). */
function ensureDeployOption(source: string, name: string) {
	if (new RegExp(`^\\s+- ${name}$`, "m").test(source)) return ok(source);
	let allMatch = source.match(/^(\s+- )all$/m);
	if (allMatch && allMatch.index !== undefined) {
		return ok(
			`${source.slice(0, allMatch.index)}${allMatch[1]}${name}\n${source.slice(allMatch.index)}`,
		);
	}
	let marker = "        options:\n";
	let index = source.indexOf(marker);
	if (index === -1) {
		return failure(new Error("deploy-apps.yml has no workflow_dispatch app options list"));
	}
	let insertAt = index + marker.length;
	return ok(`${source.slice(0, insertAt)}          - ${name}\n${source.slice(insertAt)}`);
}
