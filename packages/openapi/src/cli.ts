#!/usr/bin/env node
/**
 * The `sdxc-openapi` command-line program: the contract in `cli-contract.ts` with `check`
 * mapped onto its handler, which loads only when it runs. Exit codes: 0 a valid document,
 * 1 findings, 2 usage or input that could not be read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { OPENAPI_COMMANDS } from "./cli-contract.js";

/** The `sdxc-openapi` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-openapi", commands: OPENAPI_COMMANDS });

cli.map(
	OPENAPI_COMMANDS.check,
	lazy(() => import("./cli-check.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
