#!/usr/bin/env node
/**
 * The `sdxc-json-canonical` command-line program: the contract in `cli-contract.ts` with each
 * command mapped onto its handler, loaded only when that command runs. Exit codes: 0 done,
 * 1 JSON outside I-JSON, 2 usage or unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { JSON_CANONICAL_COMMANDS } from "./cli-contract.js";

/** The `sdxc-json-canonical` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-json-canonical", commands: JSON_CANONICAL_COMMANDS });

cli.map(
	JSON_CANONICAL_COMMANDS.canonicalize,
	lazy(() => import("./cli-canonicalize.js")),
);
cli.map(
	JSON_CANONICAL_COMMANDS.hash,
	lazy(() => import("./cli-hash.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
