import { OAuth2Error } from "./oauth2";

export class UnauthorizedClientError extends OAuth2Error {
	override readonly name = "UnauthorizedClientError";

	constructor(override readonly description: string = "Unauthorized client") {
		super("unauthorized_client", description);
	}
}
