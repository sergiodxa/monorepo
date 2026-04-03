import { defaulted, enum_, object, string } from "remix/data-schema";

/**
 * Validates redirect form payloads and constrains status codes to supported redirects.
 */
export const RedirectSchema = object({
	from: string(),
	to: string(),
	status: defaulted(enum_(["301", "302", "307", "308"]), "302"),
});
