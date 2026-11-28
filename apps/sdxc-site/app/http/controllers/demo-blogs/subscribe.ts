/**
 * `POST /showcase/:slug/demo/subscribe` — a demo blog's newsletter sign-up. The address is
 * read and dropped, since the blog is invented, and the reader lands on the confirmation, so
 * the form behaves the way a real sign-up would without storing anything.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { demoBlogHref, SUBSCRIBE_PAGE } from "~/resources/views/demo-blogs";
import routes from "~/routes/web";

/** The `:slug` the form posted under. */
const PARAMS = s.object({ slug: s.string() });

/** A sign-up as the form posts it. */
const SIGN_UP = s.object({ email: s.string() });

/** The query a confirmed sign-up lands on, which the subscribe page reads. */
export const SUBSCRIBED_PARAM = "sent";

/**
 * Answers a sign-up with a redirect to its confirmation, or back to the empty form when the
 * post carries no address, so a reload never posts twice.
 */
export default createAction(routes.showcase.demoAction, async (ctx) => {
	let { slug } = s.parse(PARAMS, ctx.params);
	let parsed = await validate(ctx.formData, SIGN_UP);
	let page = demoBlogHref(slug)(SUBSCRIBE_PAGE);
	let location =
		isFailure(parsed) || parsed.data.email.trim() === "" ? page : `${page}?${SUBSCRIBED_PARAM}=1`;
	return new Response(null, { status: 303, headers: { Location: location } });
});
