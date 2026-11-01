#!/usr/bin/env node
/**
 * The `sdxc-well-known` command-line program: the contract in `cli-contract.ts` with each
 * command mapped onto its handler, which loads only when that command runs. Exit codes: 0
 * done, 1 a document with problems, 2 usage, unreadable input or an unreachable origin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { WELL_KNOWN_COMMANDS } from "./cli-contract.js";

/** The `sdxc-well-known` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-well-known", commands: WELL_KNOWN_COMMANDS });

cli.map(
	WELL_KNOWN_COMMANDS["security-txt"].check,
	lazy(() => import("./cli-security-txt-check.js")),
);
cli.map(
	WELL_KNOWN_COMMANDS.fetch,
	lazy(() => import("./cli-fetch.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
