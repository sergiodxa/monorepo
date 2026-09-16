/**
 * Labelling for `POST /items/:itemId/tags`. It puts a label on one post and returns the
 * reader to the list they acted from.
 *
 * Labelling keeps the post. That is one gesture rather than two verbs with an order to get
 * wrong: a label is a reason to have kept something, and a reason without the keeping is a
 * promise this design cannot honour, since the post would sit under rules that may take it.
 * So labelling past the shelf's last place is refused for exactly the reason keeping is,
 * and nothing is written.
 *
 * The outcome travels in the `tag` query parameter of the redirect, so the list the reader
 * lands back on is where every refusal is read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { localPath } from "~/app/http/controllers/items/save";
import { NAME_FIELD, TAG_PARAM } from "~/app/http/controllers/tags/create";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/** The field naming a label the reader already has, which the picker submits. */
export const TAG_FIELD = "tagId";

/** The path this route matches, which carries the post being labelled. */
const Params = s.object({ itemId: s.string() });

/**
 * What the picker submits: a label the reader already has, or a name for one. A name wins
 * where both arrive, since typing one is the more deliberate of the two.
 */
const TagForm = f.object({
	[TAG_FIELD]: f.field(s.defaulted(s.string(), "")),
	[NAME_FIELD]: f.field(s.defaulted(s.string(), "")),
	returnTo: f.field(s.defaulted(s.string(), "")),
});

/** POST /items/:itemId/tags — puts a label on one post, keeping the post as it does. */
export default createAction(routes.tags.apply, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { itemId } = s.parse(Params, ctx.params);
		let submitted = s.parse(TagForm, ctx.formData);

		let name = submitted[NAME_FIELD].trim();
		let tagId = submitted[TAG_FIELD];

		/** A submission naming neither a label nor a name asked for nothing. */
		if (name.length === 0 && tagId.length === 0) {
			return redirect(localPath(submitted.returnTo), { status: redirect.Status.SeeOther });
		}

		let applied = await userStore(viewer.id).tagItem(
			itemId,
			name.length > 0 ? { name } : { tagId },
		);

		let back = new URL(localPath(submitted.returnTo), ctx.url);
		if (!applied.ok) back.searchParams.set(TAG_PARAM, applied.reason);

		return redirect(`${back.pathname}${back.search}`, { status: redirect.Status.SeeOther });
	},
});
