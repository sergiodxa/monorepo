/**
 * What the app's standalone middleware reads off a bare `RequestContext`: guards such as
 * `requireSubject()` and `subjectAccess()` are typed before any router's chain exists, yet they
 * run inside the router's, which publishes `ctx.render` and `ctx.models` ahead of them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { Renderer } from "remix/middleware/render";
import type {} from "remix/router";

import type { AuthModels } from "~/app/models";

declare module "remix/router" {
	interface RequestContext {
		/** Renders a `remix/component` node into an HTML `Response`. */
		render: Renderer<RemixNode>;
		/** Typed through `AuthModels`, so a model reached from another model stays typed too. */
		models: AuthModels;
	}
}

export {};
