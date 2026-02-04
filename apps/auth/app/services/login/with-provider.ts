import { failure, success } from "~/helpers/result";

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

		if (result.status === "failure") return result;

		let url = new URL(input.redirectUri);
		url.searchParams.set("state", input.state);
		url.searchParams.set("code", result.payload.code);

		return success({ url, subjectId: input.subjectId });
	} catch (error) {
		if (error instanceof Error) {
			return failure("internal_server_error", error.message);
		}

		return failure("internal_server_error", "Internal server error");
	}
}
