import { failure, isFailure, success } from "@pkg/result";

import { InternalServerError } from "~/errors";
import { logger } from "~/middleware/logger";

import generateCode from "./generate-code";

interface Input {
	subjectId: string;
	clientId: string;
	ip: string | null;
	ua: string | null;
	redirectUri: string;
	state: string;
}

export default async function loginWithProvider(input: Input) {
	try {
		let result = await generateCode({
			subjectId: input.subjectId,
			clientId: input.clientId,
			ip: input.ip,
			ua: input.ua,
		});

		if (isFailure(result)) return result;

		let url = new URL(input.redirectUri);
		url.searchParams.set("state", input.state);
		url.searchParams.set("code", result.data.code);

		logger.info("provider_login_code_generated", { subjectId: input.subjectId });
		return success({ url, subjectId: input.subjectId });
	} catch (error) {
		logger.error("provider_login_error", {
			error: error instanceof Error ? error.message : "Unknown error",
		});
		if (error instanceof Error) {
			return failure(new InternalServerError(error.message));
		}

		return failure(new InternalServerError());
	}
}
