/**
 * Device registration for `POST /settings/notifications/devices`. A browser that has just
 * subscribed to a push service hands over the endpoint and key material it was given, and
 * this records it against the reader.
 *
 * It answers JSON rather than a page: nothing links here, and the only caller is the
 * script that subscribed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { isAuthSecret, isP256PublicKey, isPushEndpoint } from "~/app/push/subscription";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/**
 * What a browser's `PushSubscription` reduces to. The endpoint is what the reader's object
 * later signs and `POST`s to, so only a public `https:` host passes; the keys must be what
 * encryption imports, so a delivery never fails on material a browser could not have issued.
 */
const Registration = s.object({
	endpoint: s.string().refine(isPushEndpoint, "Expected a public https: push endpoint"),
	p256dh: s.string().refine(isP256PublicKey, "Expected an uncompressed P-256 public key"),
	auth: s.string().refine(isAuthSecret, "Expected a 16-byte auth secret"),
	locale: s.optional(s.string()),
});

/**
 * POST /settings/notifications/devices — records a browser the reader asked to be reached on.
 * A body that fails {@link Registration} answers `400` with its issues and stores nothing.
 */
export default createAction(routes.notifications.devices, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let validated = await validate(ctx.request, Registration);
		if (isFailure(validated)) {
			return Response.json({ errors: validated.error.issues }, { status: 400 });
		}

		let submitted = validated.data;

		let registered = await userStore(viewer.id).registerDevice({
			endpoint: submitted.endpoint,
			p256dh: submitted.p256dh,
			auth: submitted.auth,
			userAgent: ctx.request.headers.get("user-agent"),
			locale: submitted.locale ?? ctx.locale,
		});

		return Response.json(registered);
	},
});
