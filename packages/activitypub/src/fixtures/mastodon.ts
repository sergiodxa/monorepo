/**
 * Documents in the shapes Mastodon 4.x emits: its actor, a reply with media, mentions,
 * hashtags and custom emoji, the follow lifecycle, Like, Announce, Delete, a 4.5 quote
 * post, and its collections. Ids are made up; every member and nesting is Mastodon's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { FAKE_PUBLIC_KEY_PEM, LOCAL_ACTOR, LOCAL_ARTICLE } from "./shared.js";

/** The `@context` Mastodon writes on an actor, embedded term map included. */
const ACTOR_CONTEXT = [
	"https://www.w3.org/ns/activitystreams",
	"https://w3id.org/security/v1",
	{
		manuallyApprovesFollowers: "as:manuallyApprovesFollowers",
		toot: "http://joinmastodon.org/ns#",
		featured: { "@id": "toot:featured", "@type": "@id" },
		featuredTags: { "@id": "toot:featuredTags", "@type": "@id" },
		alsoKnownAs: { "@id": "as:alsoKnownAs", "@type": "@id" },
		movedTo: { "@id": "as:movedTo", "@type": "@id" },
		schema: "http://schema.org#",
		PropertyValue: "schema:PropertyValue",
		value: "schema:value",
		discoverable: "toot:discoverable",
		suspended: "toot:suspended",
		memorial: "toot:memorial",
		indexable: "toot:indexable",
		attributionDomains: { "@id": "toot:attributionDomains", "@type": "@id" },
		focalPoint: { "@container": "@list", "@id": "toot:focalPoint" },
	},
];

/** The `@context` Mastodon writes on a status and the activities that carry one. */
const STATUS_CONTEXT = [
	"https://www.w3.org/ns/activitystreams",
	{
		ostatus: "http://ostatus.org#",
		atomUri: "ostatus:atomUri",
		inReplyToAtomUri: "ostatus:inReplyToAtomUri",
		conversation: "ostatus:conversation",
		sensitive: "as:sensitive",
		toot: "http://joinmastodon.org/ns#",
		votersCount: "toot:votersCount",
		blurhash: "toot:blurhash",
		focalPoint: { "@container": "@list", "@id": "toot:focalPoint" },
		Hashtag: "as:Hashtag",
		Emoji: "toot:Emoji",
		quote: { "@id": "https://w3id.org/fep/044f#quote", "@type": "@id" },
		quoteUri: "http://fedibird.com/ns#quoteUri",
		_misskey_quote: "https://misskey-hub.net/ns#_misskey_quote",
	},
];

/** A Mastodon account: profile fields, featured collection, a shared inbox and `#main-key`. */
export const MASTODON_ACTOR = {
	"@context": ACTOR_CONTEXT,
	id: "https://mastodon.social/users/alice",
	type: "Person",
	following: "https://mastodon.social/users/alice/following",
	followers: "https://mastodon.social/users/alice/followers",
	inbox: "https://mastodon.social/users/alice/inbox",
	outbox: "https://mastodon.social/users/alice/outbox",
	featured: "https://mastodon.social/users/alice/collections/featured",
	featuredTags: "https://mastodon.social/users/alice/collections/tags",
	preferredUsername: "alice",
	name: "Alice :blobcat:",
	summary:
		'<p>Writes about the web. Mostly <a href="https://mastodon.social/tags/remix" class="mention hashtag" rel="tag">#<span>remix</span></a>.</p>',
	url: "https://mastodon.social/@alice",
	manuallyApprovesFollowers: false,
	discoverable: true,
	indexable: true,
	published: "2022-11-05T00:00:00Z",
	memorial: false,
	devices: "https://mastodon.social/users/alice/collections/devices",
	alsoKnownAs: ["https://hachyderm.io/users/alice"],
	publicKey: {
		id: "https://mastodon.social/users/alice#main-key",
		owner: "https://mastodon.social/users/alice",
		publicKeyPem: FAKE_PUBLIC_KEY_PEM,
	},
	tag: [
		{
			id: "https://mastodon.social/emojis/23661",
			type: "Emoji",
			name: ":blobcat:",
			updated: "2023-03-14T09:12:00Z",
			icon: {
				type: "Image",
				mediaType: "image/png",
				url: "https://files.mastodon.social/custom_emojis/images/000/023/661/original/blobcat.png",
			},
		},
	],
	attachment: [
		{
			type: "PropertyValue",
			name: "Website",
			value:
				'<a href="https://alice.blog" target="_blank" rel="nofollow noopener me" translate="no"><span class="invisible">https://</span><span class="">alice.blog</span><span class="invisible"></span></a>',
		},
		{ type: "PropertyValue", name: "Pronouns", value: "she/her" },
	],
	endpoints: { sharedInbox: "https://mastodon.social/inbox" },
	icon: {
		type: "Image",
		mediaType: "image/png",
		url: "https://files.mastodon.social/accounts/avatars/109/301/000/000/000/001/original/avatar.png",
	},
	image: {
		type: "Image",
		mediaType: "image/jpeg",
		url: "https://files.mastodon.social/accounts/headers/109/301/000/000/000/001/original/header.jpg",
	},
};

/** A public reply to a local article, with an image, a mention, a hashtag and an emoji. */
export const MASTODON_CREATE_NOTE = {
	"@context": STATUS_CONTEXT,
	id: "https://mastodon.social/users/alice/statuses/113250000000000001/activity",
	type: "Create",
	actor: "https://mastodon.social/users/alice",
	published: "2026-10-01T12:34:56Z",
	to: ["https://www.w3.org/ns/activitystreams#Public"],
	cc: ["https://mastodon.social/users/alice/followers", LOCAL_ACTOR],
	object: {
		id: "https://mastodon.social/users/alice/statuses/113250000000000001",
		type: "Note",
		summary: null,
		inReplyTo: LOCAL_ARTICLE,
		published: "2026-10-01T12:34:56Z",
		url: "https://mastodon.social/@alice/113250000000000001",
		attributedTo: "https://mastodon.social/users/alice",
		to: ["https://www.w3.org/ns/activitystreams#Public"],
		cc: ["https://mastodon.social/users/alice/followers", LOCAL_ACTOR],
		sensitive: false,
		atomUri: "https://mastodon.social/users/alice/statuses/113250000000000001",
		inReplyToAtomUri: LOCAL_ARTICLE,
		conversation: "tag:mastodon.social,2026-10-01:objectId=880000001:objectType=Conversation",
		content:
			'<p><span class="h-card" translate="no"><a href="https://letters.blog/@hello" class="u-url mention">@<span>hello</span></a></span> Great write-up :blobcat: <a href="https://mastodon.social/tags/remix" class="mention hashtag" rel="tag">#<span>remix</span></a></p>',
		contentMap: {
			en: '<p><span class="h-card" translate="no"><a href="https://letters.blog/@hello" class="u-url mention">@<span>hello</span></a></span> Great write-up :blobcat: <a href="https://mastodon.social/tags/remix" class="mention hashtag" rel="tag">#<span>remix</span></a></p>',
		},
		updated: "2026-10-01T12:40:00Z",
		attachment: [
			{
				type: "Document",
				mediaType: "image/jpeg",
				url: "https://files.mastodon.social/media_attachments/files/113/250/000/000/000/001/original/photo.jpeg",
				name: "A whiteboard covered in route diagrams",
				blurhash: "UBL_:rOpGG-oBUNG,qRj2so|=eE1w^n4S5NH",
				focalPoint: [0.1, -0.25],
				width: 1600,
				height: 1200,
			},
		],
		tag: [
			{ type: "Mention", href: LOCAL_ACTOR, name: "@hello@letters.blog" },
			{ type: "Hashtag", href: "https://mastodon.social/tags/remix", name: "#remix" },
			{
				id: "https://mastodon.social/emojis/23661",
				type: "Emoji",
				name: ":blobcat:",
				updated: "2023-03-14T09:12:00Z",
				icon: {
					type: "Image",
					mediaType: "image/png",
					url: "https://files.mastodon.social/custom_emojis/images/000/023/661/original/blobcat.png",
				},
			},
		],
		replies: {
			id: "https://mastodon.social/users/alice/statuses/113250000000000001/replies",
			type: "Collection",
			first: {
				type: "CollectionPage",
				next: "https://mastodon.social/users/alice/statuses/113250000000000001/replies?only_other_accounts=true&page=true",
				partOf: "https://mastodon.social/users/alice/statuses/113250000000000001/replies",
				items: [],
			},
		},
		likes: {
			id: "https://mastodon.social/users/alice/statuses/113250000000000001/likes",
			type: "Collection",
			totalItems: 0,
		},
		shares: {
			id: "https://mastodon.social/users/alice/statuses/113250000000000001/shares",
			type: "Collection",
			totalItems: 0,
		},
	},
	signature: {
		type: "RsaSignature2017",
		creator: "https://mastodon.social/users/alice#main-key",
		created: "2026-10-01T12:34:57Z",
		signatureValue: "ZmFrZS1zaWduYXR1cmU=",
	},
};

/** A favourite of a local article; Mastodon's Like ids are fragments of the actor. */
export const MASTODON_LIKE = {
	"@context": "https://www.w3.org/ns/activitystreams",
	id: "https://mastodon.social/users/alice#likes/4400123",
	type: "Like",
	actor: "https://mastodon.social/users/alice",
	object: LOCAL_ARTICLE,
};

/** A boost of a local article. */
export const MASTODON_ANNOUNCE = {
	"@context": "https://www.w3.org/ns/activitystreams",
	id: "https://mastodon.social/users/alice/statuses/113250000000000002/activity",
	type: "Announce",
	actor: "https://mastodon.social/users/alice",
	published: "2026-10-01T13:00:00Z",
	to: ["https://www.w3.org/ns/activitystreams#Public"],
	cc: [LOCAL_ACTOR, "https://mastodon.social/users/alice/followers"],
	object: LOCAL_ARTICLE,
};

/** A follow of the local actor; Mastodon ids a Follow with a bare UUID path. */
export const MASTODON_FOLLOW = {
	"@context": "https://www.w3.org/ns/activitystreams",
	id: "https://mastodon.social/5e3a8a0f-6c1d-4b8e-9a43-1f2c7d9e0b11",
	type: "Follow",
	actor: "https://mastodon.social/users/alice",
	object: LOCAL_ACTOR,
};

/** An unfollow, embedding the Follow it undoes. */
export const MASTODON_UNDO_FOLLOW = {
	"@context": "https://www.w3.org/ns/activitystreams",
	id: "https://mastodon.social/users/alice#follows/880123/undo",
	type: "Undo",
	actor: "https://mastodon.social/users/alice",
	object: {
		id: "https://mastodon.social/5e3a8a0f-6c1d-4b8e-9a43-1f2c7d9e0b11",
		type: "Follow",
		actor: "https://mastodon.social/users/alice",
		object: LOCAL_ACTOR,
	},
};

/** Mastodon accepting a follow the local actor sent, with the Follow embedded. */
export const MASTODON_ACCEPT = {
	"@context": "https://www.w3.org/ns/activitystreams",
	id: "https://mastodon.social/users/alice#accepts/follows/880124",
	type: "Accept",
	actor: "https://mastodon.social/users/alice",
	object: {
		id: "https://letters.blog/activitypub/follows/1",
		type: "Follow",
		actor: LOCAL_ACTOR,
		object: "https://mastodon.social/users/alice",
	},
};

/** A deleted status, sent as a Delete of its Tombstone. */
export const MASTODON_DELETE_NOTE = {
	"@context": [
		"https://www.w3.org/ns/activitystreams",
		{ ostatus: "http://ostatus.org#", atomUri: "ostatus:atomUri" },
	],
	id: "https://mastodon.social/users/alice/statuses/113250000000000001#delete",
	type: "Delete",
	actor: "https://mastodon.social/users/alice",
	to: ["https://www.w3.org/ns/activitystreams#Public"],
	object: {
		id: "https://mastodon.social/users/alice/statuses/113250000000000001",
		type: "Tombstone",
		atomUri: "https://mastodon.social/users/alice/statuses/113250000000000001",
	},
};

/** A deleted account, which Mastodon sends to every server it ever talked to. */
export const MASTODON_DELETE_ACTOR = {
	"@context": "https://www.w3.org/ns/activitystreams",
	id: "https://mastodon.social/users/bob#delete",
	type: "Delete",
	actor: "https://mastodon.social/users/bob",
	to: ["https://www.w3.org/ns/activitystreams#Public"],
	object: "https://mastodon.social/users/bob",
};

/** A Mastodon 4.5 quote post, with the FEP-044f `quote` and the names older servers read. */
export const MASTODON_QUOTE = {
	"@context": STATUS_CONTEXT,
	id: "https://mastodon.social/users/alice/statuses/113250000000000003/activity",
	type: "Create",
	actor: "https://mastodon.social/users/alice",
	published: "2026-10-02T09:00:00Z",
	to: ["https://www.w3.org/ns/activitystreams#Public"],
	cc: ["https://mastodon.social/users/alice/followers"],
	object: {
		id: "https://mastodon.social/users/alice/statuses/113250000000000003",
		type: "Note",
		summary: null,
		inReplyTo: null,
		published: "2026-10-02T09:00:00Z",
		url: "https://mastodon.social/@alice/113250000000000003",
		attributedTo: "https://mastodon.social/users/alice",
		to: ["https://www.w3.org/ns/activitystreams#Public"],
		cc: ["https://mastodon.social/users/alice/followers"],
		sensitive: false,
		content:
			'<p>Everyone should read this.</p><p class="quote-inline">RE: <a href="https://letters.blog/articles/remix-v3">https://letters.blog/articles/remix-v3</a></p>',
		contentMap: {
			en: '<p>Everyone should read this.</p><p class="quote-inline">RE: <a href="https://letters.blog/articles/remix-v3">https://letters.blog/articles/remix-v3</a></p>',
		},
		quote: LOCAL_ARTICLE,
		_misskey_quote: LOCAL_ARTICLE,
		quoteUri: LOCAL_ARTICLE,
		attachment: [],
		tag: [],
	},
};

/** A followers collection that shows its count and pages its members. */
export const MASTODON_FOLLOWERS = {
	"@context": "https://www.w3.org/ns/activitystreams",
	id: "https://mastodon.social/users/alice/followers",
	type: "OrderedCollection",
	totalItems: 1234,
	first: "https://mastodon.social/users/alice/followers?page=1",
};

/** The first page of an outbox, its items each a Create with the Note embedded. */
export const MASTODON_OUTBOX_PAGE = {
	"@context": STATUS_CONTEXT,
	id: "https://mastodon.social/users/alice/outbox?page=true",
	type: "OrderedCollectionPage",
	next: "https://mastodon.social/users/alice/outbox?max_id=113250000000000001&page=true",
	prev: "https://mastodon.social/users/alice/outbox?min_id=113250000000000003&page=true",
	partOf: "https://mastodon.social/users/alice/outbox",
	orderedItems: [
		{
			id: "https://mastodon.social/users/alice/statuses/113250000000000002/activity",
			type: "Announce",
			actor: "https://mastodon.social/users/alice",
			published: "2026-10-01T13:00:00Z",
			to: ["https://www.w3.org/ns/activitystreams#Public"],
			cc: [LOCAL_ACTOR, "https://mastodon.social/users/alice/followers"],
			object: LOCAL_ARTICLE,
		},
		MASTODON_CREATE_NOTE,
	],
};

/** A status's replies: a Collection whose first page is embedded without an id. */
export const MASTODON_REPLIES = MASTODON_CREATE_NOTE.object.replies;
