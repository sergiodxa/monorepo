/**
 * Warns when monorepo source names `randomUUID` outside `@sdxc/uuid/v4`: identifiers come from
 * that package and secrets from `@sdxc/crypto`. Warn so the backlog surfaces without failing CI;
 * tighten to fail once callers are clean. Reuses the scanner behind `test/random-uuid.test.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defineCheck } from "@sdxc/kit/doctor";

import { ALLOWED_FILES, findRandomUUIDReferences } from "../../../test/random-uuid.js";

/** Folders scanned at the monorepo root. */
const FOLDERS = ["apps", "packages", ".agents"] as const;

export default defineCheck({
	name: "uuid-secrets",
	async run(ctx) {
		let findings: string[] = [];
		for (let folder of FOLDERS) {
			for (let file of await ctx.files(folder)) {
				if (file.includes("/node_modules/") || file.includes("/dist/")) continue;
				if (file.endsWith("worker-configuration.d.ts")) continue;
				if (ALLOWED_FILES.has(file)) continue;
				if (!/\.(?:[cm]?[jt]sx?|md|mdx)$/.test(file)) continue;
				if (folder === ".agents" && !file.includes("/skills/sdxc-")) continue;
				let text = await ctx.readFile(file);
				if (text === null) continue;
				for (let found of findRandomUUIDReferences(text)) {
					findings.push(`${file}:${found.line} ${found.text}`);
				}
			}
		}
		if (findings.length === 0) {
			return {
				status: "pass",
				message: "Only @sdxc/uuid/v4 names randomUUID",
			};
		}
		return {
			status: "warn",
			message:
				findings.length === 1
					? "Found 1 randomUUID outside @sdxc/uuid/v4"
					: `Found ${findings.length} randomUUID references outside @sdxc/uuid/v4`,
			findings,
			fix: "Use generateUUID from @sdxc/uuid/v4 for ids and randomToken from @sdxc/crypto for secrets",
		};
	},
});
