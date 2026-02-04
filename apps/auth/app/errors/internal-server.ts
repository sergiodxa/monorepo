import { OAuth2Error } from "./oauth2";

export class InternalServerError extends OAuth2Error {
	override readonly name = "InternalServerError";

	constructor(override readonly description: string = "Internal server error") {
		super("internal_server_error", description);
	}
}
