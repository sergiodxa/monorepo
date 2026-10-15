/**
 * The `spec` command line as a contract: `spec run [directory]` with its scheduling,
 * generated-data, diagnostics and `--allow-*` permission flags. Help, usage errors and the
 * handler's typed `ctx.flags` all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Schema } from "remix/data-schema";

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/**
 * A decimal integer of at least `min`, written as digits only, so `+8`, `8.0`, `0x8` and ` 8`
 * are usage errors; the error line names the flag as it was typed.
 *
 * @param min - The smallest accepted value
 */
function integer(min: number): Schema<unknown, number> {
	let wanted = min === 0 ? "a non-negative integer" : "a positive integer";
	return s.createSchema(function validate(value, context) {
		if (typeof value === "string" && /^\d+$/.test(value) && Number(value) >= min) {
			return { value: Number(value) };
		}
		return s.fail(`expects ${wanted}; got ${JSON.stringify(value)}`, context.path);
	});
}

/**
 * A permission flag: bare grants its whole family, `=a,b` scopes it, repeats union, and a bare
 * occurrence absorbs every scope.
 *
 * @param name - The flag's long name, `allow-<family>`
 * @param valueName - What one scope is, for the help
 * @param description - What the grant lets a spec do
 */
function permission(name: string, valueName: string, description: string) {
	return flag
		.string(name, { valueName, description, heading: "Permissions (denied unless granted)" })
		.optionalValue()
		.list();
}

/** Every command `spec` takes. */
export const SPEC_COMMANDS = commands({
	description: "spec — executable specifications",
	run: command({
		description:
			"Run the suite. Every permission is denied unless an --allow-* flag grants it; a denial names the flag that grants it.",
		arguments: {
			directory: argument(s.string(), {
				default: "spec",
				description: "The suite directory",
			}),
		},
		flags: {
			concurrency: flag.string("concurrency", {
				aliases: ["jobs"],
				valueName: "N",
				default: 1,
				schema: integer(1),
				description: "Run up to N tests at once",
				heading: "Scheduling",
			}),
			retries: flag.string("retries", {
				valueName: "N",
				default: 0,
				schema: integer(0),
				description: "Retry a failing test N more times",
				heading: "Scheduling",
			}),
			seed: flag.string("seed", {
				description:
					"Seed the data sample generates (default: fixed); random draws one and prints it to replay",
				heading: "Generated data",
			}),
			runId: flag.string("run-id", {
				description: "Name this run, replaying the one printed in the header",
				heading: "Generated data",
			}),
			artifacts: flag.string("artifacts", {
				valueName: "dir",
				description: "Write failure screenshots and dumps under this directory",
				heading: "Diagnostics",
			}),
			allowRun: permission("allow-run", "name", "Execute processes, scoped to executable names"),
			allowNet: permission("allow-net", "host[:port]", "Reach the network, scoped to hosts"),
			allowEnv: permission("allow-env", "var", "Read environment variables, scoped to names"),
			allowHostFs: permission(
				"allow-host-fs",
				"dir",
				"Touch the host filesystem outside the workspace, scoped to directories",
			),
			allowDb: permission("allow-db", "name", "Query databases, scoped to connection names"),
			allowPlugins: permission(
				"allow-plugins",
				"ns",
				"Launch the plugins spec/config.jsonc declares, scoped to namespaces",
			),
			allowConfig: flag.boolean("allow-config", {
				description: "Apply the permissions spec/config.jsonc declares",
				heading: "Permissions (denied unless granted)",
			}),
		},
		examples: [
			"run",
			"run e2e --allow-net=localhost:3000 --allow-env=API_TOKEN",
			"run --seed=random --jobs=4",
		],
	}),
});
