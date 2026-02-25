import { logger } from "~/middleware/logger";

import generateAuthzCode from "./generate-code";

interface Input {
	subjectId: string;
	clientId: string;
	ip: string | null;
	ua: string | null;
	redirectUri: string;
	state: string;
	nonce?: string;
	scope?: string[];
	opBrowserState?: string;
	responseMode?: "query" | "fragment" | "form_post";
}

/**
 * Complete OAuth login flow for an external provider (GitHub, Google, etc.)
 * The subject already exists (created during provider callback).
 */
export default async function loginWithProvider(input: Input) {
	let result = await generateAuthzCode(input);

	if (result.status === "success") {
		logger.info("provider_login_success", { subjectId: input.subjectId });
	}

	return result;
}
