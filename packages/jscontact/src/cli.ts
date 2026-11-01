#!/usr/bin/env node
/**
 * The `sdxc-jscontact` command-line program: the contract in `cli-contract.ts` with each
 * command mapped onto its handler, which loads only when that command runs. Exit codes: 0
 * done, 1 an invalid Card, 2 usage or unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { JSCONTACT_COMMANDS } from "./cli-contract.js";

/** The `sdxc-jscontact` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-jscontact", commands: JSCONTACT_COMMANDS });

cli.map(
	JSCONTACT_COMMANDS.convert,
	lazy(() => import("./cli-convert.js")),
);
cli.map(
	JSCONTACT_COMMANDS.validate,
	lazy(() => import("./cli-validate.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
