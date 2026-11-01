/**
 * The `sdxc-jsdoc extract` handler: runs `extract` over every source file named and writes one
 * `DocProject` as JSON. Each syntax error is printed as `path:line:column message`, the place an
 * editor jumps to, and a failed file withholds the document unless `--keep-going`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { JSDOC_COMMANDS } from "./cli-contract.js";
import { readSources } from "./cli-sources.js";

import type { DocModule, DocProject } from "./index.js";

import { extract, SCHEMA_VERSION } from "./index.js";

/** The fields of a `package.json` the project is named after. */
interface PackageIdentity {
	name: string;
	version: string;
}

/**
 * Exits 1 after listing every failure, so one run reports each broken file; with `--keep-going`
 * the failures are still listed and the document carries the modules that parsed.
 */
export default createCommand(JSDOC_COMMANDS.extract, async (ctx) => {
	let sources = await readSources(ctx, ctx.arguments.paths, ctx.flags.stdinPath);
	if (isFailure(sources)) return sources;

	let modules: DocModule[] = [];
	let failed = 0;
	for (let { path, source } of sources.data) {
		let result = extract(source, { path, includeInternal: ctx.flags.includeInternal });
		if (isFailure(result)) {
			failed += 1;
			for (let { line, column, message } of result.error.diagnostics) {
				ctx.stderr(`${path}:${line}:${column} ${message}\n`);
			}
			continue;
		}
		modules.push(result.data);
	}

	let noun = failed === 1 ? "file" : "files";
	if (failed > 0 && !ctx.flags.keepGoing) {
		return exit(1, `${failed} ${noun} did not parse; pass --keep-going to extract the rest`);
	}

	let identity = await packageIdentity(ctx.cwd);
	let project: DocProject = {
		schema: SCHEMA_VERSION,
		name: ctx.flags.name ?? identity.name,
		version: ctx.flags.projectVersion ?? identity.version,
		modules,
	};
	let json = `${JSON.stringify(project, null, "\t")}\n`;

	if (ctx.flags.output === undefined) {
		ctx.stdout(json);
	} else {
		try {
			await writeFile(resolve(ctx.cwd, ctx.flags.output), json, "utf8");
		} catch (error) {
			let reason = error instanceof Error ? error.message : String(error);
			return exit(2, `Cannot write ${ctx.flags.output}: ${reason}`);
		}
		ctx.stderr(`Wrote ${modules.length} modules to ${ctx.flags.output}\n`);
	}
	if (failed > 0) ctx.stderr(`Left out ${failed} ${noun} that did not parse\n`);
	return success();
});

/**
 * The name and version of `package.json` in the run's directory, each an empty string when the
 * file is missing, unreadable or lacks the field, so a loose folder of scripts still extracts.
 */
async function packageIdentity(cwd: string): Promise<PackageIdentity> {
	let manifest: unknown = null;
	try {
		manifest = JSON.parse(await readFile(join(cwd, "package.json"), "utf8"));
	} catch {
		return { name: "", version: "" };
	}
	let record = typeof manifest === "object" && manifest !== null ? manifest : {};
	let name = "name" in record && typeof record.name === "string" ? record.name : "";
	let version = "version" in record && typeof record.version === "string" ? record.version : "";
	return { name, version };
}
