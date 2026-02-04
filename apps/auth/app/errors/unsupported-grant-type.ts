import { OAuth2Error } from "./oauth2";

export class UnsupportedGrantTypeError extends OAuth2Error {
	override readonly name = "UnsupportedGrantTypeError";

	constructor(override readonly description: string) {
		super("unsupported_grant_type", description);
	}
}
