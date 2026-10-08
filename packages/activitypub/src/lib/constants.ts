/**
 * The fixed IRIs and media types ActivityPub documents are read and written with: the
 * public collection, the JSON-LD contexts `stringify` writes, and the AS2 media types
 * content negotiation and delivery name.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The special collection that makes an object public. Addressed in `to` it is a public
 * post; in `cc` alone, an unlisted one. Every compact spelling reads as this IRI.
 */
export const PUBLIC = "https://www.w3.org/ns/activitystreams#Public";

/** The normative ActivityStreams 2.0 context, which every document is read against. */
export const AS2_CONTEXT = "https://www.w3.org/ns/activitystreams";

/** Defines `publicKey`, `owner` and `publicKeyPem`, which Mastodon reads from an actor. */
export const SECURITY_CONTEXT = "https://w3id.org/security/v1";

/** Defines `DataIntegrityProof` (FEP-8b32), written only when a document carries a proof. */
export const DATA_INTEGRITY_CONTEXT = "https://w3id.org/security/data-integrity/v1";

/** Defines `Multikey` (FEP-521a), written only when an actor lists `assertionMethod` keys. */
export const MULTIKEY_CONTEXT = "https://w3id.org/security/multikey/v1";

/** The media type ActivityPub servers serve and accept, as ActivityPub §3.2 recommends. */
export const ACTIVITY_JSON = "application/activity+json";

/** The JSON-LD media type ActivityPub §3.2 requires a server to treat as `ACTIVITY_JSON`. */
export const LD_JSON = "application/ld+json";

/** The JSON-LD form with the AS2 profile, as a client sends it in `Accept`. */
export const LD_JSON_ACTIVITY = `${LD_JSON}; profile="${AS2_CONTEXT}"`;

/** The `Content-Type` every document this package serves is answered with. */
export const ACTIVITY_CONTENT_TYPE = `${ACTIVITY_JSON}; charset=utf-8`;

/** The `Accept` a client sends to ask a server for the AS2 representation of a URL. */
export const ACTIVITY_ACCEPT = `${ACTIVITY_JSON}, ${LD_JSON_ACTIVITY}`;

/** The ActivityStreams 2.0 activity types, plus `EmojiReact`, which Pleroma and Akkoma send. */
export const ACTIVITY_TYPES = [
	"Accept",
	"Add",
	"Announce",
	"Arrive",
	"Block",
	"Create",
	"Delete",
	"Dislike",
	"EmojiReact",
	"Flag",
	"Follow",
	"Ignore",
	"Invite",
	"Join",
	"Leave",
	"Like",
	"Listen",
	"Move",
	"Offer",
	"Question",
	"Read",
	"Reject",
	"Remove",
	"TentativeAccept",
	"TentativeReject",
	"Travel",
	"Undo",
	"Update",
	"View",
] as const;

/** The ActivityStreams 2.0 actor types. */
export const ACTOR_TYPES = ["Application", "Group", "Organization", "Person", "Service"] as const;
