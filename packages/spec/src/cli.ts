#!/usr/bin/env bun
/**
 * The `spec` command-line program: the contract in `cli-contract.ts` with `spec run` mapped
 * onto its handler, which loads only when a run starts. Exit codes: 0 all passed, 1 some test
 * failed, 2 usage or load error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { SPEC_COMMANDS } from "./cli-contract.js";

/** The `spec` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "spec", commands: SPEC_COMMANDS });

cli.map(
	SPEC_COMMANDS.run,
	lazy(() => import("./cli-run.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
