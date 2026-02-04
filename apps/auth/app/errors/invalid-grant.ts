import { OAuth2Error } from "./oauth2";

export class InvalidGrantError extends OAuth2Error {
	override readonly name = "InvalidGrantError";

	constructor(override readonly description: string) {
		super("invalid_grant", description);
	}
}
