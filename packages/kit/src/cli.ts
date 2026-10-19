/**
 * The `sdxc` command line: its contract with every handler mapped through `lazy()`, so a run
 * imports only the command it reaches and `--help` imports none. The `sdxc` binary runs it
 * against the process; a test builds its own with a fixture kit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import type { CLI } from "@sdxc/cli";

import { createCLI, lazy } from "@sdxc/cli";

import { SDXC_COMMANDS } from "./contract.js";
import { packageRoot } from "./middleware.js";

/** What the binary and the tests vary between runs. */
export interface SDXCOptions {
	/** Printed by `--version`; without one the flag does not exist. */
	version?: string;
	/**
	 * The kit package commands read templates, stubs, the component registry and the
	 * changelog from.
	 * @default the package this module runs from
	 */
	packageRoot?: string;
}

/**
 * The version in the kit's own `package.json`, which sits one level above both `src/` and
 * `dist/`, so `--version` names the release whichever binary started the run.
 */
export function kitVersion(): string | undefined {
	let manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
		version?: unknown;
	};
	return typeof manifest.version === "string" ? manifest.version : undefined;
}

/**
 * Builds the `sdxc` command line.
 *
 * @example process.exitCode = await createSDXC({ version }).run(process.argv.slice(2));
 */
export function createSDXC(
	options: SDXCOptions = {},
): CLI<typeof SDXC_COMMANDS, readonly [ReturnType<typeof packageRoot>]> {
	let cli = createCLI({
		name: "sdxc",
		version: options.version,
		commands: SDXC_COMMANDS,
		middleware: [packageRoot(options.packageRoot)],
	});
	cli.map(
		SDXC_COMMANDS.create,
		lazy(() => import("./commands/create.js")),
	);
	cli.map(
		SDXC_COMMANDS.deploy,
		lazy(() => import("./commands/deploy.js")),
	);
	cli.map(
		SDXC_COMMANDS.doctor,
		lazy(() => import("./commands/doctor.js")),
	);
	cli.map(
		SDXC_COMMANDS.init,
		lazy(() => import("./commands/init.js")),
	);
	cli.map(
		SDXC_COMMANDS.make,
		lazy(() => import("./commands/make.js").then((module) => ({ default: module.group }))),
	);
	cli.map(
		SDXC_COMMANDS.make.controller,
		lazy(() => import("./commands/make.js").then((module) => ({ default: module.controller }))),
	);
	cli.map(
		SDXC_COMMANDS.make.middleware,
		lazy(() => import("./commands/make.js").then((module) => ({ default: module.middleware }))),
	);
	cli.map(
		SDXC_COMMANDS.make.validator,
		lazy(() => import("./commands/make.js").then((module) => ({ default: module.validator }))),
	);
	cli.map(
		SDXC_COMMANDS.make.job,
		lazy(() => import("./commands/make.js").then((module) => ({ default: module.job }))),
	);
	cli.map(
		SDXC_COMMANDS.make.model,
		lazy(() => import("./commands/make.js").then((module) => ({ default: module.model }))),
	);
	cli.map(
		SDXC_COMMANDS.make.migration,
		lazy(() => import("./commands/make.js").then((module) => ({ default: module.migration }))),
	);
	cli.map(
		SDXC_COMMANDS.make.factory,
		lazy(() => import("./commands/make.js").then((module) => ({ default: module.factory }))),
	);
	cli.map(
		SDXC_COMMANDS.make.service,
		lazy(() => import("./commands/make.js").then((module) => ({ default: module.service }))),
	);
	cli.map(
		SDXC_COMMANDS.make.policy,
		lazy(() => import("./commands/make.js").then((module) => ({ default: module.policy }))),
	);
	cli.map(
		SDXC_COMMANDS.make.initializer,
		lazy(() => import("./commands/make.js").then((module) => ({ default: module.initializer }))),
	);
	cli.map(
		SDXC_COMMANDS.make.email,
		lazy(() => import("./commands/make.js").then((module) => ({ default: module.email }))),
	);
	cli.map(
		SDXC_COMMANDS.make.mcp,
		lazy(() => import("./commands/make.js").then((module) => ({ default: module.mcp }))),
	);
	cli.map(
		SDXC_COMMANDS.make.command,
		lazy(() => import("./commands/make.js").then((module) => ({ default: module.command }))),
	);
	cli.map(
		SDXC_COMMANDS.make.test,
		lazy(() => import("./commands/make.js").then((module) => ({ default: module.test }))),
	);
	cli.map(
		SDXC_COMMANDS.make.stubs,
		lazy(() => import("./commands/make.js").then((module) => ({ default: module.stubs }))),
	);
	cli.map(
		SDXC_COMMANDS.routes,
		lazy(() => import("./commands/routes.js")),
	);
	cli.map(
		SDXC_COMMANDS.scaffold,
		lazy(() => import("./commands/scaffold.js")),
	);
	cli.map(
		SDXC_COMMANDS.run,
		lazy(() => import("./commands/run.js")),
	);
	cli.map(
		SDXC_COMMANDS.ui.list,
		lazy(() => import("./commands/ui/list.js")),
	);
	cli.map(
		SDXC_COMMANDS.ui.add,
		lazy(() => import("./commands/ui/add.js")),
	);
	cli.map(
		SDXC_COMMANDS.ui.diff,
		lazy(() => import("./commands/ui/diff.js")),
	);
	cli.map(
		SDXC_COMMANDS.ui.update,
		lazy(() => import("./commands/ui/update.js")),
	);
	cli.map(
		SDXC_COMMANDS.ui.remove,
		lazy(() => import("./commands/ui/remove.js")),
	);
	cli.map(
		SDXC_COMMANDS.upgrade,
		lazy(() => import("./commands/upgrade.js")),
	);
	return cli;
}
