/**
 * Runs the kit's source rules over the whole monorepo and fails on any finding. The kit warns on
 * them inside one app's layout; here packages, the command line and scripts follow them too, and
 * CI holds every workspace to them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ProjectCheck, ProjectCheckContext } from "@sdxc/kit/doctor";

import { defineCheck } from "@sdxc/kit/doctor";

import type { SourceRule } from "../../../packages/kit/src/doctor/source-rule.js";

import { CONSTANT_NAMES_RULE } from "../../../packages/kit/src/doctor/constant-names.js";
import { FETCH_PARAM_RULE } from "../../../packages/kit/src/doctor/fetch-param.js";
import { LOCAL_CONST_RULE } from "../../../packages/kit/src/doctor/local-const.js";
import { LOGGER_RULE } from "../../../packages/kit/src/doctor/logger.js";
import { PROCESS_ENV_RULE } from "../../../packages/kit/src/doctor/process-env.js";
import { appliesTo } from "../../../packages/kit/src/doctor/source-rule.js";
import { STACK_IMPORTS_RULE } from "../../../packages/kit/src/doctor/stack-imports.js";
import { PROJECT_FOLDERS } from "../../../packages/kit/src/stats.js";

/** Folders scanned at the monorepo root. */
const FOLDERS = ["apps", "packages", "cli", "scripts", "test", ".config"] as const;

/** Generated or vendored files, which follow the conventions of whatever produced them. */
const GENERATED = /\/(?:node_modules|dist|\.cloudflare)\/|\/mockServiceWorker\.js$/;

/** A file inside an app's own layout, where the Worker-only rules apply. */
const APP_LAYOUT = new RegExp(`^apps/[^/]+/(?:${PROJECT_FOLDERS.join("|")})/`);

/** Each rule, and whether it covers every workspace or only the code an app's Worker runs. */
const RULES: readonly [rule: SourceRule, scope: "everywhere" | "app layout"][] = [
	[LOCAL_CONST_RULE, "everywhere"],
	[CONSTANT_NAMES_RULE, "everywhere"],
	[STACK_IMPORTS_RULE, "everywhere"],
	[FETCH_PARAM_RULE, "everywhere"],
	[PROCESS_ENV_RULE, "app layout"],
	[LOGGER_RULE, "app layout"],
];

/** The monorepo check for `rule`, named after it with a `monorepo-` prefix. */
function monorepoCheck(rule: SourceRule, scope: "everywhere" | "app layout"): ProjectCheck {
	return defineCheck({
		name: `monorepo-${rule.name}`,
		async run(ctx) {
			let findings: string[] = [];
			for (let file of await sourceFiles(ctx)) {
				if (!appliesTo(rule, file)) continue;
				if (scope === "app layout" && !APP_LAYOUT.test(file)) continue;
				let text = await ctx.readFile(file);
				if (text === null) continue;
				for (let found of rule.find(appRelative(file), text)) {
					findings.push(`${file}:${found.line}: ${found.message}`);
				}
			}
			if (findings.length === 0) return { status: "pass", message: rule.passed };
			let [one, many] = rule.noun;
			return {
				status: "fail",
				message: `Found ${findings.length} ${findings.length === 1 ? one : many}`,
				findings,
				fix: rule.fix,
			};
		},
	});
}

/** Every file under the scanned folders, generated ones left out. */
async function sourceFiles(ctx: ProjectCheckContext): Promise<string[]> {
	let files: string[] = [];
	for (let folder of FOLDERS) {
		for (let file of await ctx.files(folder)) if (!GENERATED.test(`/${file}`)) files.push(file);
	}
	return files;
}

/** `file` relative to its app, so a rule reads `app/initializers/…` as it does inside the app. */
function appRelative(file: string): string {
	return file.replace(/^apps\/[^/]+\//, "");
}

export default RULES.map(([rule, scope]) => monorepoCheck(rule, scope));
