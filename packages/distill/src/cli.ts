#!/usr/bin/env node
/**
 * The `sdxc-distill` command-line program: the contract in `cli-contract.ts` with `extract`
 * mapped onto its handler, which loads only when it runs. Exit codes: 0 extracted, 1 no
 * article, 2 usage or unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { DISTILL_COMMANDS } from "./cli-contract.js";

/** The `sdxc-distill` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-distill", commands: DISTILL_COMMANDS });

cli.map(
	DISTILL_COMMANDS.extract,
	lazy(() => import("./cli-extract.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
