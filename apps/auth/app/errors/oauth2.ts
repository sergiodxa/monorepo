export class OAuth2Error extends globalThis.Error {
	override readonly name: string = "OAuth2Error";

	constructor(
		readonly code: string,
		readonly description: string,
	) {
		super(`OAuth2 error: ${code}`);
	}
}
