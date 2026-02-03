import { getClientIP } from "@pkg/get-client-ip";
import { badRequest } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate, ValidationError } from "@pkg/validate";
import { redirect } from "react-router";
import { subscribeSchema } from "~/schemas/subscribe";
import { ButtondownError } from "~/services/buttondown";
import { subscribe } from "~/use-case/subscribe";
import type { Route } from "./+types/api.subscribe";

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const validationResult = await validate(formData, subscribeSchema);

	if (isFailure(validationResult)) {
		const error = validationResult.error;
		if (error instanceof ValidationError && error.issues[0]) {
			return badRequest({ error: error.issues[0].message });
		}
		return badRequest({ error: "Invalid form data" });
	}

	const payload = validationResult.data;
	const ipAddress = getClientIP(request);

	const result = await subscribe(payload, ipAddress);

	if (isFailure(result)) {
		const error = result.error;

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

			if (error.code === "email_already_exists") return redirect("/release");
		}

		return badRequest({ error: error.message });
	}

	return redirect("/release");
}
