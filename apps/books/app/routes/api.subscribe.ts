import { getClientIP } from "@pkg/get-client-ip";
import { badRequest } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate, ValidationError } from "@pkg/validate";
import { href, redirect } from "react-router";
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
			return badRequest({ error: error.issues[0].message });
		}
		return badRequest({ error: "Invalid form data" });
	}

	let payload = validationResult.data;
	let ipAddress = getClientIP(request);

	let result = await subscribe(payload, ipAddress);

	if (isFailure(result)) {
		let error = result.error;

		if (error instanceof ButtondownError) {
			if (error.code === "subscriber_blocked") {
				return badRequest({
					error:
						"My upstream provider is blocking you for some reason.\nPlease try with another email address and sorry for the inconvenience.",
				});
			}

			if (error.code === "email_invalid") {
				return badRequest({
					error: "Invalid email address. \nPlease try with another email address.",
				});
			}

			if (error.code === "email_already_exists") return redirect(href("/release"));
		}

		return badRequest({ error: error.message });
	}

	return redirect(href("/release"));
}
