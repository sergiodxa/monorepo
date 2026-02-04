import { OAuth2Error } from "./oauth2";

export class UnsupportedResponseTypeError extends OAuth2Error {
	override readonly name = "UnsupportedResponseTypeError";

	constructor(override readonly description: string) {
		super("unsupported_response_type", description);
	}
}
