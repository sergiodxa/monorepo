#!/usr/bin/env node
/**
 * The `sdxc-icalendar` command-line program: the contract in `cli-contract.ts` with each
 * command mapped onto its handler, loaded only when that command runs. Exit codes: 0 done,
 * 1 the calendar or rule has problems, 2 usage or unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { ICALENDAR_COMMANDS } from "./cli-contract.js";

/** The `sdxc-icalendar` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-icalendar", commands: ICALENDAR_COMMANDS });

cli.map(
	ICALENDAR_COMMANDS.validate,
	lazy(() => import("./cli-validate.js")),
);
cli.map(
	ICALENDAR_COMMANDS.expand,
	lazy(() => import("./cli-expand.js")),
);
cli.map(
	ICALENDAR_COMMANDS.rrule,
	lazy(() => import("./cli-rrule.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
