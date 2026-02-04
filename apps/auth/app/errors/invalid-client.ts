import { OAuth2Error } from "./oauth2";

export class InvalidClientError extends OAuth2Error {
	override readonly name = "InvalidClientError";

	constructor(override readonly description: string) {
		super("invalid_client", description);
	}
}
