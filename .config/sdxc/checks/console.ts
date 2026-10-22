/**
 * Warns on `console.*` in monorepo source: logging goes through `@sdxc/logger` (`ctx.log` /
 * `currentLog()`). Warn so the backlog surfaces without failing CI; tighten to fail once callers
 * are clean. This is a repo check — consumer apps are not assumed to use that package.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defineCheck } from "@sdxc/kit/doctor";

/** Matches a `console.` call or property access. */
const CONSOLE = /\bconsole\s*\./;

/** Folders scanned at the monorepo root. */
const FOLDERS = ["apps", "packages", "cli", "scripts", "test"] as const;

/** Paths that may name `console` (CLIs that print, docs, or the logger package itself). */
function allowed(path: string): boolean {
	if (path.includes("/node_modules/")) return true;
	if (path.includes("/dist/")) return true;
	if (path.includes("/.cloudflare/")) return true;
	if (path.endsWith(".d.ts")) return true;
	if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)) return true;
	if (path.endsWith(".md") || path.endsWith(".mdx")) return true;
	if (path.startsWith("packages/logger/")) return true;
	if (path.startsWith("packages/kit/templates/")) return true;
	if (path.startsWith("packages/kit/stubs/")) return true;
	return false;
}

export default defineCheck({
	name: "console",
	async run(ctx) {
		let findings: string[] = [];
		for (let folder of FOLDERS) {
			for (let file of await ctx.files(folder)) {
				if (!/\.[cm]?[jt]sx?$/.test(file) || allowed(file)) continue;
				let text = await ctx.readFile(file);
				if (text === null) continue;
				let lines = text.split("\n");
				for (let index = 0; index < lines.length; index++) {
					let line = lines[index]!;
					if (!CONSOLE.test(line)) continue;
					findings.push(`${file}:${index + 1}: ${line.trim()}`);
				}
			}
		}
		if (findings.length === 0) {
			return { status: "pass", message: "No console.* in app or package source" };
		}
		return {
			status: "warn",
			message:
				findings.length === 1 ? "Found 1 console.* use" : `Found ${findings.length} console.* uses`,
			findings,
			fix: "Log through @sdxc/logger (ctx.log or currentLog()) instead of console",
		};
	},
});
