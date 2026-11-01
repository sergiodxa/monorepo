#!/usr/bin/env node
/**
 * The `sdxc-doh` command-line program: the contract in `cli-contract.ts` with `lookup` mapped
 * onto its handler, which loads only when a lookup runs. Exit codes: 0 records found, 1
 * NXDOMAIN, an empty answer or a resolver error, 2 usage or an unreachable resolver.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { DOH_COMMANDS } from "./cli-contract.js";

/** The `sdxc-doh` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-doh", commands: DOH_COMMANDS });

cli.map(
	DOH_COMMANDS.lookup,
	lazy(() => import("./cli-lookup.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
