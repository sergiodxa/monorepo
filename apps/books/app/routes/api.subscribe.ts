import { FormParser } from "@edgefirst-dev/data/parser";
import { redirect } from "react-router";
import { SubscribePayload } from "~/data/subscribe-payload";
import { getClientIPAddress } from "~/helpers/get-client-ip";
import { badRequest } from "~/helpers/response";
import { ButtondownError } from "~/services/buttondown";
import { subscribe } from "~/use-case/subscribe";
import type { Route } from "./+types/api.subscribe";

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const parser = new FormParser(formData);
	const payload = new SubscribePayload(parser);
	const ipAddress = getClientIPAddress(request);

	try {
		await subscribe(payload, ipAddress);
		return redirect("/release");
	} catch (error) {
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

		if (error instanceof Error) return badRequest({ error: error.message });
		return badRequest({ error: "Unknown error" });
	}
}
