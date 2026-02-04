import { failure, success } from "@pkg/result";

import { InvalidClientError, InvalidGrantError } from "~/errors";
import { db } from "~/middleware/drizzle";
import Client from "~/models/client";

interface Input {
	clientId: string;
	redirectUri: string;
}

export default async function startAuthorizationFlow(input: Input) {
	let client = await Client.findById(db(), input.clientId);

	if (!client) {
		return failure(new InvalidClientError("The client is not registered"));
	}

	if (client.redirectUri !== input.redirectUri) {
		return failure(
			new InvalidGrantError("The redirect URI does not match the client's registered redirect URI"),
		);
	}

	return success({ client });
}
