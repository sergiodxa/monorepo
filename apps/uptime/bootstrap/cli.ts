/**
 * The command line's entry point, started by `sdxc run`: it runs the command
 * the arguments name and exits with its code. The Worker never imports it, so no command ships
 * in the server build.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { plugin } from "bun";

/**
 * Serves `cloudflare:workers` to the command line with an empty `env`, so a model whose module
 * reads a Worker binding still loads; a command reaches the database through `ctx.db`, and a
 * binding read at call time comes back `undefined`.
 */
plugin({
	name: "cloudflare-workers",
	setup(build) {
		build.module("cloudflare:workers", () => ({
			exports: { env: {}, waitUntil: () => {} },
			loader: "object",
		}));
	},
});

/** Imported after the plugin, since the command modules import `cloudflare:workers`. */
let { cli } = await import("~/app/initializers/cli");

process.exitCode = await cli.run(process.argv.slice(2));
