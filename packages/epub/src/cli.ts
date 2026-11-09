#!/usr/bin/env node
/**
 * The `sdxc-epub` command-line program: the contract in `cli-contract.ts` with each command
 * mapped onto its handler, which loads only when that command runs. Exit codes: 0 done, 1 the
 * check found a problem in the book, 2 usage, unreadable input or a book `build` cannot write.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { EPUB_COMMANDS } from "./cli-contract.js";

/** The `sdxc-epub` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-epub", commands: EPUB_COMMANDS });

cli.map(
	EPUB_COMMANDS.build,
	lazy(() => import("./cli-build.js")),
);
cli.map(
	EPUB_COMMANDS.check,
	lazy(() => import("./cli-check.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
