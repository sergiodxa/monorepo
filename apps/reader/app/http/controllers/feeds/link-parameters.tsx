/**
 * Link-parameters controller for `POST /feeds/:feedId/link-parameters`. It decides whether
 * one subscription's outbound links carry the address exactly as the publisher wrote it,
 * and returns the reader to the feed's own page.
 *
 * It renders nothing. The outcome travels in the `parameters` query parameter of the
 * redirect, so the feed page is the single place that says what happened, in its own copy.
 * The answer is about one publisher's server rather than about the reader, so it is stored
 * on the subscription and holds wherever that feed's posts are drawn.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/** The query parameter the feed page reads the outcome of a submission out of. */
export const PARAMETERS_PARAM = "parameters";

/** The field the feed page's own control submits which way it is moving under. */
export const PARAMETERS_FIELD = "keep";

/** The path this route matches, which carries the subscription being answered for. */
const Params = s.object({ feedId: s.string() });

/** Which way the control is moving; a submission missing the field keeps the address. */
const ParametersForm = f.object({
	[PARAMETERS_FIELD]: f.field(
		s.defaulted(s.string(), "true").transform((value) => value === "true"),
	),
});

/** POST /feeds/:feedId/link-parameters — keeps one feed's link parameters, or strips them. */
export default createAction(routes.feeds.linkParameters, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { feedId } = s.parse(Params, ctx.params);
		let submitted = s.parse(ParametersForm, ctx.formData);

		let result = await userStore(viewer.id).setFeedLinkParameters(
			feedId,
			submitted[PARAMETERS_FIELD],
		);

		let outcome = result.ok ? (result.keepLinkParameters ? "kept" : "stripped") : "missing";
		let query = new URLSearchParams({ [PARAMETERS_PARAM]: outcome });

		return redirect(`${routes.feed.href({ feed: feedId })}?${query}`, {
			status: redirect.Status.SeeOther,
		});
	},
});
