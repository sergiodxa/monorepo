#!/usr/bin/env node
/**
 * The `sdxc-webmention` command-line program: the contract in `cli-contract.ts` with each
 * command mapped onto its handler, which loads only when that command runs. Exit codes: 0 done,
 * 1 no endpoint, a refused mention or a source without the link, 2 usage or an unusable URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { WEBMENTION_COMMANDS } from "./cli-contract.js";

/** The `sdxc-webmention` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-webmention", commands: WEBMENTION_COMMANDS });

cli.map(
	WEBMENTION_COMMANDS.discover,
	lazy(() => import("./cli-discover.js")),
);
cli.map(
	WEBMENTION_COMMANDS.send,
	lazy(() => import("./cli-send.js")),
);
cli.map(
	WEBMENTION_COMMANDS.verify,
	lazy(() => import("./cli-verify.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
