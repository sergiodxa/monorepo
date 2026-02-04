import { failure, success } from "@pkg/result";

import AuthzCode from "~/entities/authz-code";
import { InternalServerError } from "~/errors";
import { db } from "~/middleware/drizzle";
import Session from "~/models/session";

interface Input {
	subjectId: string;
	clientId: string;
	ip: string | null;
	ua: string | null;
}

export default async function generateCode(input: Input) {
	try {
		let { id } = await Session.create(db(), input.subjectId, input.clientId, input.ip, input.ua);

		let code = await AuthzCode.generate(input.clientId, input.subjectId, id, null);

		return success({ code });
	} catch (error) {
		if (error instanceof Error) {
			return failure(new InternalServerError(error.message));
		}

		return failure(new InternalServerError());
	}
}
