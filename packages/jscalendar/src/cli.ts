#!/usr/bin/env node
/**
 * The `sdxc-jscalendar` command-line program: the contract in `cli-contract.ts` with `convert`,
 * `expand` and `validate` mapped onto their handlers, each loaded only when it runs. Exit codes:
 * 0 done, 1 problems found, 2 usage or unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { JSCALENDAR_COMMANDS } from "./cli-contract.js";

/** The `sdxc-jscalendar` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-jscalendar", commands: JSCALENDAR_COMMANDS });

cli.map(
	JSCALENDAR_COMMANDS.convert,
	lazy(() => import("./cli-convert.js")),
);
cli.map(
	JSCALENDAR_COMMANDS.expand,
	lazy(() => import("./cli-expand.js")),
);
cli.map(
	JSCALENDAR_COMMANDS.validate,
	lazy(() => import("./cli-validate.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
