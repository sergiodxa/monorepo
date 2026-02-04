import { OAuth2Error } from "./oauth2";

export class InvalidRequestError extends OAuth2Error {
	override readonly name = "InvalidRequestError";

	constructor(override readonly description: string) {
		super("invalid_request", description);
	}
}
