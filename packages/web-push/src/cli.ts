#!/usr/bin/env node
/**
 * The `sdxc-web-push` command-line program: the contract in `cli-contract.ts` with each command
 * mapped onto its handler, which loads only when that command runs. Exit codes: 0 done, 1 the
 * push service refused the message, 2 usage or unreadable input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { WEB_PUSH_COMMANDS } from "./cli-contract.js";

/** The `sdxc-web-push` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-web-push", commands: WEB_PUSH_COMMANDS });

cli.map(
	WEB_PUSH_COMMANDS.vapid.keygen,
	lazy(() => import("./cli-vapid-keygen.js")),
);
cli.map(
	WEB_PUSH_COMMANDS.send,
	lazy(() => import("./cli-send.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
