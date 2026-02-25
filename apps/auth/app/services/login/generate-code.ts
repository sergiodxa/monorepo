import { failure, success } from "@pkg/result";

import AuthzCode from "~/entities/authz-code";
import { InternalServerError } from "~/errors";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import Grant from "~/models/grant";
import Session from "~/models/session";

interface Input {
	subjectId: string;
	clientId: string;
	ip: string | null;
	ua: string | null;
	nonce?: string | null;
	scope?: string[];
}

export default async function generateCode(input: Input) {
	try {
		let [{ id }, grant] = await Promise.all([
			Session.create(db(), input.subjectId, input.clientId, input.ip, input.ua),
			Grant.findOrCreate(db(), input.subjectId, input.clientId),
		]);
		logger.info("session_created", {
			sessionId: id,
			subjectId: input.subjectId,
			grantId: grant.id,
		});

		let code = await AuthzCode.generate(
			input.clientId,
			input.subjectId,
			id,
			null,
			input.nonce,
			input.scope,
		);
		logger.info("authz_code_generated", { subjectId: input.subjectId, clientId: input.clientId });

		return success({ code });
	} catch (error) {
		logger.error("authz_code_generation_error", {
			error: error instanceof Error ? error.message : "Unknown error",
		});
		if (error instanceof Error) {
			return failure(new InternalServerError(error.message));
		}

		return failure(new InternalServerError());
	}
}
