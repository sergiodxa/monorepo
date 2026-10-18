/**
 * The `remix` check: the project pins `remix` to the peer its release's `@sdxc/*` packages
 * declare, read from that release's `@sdxc/kit` as `sdxc upgrade` reads it, so an install
 * resolves the peer every package pins exactly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";

import { currentRelease, lists } from "../upgrade/project.js";
import { RELEASE_PACKAGE } from "../upgrade/registry.js";

import type { Check, CheckResult } from "./check.js";

import { passed, rangeOf, skipped } from "./check.js";
import { exactInstallCommand } from "./install.js";

/** Fails when the `remix` pin differs from the release's peer, and fixes it by pinning the peer. */
export const remixCheck: Check = {
	name: "remix",
	async run(context): Promise<CheckResult> {
		if (!lists(context.manifest, "remix")) return skipped("package.json lists no remix");
		let release = currentRelease(context.manifest);
		if (release === null) return skipped("package.json pins no @sdxc package to a release");
		let kit = await context.packument(RELEASE_PACKAGE);
		if (isFailure(kit)) return skipped(kit.error.message);
		let peers = kit.data.versions.get(release);
		if (peers === undefined) return skipped(`Release ${release} is not published on npm`);
		let peer = peers.remix;
		if (peer === undefined) return skipped(`Release ${release} declares no remix peer`);
		let pinned = rangeOf(context.manifest, "remix");
		if (pinned === peer) return passed(`remix ${peer} is the peer release ${release} declares`);
		return {
			status: "fail",
			message: `remix ${pinned} differs from the ${peer} release ${release} declares`,
			findings: [`remix ${pinned} -> ${peer}`],
			fix: exactInstallCommand(context.manager, context.manifest, new Map([["remix", peer]])),
		};
	},
};
