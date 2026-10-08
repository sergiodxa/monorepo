/**
 * The ActivityStreams 2.0 vocabulary as this package reads and writes it: every member
 * normalized to one shape whatever the sender chose, so a handler never branches on
 * whether a value arrived as a string, an array or an embedded object.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ACTIVITY_TYPES, ACTOR_TYPES } from "./constants.js";

export namespace ActivityPub {
	/** An IRI or the object it names; which one arrives is the sender's choice. */
	export type Ref<T> = string | T;

	/**
	 * A document as an app authors it for `stringify` and `respond`: `id` and `type` are
	 * required and every other member may be left out, which writes as absent.
	 *
	 * @template T - The full shape, as `parse*` returns it.
	 */
	export type Draft<T> = T extends Date
		? T
		: T extends string | number | boolean | null | undefined
			? T
			: T extends readonly unknown[]
				? { [K in keyof T]: Draft<T[K]> }
				: T extends object
					? { [K in keyof T as K extends "id" | "type" ? K : never]: Draft<T[K]> } & {
							[K in keyof T as K extends "id" | "type" ? never : K]?: Draft<T[K]>;
						}
					: T;

	/** The ActivityStreams activity types this package names. */
	export type ActivityType = (typeof ACTIVITY_TYPES)[number];

	/** The ActivityStreams actor types. */
	export type ActorType = (typeof ACTOR_TYPES)[number];

	/**
	 * Any ActivityStreams object. A type this package does not model (`Note`, `Article`,
	 * `Question`, `Event`, or an extension) keeps its `type`, so an app ignores it on purpose.
	 */
	export interface Object {
		/** An absolute IRI; the origin every ownership check compares against. */
		id: string;
		/** The first type a sender listed that this package knows, else the first it listed. */
		type: string;
		/** Always IRIs; an embedded author is never trusted over the author's own document. */
		attributedTo: string[];
		/** Addressing, with every spelling of the public collection read as `PUBLIC`. */
		to: string[];
		cc: string[];
		/** Read for fan-out, and never written: ActivityPub §6 strips them before delivery. */
		bto: string[];
		bcc: string[];
		/** Filled from `nameMap` when a sender sent only the map. */
		name: string | null;
		/** Language tag to text; empty when the sender sent only the plain value. */
		nameMap: Record<string, string>;
		/** A content warning on a sensitive Note; the lede of an Article. */
		summary: string | null;
		summaryMap: Record<string, string>;
		/** HTML, unsanitized; filled from `contentMap` when a sender sent only the map. */
		content: string | null;
		contentMap: Record<string, string>;
		/** The page a person opens: the first `text/html` link a sender gave, else the first link. */
		url: string | null;
		inReplyTo: string | null;
		/** The quoted object, from `quote`, `quoteUrl`, `quoteUri` or `_misskey_quote`. */
		quote: string | null;
		published: Date | null;
		updated: Date | null;
		/** Mastodon reads `summary` on a sensitive Note as a content warning. */
		sensitive: boolean;
		tag: Tag[];
		attachment: Attachment[];
		/** FEP-8b32 proofs, kept so a verifier can find them; an empty list writes no proof. */
		proof: Proof[];
	}

	/** An activity: someone (`actor`) doing something (`type`) to something (`object`). */
	export interface Activity extends Object {
		type: ActivityType | (string & {});
		/** Always an IRI. An embedded actor is never trusted over the actor's own document. */
		actor: string;
		/**
		 * Embedded objects are kept, because Create carries its Note and Accept or Undo the
		 * Follow they answer. Trust one only when its `id` has the actor's origin.
		 */
		object: Ref<Object | Activity> | null;
		target: string | null;
	}

	/** An account that can follow, be followed, and send or receive activities. */
	export interface Actor extends Object {
		type: ActorType;
		/** The `user` of `acct:user@host`; Mastodon resolves it back through WebFinger. */
		preferredUsername: string;
		inbox: string;
		outbox: string | null;
		followers: string | null;
		following: string | null;
		/** Pinned posts, a Mastodon extension. */
		featured: string | null;
		endpoints: Endpoints;
		/** The RSA key HTTP signatures from this actor verify against. */
		publicKey: PublicKey | null;
		/** FEP-521a Multikey entries; carries the Ed25519 key FEP-8b32 proofs name. */
		assertionMethod: Multikey[];
		alsoKnownAs: string[];
		movedTo: string | null;
		manuallyApprovesFollowers: boolean;
		discoverable: boolean;
		indexable: boolean;
		icon: Image | null;
		image: Image | null;
	}

	/** Server-wide endpoints of an actor. */
	export interface Endpoints {
		/** Preferred for delivery, so one POST reaches every follower on that server. */
		sharedInbox: string | null;
	}

	/** An actor's RSA public key, in the shape Mastodon publishes and reads. */
	export interface PublicKey {
		/** `<actor>#main-key` on Mastodon; the `keyId` HTTP signatures name. */
		id: string;
		/** The actor the key belongs to; a key whose owner differs never verifies that actor. */
		owner: string;
		publicKeyPem: string;
	}

	/** A FEP-521a verification method. */
	export interface Multikey {
		id: string;
		type: "Multikey";
		controller: string;
		/** The key in multibase, `z` + base58btc for Ed25519. */
		publicKeyMultibase: string;
	}

	/** An FEP-8b32 object integrity proof. */
	export interface Proof {
		type: "DataIntegrityProof";
		cryptosuite: string;
		/** The `Multikey` id that signed, under the signer's actor. */
		verificationMethod: string;
		proofPurpose: string;
		proofValue: string;
		created: Date | null;
	}

	/** An entry of `tag`: a hashtag, a mention, or a custom emoji. */
	export type Tag = Hashtag | Mention | Emoji;

	/** A topic; Mastodon lists the object on that tag's timeline. */
	export interface Hashtag {
		type: "Hashtag";
		/** With its `#`, as Mastodon writes it. */
		name: string;
		href: string | null;
	}

	/** An actor the object names, which Mastodon notifies and links in the rendered text. */
	export interface Mention {
		type: "Mention";
		/** The mentioned actor's id. */
		href: string;
		/** `@user@host` as the sender wrote it. */
		name: string | null;
	}

	/** A custom emoji, which `content` names as `:shortcode:`. */
	export interface Emoji {
		type: "Emoji";
		id: string | null;
		/** The shortcode with its colons, `:blobcat:`. */
		name: string;
		icon: Image;
		updated: Date | null;
	}

	/** An entry of `attachment`: a media file, or a profile field. */
	export type Attachment = Media | PropertyValue;

	/** An attached file. Mastodon sends `Document`; Pixelfed and Misskey also send `Image`. */
	export interface Media {
		type: "Document" | "Image" | "Video" | "Audio";
		url: string;
		mediaType: string | null;
		/** The alt text. */
		name: string | null;
		blurhash: string | null;
		width: number | null;
		height: number | null;
		/** Mastodon's crop point, each coordinate from -1 to 1. */
		focalPoint: [number, number] | null;
	}

	/** A profile metadata field, as Mastodon lists them in an actor's `attachment`. */
	export interface PropertyValue {
		type: "PropertyValue";
		name: string;
		/** HTML; a verified link is an `<a rel="me">`. */
		value: string;
	}

	/** An avatar, header or emoji image. */
	export interface Image {
		type: "Image";
		url: string;
		mediaType: string | null;
	}

	/**
	 * What a deleted object is served as, answered with `410`. `parseObject` reads one as an
	 * `Object` whose `type` is `Tombstone`.
	 */
	export interface Tombstone {
		id: string;
		type: "Tombstone";
		formerType: string | null;
		deleted: Date | null;
	}

	/** An entry of a collection: an IRI, or the activity or object itself. */
	export type Item = Ref<Object | Activity>;

	/** An unordered collection, such as Mastodon's `replies`. */
	export interface Collection {
		id: string;
		type: "Collection";
		totalItems: number | null;
		first: Ref<CollectionPage | OrderedCollectionPage> | null;
		last: string | null;
		items: Item[];
	}

	/** One page of an unordered collection. */
	export interface CollectionPage {
		/** `null` for a page embedded without one, as Mastodon embeds the first page of `replies`. */
		id: string | null;
		type: "CollectionPage";
		partOf: string | null;
		next: string | null;
		prev: string | null;
		totalItems: number | null;
		items: Item[];
	}

	/** A collection in reverse chronological order: outbox, followers, following, featured. */
	export interface OrderedCollection {
		id: string;
		type: "OrderedCollection";
		/** Alone, with no `first`, it is Mastodon's "hide network" shape of a followers list. */
		totalItems: number | null;
		first: Ref<CollectionPage | OrderedCollectionPage> | null;
		last: string | null;
		orderedItems: Item[];
	}

	/** One page of an ordered collection. */
	export interface OrderedCollectionPage {
		/** `null` for a page embedded without one. */
		id: string | null;
		type: "OrderedCollectionPage";
		partOf: string | null;
		next: string | null;
		prev: string | null;
		totalItems: number | null;
		orderedItems: Item[];
	}

	/** Any of the four collection shapes `parseCollection` reads. */
	export type AnyCollection =
		| Collection
		| CollectionPage
		| OrderedCollection
		| OrderedCollectionPage;

	/** Any document `stringify` and `respond` write. */
	export type Document = Object | Activity | Actor | Tombstone | AnyCollection;
}
