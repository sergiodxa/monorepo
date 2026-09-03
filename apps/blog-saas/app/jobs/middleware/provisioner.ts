/**
 * Publishes the blog provisioner, the one service that keeps the control plane, the
 * tenant Durable Object, and the custom hostname in step, so a job reaches it through
 * `ctx.provisioner`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { JobMiddleware } from "@sdxc/jobs";

import { createContextKey } from "remix/router";

import { BlogProvisioner } from "~/app/services/blog-provisioner";

import { Database } from "./database";
import { Hostnames } from "./hostnames";

/** The blog provisioner, published as `ctx.provisioner`. */
export const Provisioner = createContextKey<BlogProvisioner>();

/**
 * Publishes the blog provisioner for the job about to run, wired with the hostname
 * client so a purge removes the external hostname alongside the local state. Both come
 * off the context rather than being built here, so one delivery holds one database and
 * one hostname client — which is why this is declared after the two that publish them.
 *
 * @returns The middleware installing it as `ctx.provisioner`.
 */
export function provisioner(): JobMiddleware<{
	key: typeof Provisioner;
	value: BlogProvisioner;
	property: "provisioner";
}> {
	return async (ctx, next) => {
		ctx.set(Provisioner, new BlogProvisioner(ctx.require(Database), ctx.require(Hostnames)), {
			property: "provisioner",
		});
		await next();
	};
}
