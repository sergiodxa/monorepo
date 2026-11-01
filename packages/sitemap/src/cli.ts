#!/usr/bin/env node
/**
 * The `sdxc-sitemap` command-line program: the contract in `cli-contract.ts` with each command
 * mapped onto its handler, which loads only when that command runs. Exit codes: 0 done, 1
 * `validate` found a problem, 2 usage or input that could not be read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { SITEMAP_COMMANDS } from "./cli-contract.js";

/** The `sdxc-sitemap` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-sitemap", commands: SITEMAP_COMMANDS });

cli.map(
	SITEMAP_COMMANDS.list,
	lazy(() => import("./cli-list.js")),
);
cli.map(
	SITEMAP_COMMANDS.validate,
	lazy(() => import("./cli-validate.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
