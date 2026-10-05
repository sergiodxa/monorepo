/**
 * Subscribe controller. Validates and screens the homepage's email form, subscribes the
 * address through Buttondown with the visitor's IP, and maps each refusal to the copy a
 * visitor reads. Success — including an address that was already on the list — redirects
 * to the sales page, which is the funnel's actual next step.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";

import { renderHome } from "~/app/http/controllers/home";
import {
	INVALID_EMAIL_MESSAGE,
	SubscribeSchema,
	screenSubscriberEmail,
} from "~/app/http/validators/subscribe";
import { buttondown } from "~/app/lib/buttondown";
import { ButtondownError } from "~/app/services/buttondown";
import { subscribe } from "~/app/services/subscribe";
import routes from "~/routes/web";

/**
 * Copy for the two Buttondown rejections a visitor can act on. Everything else gets the
 * generic message: the provider's own error text targets API consumers, and showing it
 * verbatim once put upstream wording in front of readers.
 */
const BLOCKED_MESSAGE =
	"My upstream provider is blocking you for some reason.\nPlease try with another email address and sorry for the inconvenience.";
const INVALID_MESSAGE = "Invalid email address. \nPlease try with another email address.";
const GENERIC_MESSAGE = "Something went wrong, please try again.";

/** POST /api/subscribe — subscribes a visitor and sends them on to the sales page. */
export default createAction(routes.api.subscribe, async (ctx) => {
	let log = ctx.log;
	let validation = await validate(ctx.formData, SubscribeSchema);

	if (isFailure(validation)) {
		log.note("subscribe.validation_failed");
		return renderHome(ctx, { error: INVALID_EMAIL_MESSAGE, status: 400 });
	}

	let payload = validation.data;
	let screened = screenSubscriberEmail(payload);

	if (isFailure(screened)) {
		log.set({ subscribe: { result: "rejected", code: screened.error.reason } });
		return renderHome(ctx, {
			error: screened.error.message,
			status: 400,
			confirmEmail: screened.error.reason === "typo" ? payload.email.address : undefined,
		});
	}

	let result = await subscribe(buttondown(), payload, ctx.ip?.toString() ?? null);

	if (isFailure(result)) {
		let error = result.error;

		if (error instanceof ButtondownError) {
			if (error.code === "subscriber_blocked") {
				log.set({ subscribe: { result: "rejected", code: error.code } });
				return renderHome(ctx, { error: BLOCKED_MESSAGE, status: 400 });
			}

			if (error.code === "email_invalid") {
				log.set({ subscribe: { result: "rejected", code: error.code } });
				return renderHome(ctx, { error: INVALID_MESSAGE, status: 400 });
			}

			/**
			 * Buttondown reports an existing subscriber as an error; for this funnel it is a
			 * success. The visitor asked to be on the list and is on the list, so they go to
			 * the sales page like anyone else.
			 */
			if (error.code === "email_already_exists") {
				log.set({ subscribe: { result: "already-subscribed" } });
				return redirect(routes.release.href(), { status: redirect.Status.SeeOther });
			}
		}

		log.fail(error);
		return renderHome(ctx, { error: GENERIC_MESSAGE, status: 400 });
	}

	return redirect(routes.release.href(), { status: redirect.Status.SeeOther });
});
