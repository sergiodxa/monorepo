/**
 * Publishes the app's flags onto a job context built by hand, so a handler under test
 * reads the definitions it will read in production rather than falling back to whatever
 * default its call site passed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyJobContext } from "@sdxc/jobs";

import { Flags } from "@sdxc/flags/middleware";

import { flags } from "~/app/lib/flags";

/**
 * Installs `ctx.flags` the way the dispatcher's middleware does, awaiting the provider so
 * an evaluation resolves against the set instead of reporting `PROVIDER_NOT_READY`.
 *
 * @param ctx - The context the handler under test will run on.
 * @example
 * let ctx = createJobContext(jobs.checkTcp, { id: "message-1", attempts: 1, log });
 * await installFlags(ctx);
 */
export async function installFlags(ctx: AnyJobContext): Promise<void> {
	await flags.ready();
	ctx.set(Flags, flags.getClient(), { property: "flags" });
}
