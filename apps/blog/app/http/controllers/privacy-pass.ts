/**
 * HTTP action for `/privacy-pass`, which the contact forms load as a hidden image. It
 * challenges for a Privacy Pass token, and a device that answers with one gets a signed
 * attestation cookie, which the forms' spam filter counts in the sender's favor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { recordAttestation } from "~/app/services/attestation";
import routes from "~/routes/web";

/** Every answer belongs to one visitor and one challenge, so nothing may store it. */
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Redeems the request's token, or challenges for one. A client without tokens, or an issuer
 * that cannot be reached, gets an empty answer, which leaves the form working as before.
 *
 * @returns `204` once a token is redeemed or none can be asked for, `401` with a challenge otherwise.
 */
export default createAction(routes.privacyPass, async (ctx) => {
	let authorization = ctx.request.headers.get("Authorization");
	if (authorization !== null) {
		let redeemed = await ctx.privacyPass.redeem(authorization);
		if (!isFailure(redeemed)) {
			ctx.log.set({ privacyPass: { outcome: "redeemed" } });
			return new Response(null, {
				status: 204,
				headers: { ...NO_STORE, "Set-Cookie": await recordAttestation() },
			});
		}
		ctx.log.set({ privacyPass: { outcome: "refused", reason: redeemed.error.code } });
	}

	let challenge = await ctx.privacyPass.challenge();
	if (isFailure(challenge)) {
		ctx.log.set({ privacyPass: { outcome: "unavailable", reason: challenge.error.code } });
		return new Response(null, { status: 204, headers: NO_STORE });
	}

	return new Response(null, {
		status: 401,
		headers: { ...NO_STORE, "WWW-Authenticate": challenge.data },
	});
});
