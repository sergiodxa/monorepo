/**
 * `POST /demo/apps/:app/*page` — where a demo app's forms post. A demo keeps nothing: the app
 * picks the screen to return to and the toast to greet the visitor with, or answers the form
 * again with what was typed and its issues, the way a real app answers a save.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { OPTIMISTIC_TOGGLE_HEADER } from "@sdxc/ui/app";
import { generateUUID } from "@sdxc/uuid/v4";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import {
	DEMO_APP_ANCHOR_PARAM,
	DEMO_APP_TOAST_PARAM,
	demoAppHref,
	findDemoApp,
} from "~/resources/views/demo-apps";
import DemoAppDocument from "~/resources/views/demo-apps/document";
import routes from "~/routes/web";

/** The `:app` and `*page` the form posted under; `page` is absent on the home screen. */
const PARAMS = s.object({ app: s.string(), page: s.optional(s.string()) });

/**
 * Answers `303` to the screen the app chose, with its toast's key and a one-time suffix in
 * the query, or renders the screen the app answered with (`400` unless it says otherwise); a
 * post aimed at one of that screen's named frames answers that frame's content alone. An
 * unknown app answers `404` and a post the app cannot read `400`; a redirect outside the
 * app's own address is refused, so a post can only ever send the visitor back into it. A
 * toggle's background post answers `204` with the redirect's cookies, as its page already
 * shows the change.
 */
export default createAction(routes.demoApps.action, async (ctx) => {
	let { app: slug, page = "" } = s.parse(PARAMS, ctx.params);
	let app = await findDemoApp(slug);
	if (app === null) return new Response("Not found.", { status: 404 });

	let next = await app.submit(page, ctx.formData, {
		page,
		url: ctx.url,
		cookie: ctx.request.headers.get("Cookie"),
	});
	if (next === null) return new Response("That form could not be read.", { status: 400 });

	if ("body" in next) {
		let frameName = ctx.request.headers.get("X-Remix-Target");
		let frame = frameName === null ? undefined : next.frames?.[frameName];
		if (frame !== undefined) return ctx.render(frame, { status: next.status ?? 400 });
		return ctx.render(
			<DemoAppDocument assets={ctx.assets} app={app} screen={next} toast={null} />,
			{ status: next.status ?? 400 },
		);
	}

	let root = demoAppHref(slug)();
	let target = new URL(demoAppHref(slug)(next.page), ctx.url.origin);
	if (target.pathname !== root && !target.pathname.startsWith(`${root}/`)) {
		return new Response("That form could not be read.", { status: 400 });
	}
	let headers = new Headers();
	for (let cookie of next.cookies ?? []) headers.append("Set-Cookie", cookie);
	if (ctx.request.headers.has(OPTIMISTIC_TOGGLE_HEADER)) {
		return new Response(null, { status: 204, headers });
	}
	if (next.toast !== undefined) {
		target.searchParams.set(DEMO_APP_TOAST_PARAM, `${next.toast}.${generateUUID().slice(0, 8)}`);
	}
	let framed = ctx.request.headers.has("X-Remix-Target");
	if (framed && next.hash !== undefined) target.searchParams.set(DEMO_APP_ANCHOR_PARAM, next.hash);
	let hash = next.hash === undefined || framed ? "" : `#${encodeURIComponent(next.hash)}`;
	headers.set("Location", `${target.pathname}${target.search}${hash}`);
	return new Response(null, { status: 303, headers });
});
