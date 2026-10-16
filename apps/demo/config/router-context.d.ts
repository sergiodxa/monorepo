/**
 * Request context members a handler typed by `RequestContext` reads: the 404 handler, which the
 * router is built from and so cannot name `AppContext`, and every MCP tool and resource, whose
 * context the MCP handler types as `RequestContext`. The router's global chain installs each.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BoundRegistry } from "@sdxc/data-model";
import type { RemixNode } from "remix/component";
import type { Renderer } from "remix/middleware/render";
import type {} from "remix/router";

import type registry from "~/app/models";

declare module "remix/router" {
	interface RequestContext {
		/** Renders a `remix/component` node into an HTML `Response`. */
		render: Renderer<RemixNode>;
		/** The board's models, bound to `ctx.db` by the global `models()` middleware. */
		models: BoundRegistry<typeof registry>;
	}
}

export {};
