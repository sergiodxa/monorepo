#!/usr/bin/env node
/**
 * The `@sdxc/bench` command-line program (`sdxc-bench`): weigh an entry or sample
 * HTTP latency against a running URL. Exit codes: 0 done, 1 budget or request
 * failure, 2 usage.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCLI, lazy } from "@sdxc/cli";

import { BENCH_COMMANDS } from "./cli-contract.js";

/** The `sdxc-bench` program, run by the bin entry below and by tests through `invoke()`. */
export const cli = createCLI({ name: "sdxc-bench", commands: BENCH_COMMANDS });

cli.map(
	BENCH_COMMANDS.weigh,
	lazy(() => import("./cli-weigh.js")),
);
cli.map(
	BENCH_COMMANDS.http,
	lazy(() => import("./cli-http.js")),
);

if (import.meta.main) {
	process.exit(await cli.run(process.argv.slice(2)));
}
