/**
 * The fixture builders an integration test reaches for: documents built as a
 * provider builds them, signed and encrypted with real keys, so a suite covers
 * the verification that ships rather than a stand-in for it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { EncryptOptions } from "./encrypt-assertion.js";
export type { ResponseFixture, SignTarget } from "./sign-response.js";

export { encryptAssertion } from "./encrypt-assertion.js";
export {
	buildResponse,
	findElement,
	findParent,
	reparse,
	signDocument,
	stringify,
} from "./sign-response.js";
