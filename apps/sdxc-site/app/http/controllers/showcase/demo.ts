/**
 * `/showcase/:slug/demo(/*page)` and its frames — the one address every demo answers on,
 * whatever its kind. The slug names a landing, a docs site or an app, and each request is
 * handed to that kind's controller, loaded only when a request reaches it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import defaultHandler from "~/app/http/controllers/default-handler";
import { findDemoKind } from "~/app/services/demos";
import { SUBSCRIBE_PAGE } from "~/resources/views/demo-blogs";
import { FEEDBACK_PAGE } from "~/resources/views/demo-docs/feedback";
import routes from "~/routes/web";

/** The params every demo address carries; `page` is absent on a demo's home. */
const PARAMS = s.object({ slug: s.string(), page: s.optional(s.string()) });

/** A controller module whose default export is an action, in either of the shapes it takes. */
interface ActionModule<context> {
	default:
		| ((context: context) => Response | Promise<Response>)
		| { handler: (context: context) => Response | Promise<Response> };
}

/**
 * Runs the action a kind's controller exports with the request's own context, which carries
 * the same route's params.
 */
async function run<context>(module: ActionModule<context>, ctx: context): Promise<Response> {
	let action = module.default;
	return typeof action === "function" ? await action(ctx) : await action.handler(ctx);
}

/** A plain-text `404`, for a fragment or post no demo answers. */
function notFound(): Response {
	return new Response("Not found.", {
		status: 404,
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}

/**
 * Renders a demo page. A docs site's `.md` path is its Markdown twin; an app's path ending in
 * `.md` stays one of its screens, since a code host names files that way. A slug with no demo,
 * such as an application in production, answers the site's 404.
 */
export const showDemo = createAction(routes.showcase.demo, async (ctx) => {
	let { page, slug } = s.parse(PARAMS, ctx.params);
	let kind = findDemoKind(slug);
	if (kind === "landing") return run(await import("~/app/http/controllers/demo"), ctx);
	if (kind === "app") return run(await import("~/app/http/controllers/demo-apps/show"), ctx);
	if (kind === "docs" && page?.endsWith(".md")) {
		return run(await import("~/app/http/controllers/demo-docs/markdown"), ctx);
	}
	if (kind === "docs") return run(await import("~/app/http/controllers/demo-docs/show"), ctx);
	if (kind === "blog") return run(await import("~/app/http/controllers/demo-blogs/show"), ctx);
	return defaultHandler(ctx);
});

/**
 * Takes a demo's form post: an app's action, a docs page's feedback vote or a blog's sign-up.
 * A landing keeps its forms on GET, so a post to one, like a post to a docs page other than
 * its vote, is `404`.
 */
export const submitDemo = createAction(routes.showcase.demoAction, async (ctx) => {
	let { page, slug } = s.parse(PARAMS, ctx.params);
	let kind = findDemoKind(slug);
	if (kind === "app") return run(await import("~/app/http/controllers/demo-apps/action"), ctx);
	if (kind === "docs" && page === FEEDBACK_PAGE) {
		return run(await import("~/app/http/controllers/demo-docs/feedback"), ctx);
	}
	if (kind === "blog" && page === SUBSCRIBE_PAGE) {
		return run(await import("~/app/http/controllers/demo-blogs/subscribe"), ctx);
	}
	return notFound();
});

/** Answers one fragment of a demo page: a part of an app's screen, or a docs page's feedback. */
export const demoFrame = createAction(routes.showcase.demoFrame, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let kind = findDemoKind(slug);
	if (kind === "app") return run(await import("~/app/http/controllers/demo-apps/frame"), ctx);
	if (kind === "docs") return run(await import("~/app/http/controllers/demo-docs/frame"), ctx);
	return notFound();
});
