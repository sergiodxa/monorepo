import { LogSnag } from "@logsnag/node";
import { env } from "cloudflare:workers";

if (!env.LOGSNAG_API_KEY) {
	throw new Error("LOGSNAG_API_KEY is required");
}

if (!env.LOGSNAG_PROJECT) {
	throw new Error("LOGSNAG_PROJECT is required");
}

export default new LogSnag({
	project: env.LOGSNAG_PROJECT,
	token: env.LOGSNAG_API_KEY,
});
