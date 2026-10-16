/**
 * `about`: what this project is built on, read from its own `package.json` and the running
 * process, so a bug report or a support question starts from the exact versions in use.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";

import commandset from "~/app/commands";

import manifest from "../../package.json" with { type: "json" };

/** The runtime the command line runs on, as `Bun 1.3.0` or `Node 24.1.0`. */
function runtime(): string {
	let bun = process.versions.bun;
	return bun === undefined ? `Node ${process.versions.node}` : `Bun ${bun}`;
}

/** Prints one line per fact, or with `--json` one document a script can read. */
export default createCommand(commandset.about, (ctx) => {
	let about = {
		name: manifest.name,
		cli: manifest.dependencies["@sdxc/cli"],
		remix: manifest.dependencies.remix,
		runtime: runtime(),
	};
	if (ctx.flags.json) {
		ctx.stdout(`${JSON.stringify(about, null, 2)}\n`);
		return success();
	}
	ctx.stdout(
		`${about.name}\n  @sdxc/cli  ${about.cli}\n  remix      ${about.remix}\n  runtime    ${about.runtime}\n`,
	);
	return success();
});
