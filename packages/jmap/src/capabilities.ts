/**
 * The capability URIs a JMAP request names in `using` and a session advertises, and
 * which capability each built-in data type's methods belong to, so a batch can fill
 * `using` from the methods it calls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The registered capability URIs of JMAP core, mail, submission, vacation, contacts and WebSocket. */
export const CAPABILITIES = {
	core: "urn:ietf:params:jmap:core",
	mail: "urn:ietf:params:jmap:mail",
	submission: "urn:ietf:params:jmap:submission",
	vacationResponse: "urn:ietf:params:jmap:vacationresponse",
	contacts: "urn:ietf:params:jmap:contacts",
	webSocket: "urn:ietf:params:jmap:websocket",
} as const;

/**
 * The capabilities a method's data type needs, keyed by the part of the method name before
 * the `/`. An EmailSubmission names mail too, since `onSuccessUpdateEmail` runs an `Email/set`.
 */
const TYPE_CAPABILITIES: Record<string, readonly string[]> = {
	Core: [],
	Blob: [],
	PushSubscription: [],
	Mailbox: [CAPABILITIES.mail],
	Thread: [CAPABILITIES.mail],
	Email: [CAPABILITIES.mail],
	SearchSnippet: [CAPABILITIES.mail],
	Identity: [CAPABILITIES.submission],
	EmailSubmission: [CAPABILITIES.mail, CAPABILITIES.submission],
	VacationResponse: [CAPABILITIES.vacationResponse],
	AddressBook: [CAPABILITIES.contacts],
	ContactCard: [CAPABILITIES.contacts],
};

/**
 * The capabilities a call to `method` needs beyond core. A data type outside this package's
 * list needs none here; its capability comes from the batch's own `using`.
 *
 * @param method - A method name such as `"Email/get"`.
 * @example capabilitiesOf("Email/get"); // ["urn:ietf:params:jmap:mail"]
 */
export function capabilitiesOf(method: string): readonly string[] {
	let type = method.split("/", 1)[0] ?? "";
	return TYPE_CAPABILITIES[type] ?? [];
}
