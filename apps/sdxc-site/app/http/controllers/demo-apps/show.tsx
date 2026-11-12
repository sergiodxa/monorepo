/**
 * `GET /demo/apps/:app(/*page)` — a complete sample app built from `@sdxc/ui/app`, every
 * screen drawn from fixture data in the app's own art direction, with the toast a form's
 * redirect named. Marked `noindex, nofollow`, since each app runs an invented product.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { cookieVariant, withStreamCache } from "~/app/http/caching";
import defaultHandler from "~/app/http/controllers/default-handler";
import { DEMO_APP_TOAST_PARAM, findDemoApp, readToastParam } from "~/resources/views/demo-apps";
import DemoAppDocument from "~/resources/views/demo-apps/document";
import routes from "~/routes/web";

/** The params a request carries; `page` is absent on the home screen. */
const PARAMS = s.object({ app: s.string(), page: s.optional(s.string()) });

/**
 * Renders the screen the path names, or the app's own 404 screen. An unknown app answers the
 * site's 404. A `toast` parameter naming one of the app's toasts shows it once, and a reload
 * of the same address shows nothing new; any other value is ignored, so the address can never
 * put words on the page. A request naming one of the screen's frames in `X-Remix-Target`
 * answers only that frame's content. Pages and frames are cached per address, target and value
 * of the cookies the app reads; a toast's page never is, nor is anything drawn for one visitor.
 */
export default createAction(routes.demoApps.show, async (ctx) => {
	let { app: slug, page = "" } = s.parse(PARAMS, ctx.params);
	let app = await findDemoApp(slug);
	if (app === null) return defaultHandler(ctx);

	let param = ctx.url.searchParams.get(DEMO_APP_TOAST_PARAM);
	let toast = param === null ? null : readToastParam(param);
	let url = new URL(ctx.url);
	if (toast !== null) url.searchParams.set(DEMO_APP_TOAST_PARAM, toast.key);

	let cookie = ctx.request.headers.get("Cookie");
	let target = ctx.request.headers.get("X-Remix-Target");
	let fragment = target === null ? null : await app.target?.(target, { page, url, cookie });
	if (fragment !== null && fragment !== undefined) {
		if (app.isPersonal?.(cookie)) return varyByTarget(ctx.render(fragment));
		let variant = `${ctx.url.search}|${target}|${cookieVariant(cookie, app.cookies)}`;
		return varyByTarget(
			await withStreamCache(ctx.request, variant, async () => ctx.render(fragment)),
		);
	}

	let renderPage = async () => {
		let screen = await app.render({ page, url, cookie });
		return ctx.render(
			<DemoAppDocument assets={ctx.assets} app={app} screen={screen} toast={toast} />,
			{ status: screen.status ?? 200 },
		);
	};
	if (toast !== null || app.isPersonal?.(cookie)) return varyByTarget(await renderPage());

	let variant = `${ctx.url.search}|${cookieVariant(cookie, app.cookies)}`;
	return varyByTarget(await withStreamCache(ctx.request, variant, renderPage));
});

/**
 * Marks an answer as varying by `X-Remix-Target`, since one address answers a whole screen or
 * one of its frames, so a browser or proxy never serves a stored fragment for a page load.
 */
function varyByTarget(response: Response): Response {
	let headers = new Headers(response.headers);
	headers.append("Vary", "X-Remix-Target");
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
