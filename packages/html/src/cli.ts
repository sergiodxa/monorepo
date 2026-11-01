#!/usr/bin/env node
/**
 * The `sdxc-html` command-line program: the contract in `cli-contract.ts` with each command
 * mapped onto its handler, which loads only when that command runs. Exit codes: 0 matched,
 * 1 nothing matched, 2 usage or unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { HTML_COMMANDS } from "./cli-contract.js";

/** The `sdxc-html` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-html", commands: HTML_COMMANDS });

cli.map(
	HTML_COMMANDS.query,
	lazy(() => import("./cli-query.js")),
);
cli.map(
	HTML_COMMANDS.outline,
	lazy(() => import("./cli-outline.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
