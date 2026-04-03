import { defaulted, enum_, object, string } from "remix/data-schema";

export const RedirectSchema = object({
	from: string(),
	to: string(),
	status: defaulted(enum_(["301", "302", "307", "308"]), "302"),
});
