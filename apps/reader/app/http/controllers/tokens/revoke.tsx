/**
 * Revocation for `DELETE /settings/tokens/:tokenId`: stamps one token as revoked, which
 * stops it answering from the next call onwards.
 *
 * It renders nothing. The row is the only place the answer is ever read from, so there is
 * nothing to invalidate and nothing to wait for — the outcome travels in the settings
 * page's own query and that page says it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { TOKEN_PARAM } from "~/app/http/controllers/tokens/section";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/** The one segment this route carries, read the way every other id on this surface is. */
const Params = s.object({ tokenId: s.string() });

/** DELETE /settings/tokens/:tokenId — stops one token answering. */
export default createAction(routes.tokens.revoke, {
	middleware: [requireUser],
	async handler(ctx) {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { tokenId } = s.parse(Params, ctx.params);
		let revoked = await userStore(viewer.id).revokeAgentToken(tokenId);

		if (revoked.ok) ctx.log.note("mcp.token", { tokenId, action: "revoked" });

		return redirect(
			`${routes.settings.href()}?${TOKEN_PARAM}=${revoked.ok ? "revoked" : "missing"}`,
			{ status: redirect.Status.SeeOther },
		);
	},
});
