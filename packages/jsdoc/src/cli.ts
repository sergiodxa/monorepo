#!/usr/bin/env node
/**
 * The `sdxc-jsdoc` command-line program: the contract in `cli-contract.ts` with `extract` mapped
 * onto its handler, which loads only when it runs. Exit codes: 0 done, 1 a source file did not
 * parse, 2 usage or an unreadable path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { JSDOC_COMMANDS } from "./cli-contract.js";

/** The `sdxc-jsdoc` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-jsdoc", commands: JSDOC_COMMANDS });

cli.map(
	JSDOC_COMMANDS.extract,
	lazy(() => import("./cli-extract.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
