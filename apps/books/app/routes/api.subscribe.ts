import { getClientIP } from "@pkg/get-client-ip";
import { badRequest } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate, ValidationError } from "@pkg/validate";
import { href, redirect } from "react-router";

import { logger } from "~/middleware/logger";
import { subscribeSchema } from "~/schemas/subscribe";
import { ButtondownError } from "~/services/buttondown";
import { subscribe } from "~/use-case/subscribe";

import type { Route } from "./+types/api.subscribe";

export async function action({ request }: Route.ActionArgs) {
	let formData = await request.formData();
	let validationResult = await validate(formData, subscribeSchema);

	if (isFailure(validationResult)) {
		let error = validationResult.error;
		if (error instanceof ValidationError && error.issues[0]) {
			logger.info("subscribe_validation_failed", { issue: error.issues[0].message });
			return badRequest({ error: error.issues[0].message });
		}
		logger.info("subscribe_validation_failed", { error: "Invalid form data" });
		return badRequest({ error: "Invalid form data" });
	}

	let payload = validationResult.data;
	let ipAddress = getClientIP(request);

	let result = await subscribe(payload, ipAddress);

	if (isFailure(result)) {
		let error = result.error;

		if (error instanceof ButtondownError) {
			if (error.code === "subscriber_blocked") {
				logger.info("subscriber_blocked", { email: payload.email });
				return badRequest({
					error:
						"My upstream provider is blocking you for some reason.\nPlease try with another email address and sorry for the inconvenience.",
				});
			}

			if (error.code === "email_invalid") {
				logger.info("subscribe_email_invalid", { email: payload.email });
				return badRequest({
					error: "Invalid email address. \nPlease try with another email address.",
				});
			}

			if (error.code === "email_already_exists") {
				logger.info("subscribe_already_exists", { email: payload.email });
				return redirect(href("/release"));
			}
		}

		logger.error("subscribe_error", { email: payload.email, error: error.message });
		return badRequest({ error: error.message });
	}

	return redirect(href("/release"));
}
