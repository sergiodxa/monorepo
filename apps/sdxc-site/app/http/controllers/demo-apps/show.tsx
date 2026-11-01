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

import defaultHandler from "~/app/http/controllers/default-handler";
import { DEMO_APP_TOAST_PARAM, findDemoApp } from "~/resources/views/demo-apps";
import DemoAppDocument from "~/resources/views/demo-apps/document";
import routes from "~/routes/web";

/** The params a request carries; `page` is absent on the home screen. */
const PARAMS = s.object({ app: s.string(), page: s.optional(s.string()) });

/**
 * Renders the screen the path names, or the app's own 404 screen. An unknown app answers the
 * site's 404. A `toast` parameter naming one of the app's toasts shows it once; any other
 * value is ignored, so the address can never put words on the page.
 */
export default createAction(routes.demoApps.show, async (ctx) => {
	let { app: slug, page = "" } = s.parse(PARAMS, ctx.params);
	let app = await findDemoApp(slug);
	if (app === null) return defaultHandler(ctx);

	let screen = await app.render({
		page,
		url: ctx.url,
		cookie: ctx.request.headers.get("Cookie"),
	});

	return ctx.render(
		<DemoAppDocument
			assets={ctx.assets}
			app={app}
			screen={screen}
			toast={ctx.url.searchParams.get(DEMO_APP_TOAST_PARAM)}
		/>,
		{ status: screen.status ?? 200 },
	);
});
