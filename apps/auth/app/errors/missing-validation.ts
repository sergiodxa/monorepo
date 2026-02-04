import { OAuth2Error } from "./oauth2";

export class MissingValidationError extends OAuth2Error {
	override readonly name = "MissingValidationError";

	constructor(override readonly description: string = "Verification required") {
		super("missing_validation", description);
	}
}
