/**
 * Documents in the shapes Misskey emits: its actor with the `misskey:` context, a reply,
 * an emoji reaction sent as a Like with `content` and `_misskey_reaction`, a quote by
 * `_misskey_quote` and `quoteUrl`, and a follow. Ids are made up; the members are Misskey's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { FAKE_PUBLIC_KEY_PEM, LOCAL_ACTOR, LOCAL_ARTICLE } from "./shared.js";

/** The `@context` Misskey writes on every document. */
const CONTEXT = [
	"https://www.w3.org/ns/activitystreams",
	"https://w3id.org/security/v1",
	{
		Key: "sec:Key",
		manuallyApprovesFollowers: "as:manuallyApprovesFollowers",
		sensitive: "as:sensitive",
		Hashtag: "as:Hashtag",
		quoteUrl: "as:quoteUrl",
		toot: "http://joinmastodon.org/ns#",
		Emoji: "toot:Emoji",
		featured: "toot:featured",
		discoverable: "toot:discoverable",
		schema: "http://schema.org#",
		PropertyValue: "schema:PropertyValue",
		value: "schema:value",
		misskey: "https://misskey-hub.net/ns#",
		_misskey_content: "misskey:_misskey_content",
		_misskey_quote: "misskey:_misskey_quote",
		_misskey_reaction: "misskey:_misskey_reaction",
		_misskey_votes: "misskey:_misskey_votes",
		_misskey_summary: "misskey:_misskey_summary",
		isCat: "misskey:isCat",
		vcard: "http://www.w3.org/2006/vcard/ns#",
	},
];

/** The custom emoji Misskey attaches wherever a document names `:blobcat:`. */
const BLOBCAT = {
	id: "https://misskey.io/emojis/blobcat",
	type: "Emoji",
	name: ":blobcat:",
	updated: "2023-05-01T10:00:00.000Z",
	icon: {
		type: "Image",
		mediaType: "image/png",
		url: "https://media.misskey-io.jp/emoji/blobcat.png",
	},
};

/** A Misskey account: a separate `sharedInbox` member, a typed `Key`, and `isCat`. */
export const MISSKEY_ACTOR = {
	"@context": CONTEXT,
	type: "Person",
	id: "https://misskey.io/users/9k2xq3h7c1",
	inbox: "https://misskey.io/users/9k2xq3h7c1/inbox",
	outbox: "https://misskey.io/users/9k2xq3h7c1/outbox",
	followers: "https://misskey.io/users/9k2xq3h7c1/followers",
	following: "https://misskey.io/users/9k2xq3h7c1/following",
	featured: "https://misskey.io/users/9k2xq3h7c1/collections/featured",
	sharedInbox: "https://misskey.io/inbox",
	endpoints: { sharedInbox: "https://misskey.io/inbox" },
	url: "https://misskey.io/@carol",
	preferredUsername: "carol",
	name: "Carol :blobcat:",
	summary: "<p><span>Drawing cats, mostly.</span></p>",
	_misskey_summary: "Drawing cats, mostly.",
	icon: {
		type: "Image",
		url: "https://media.misskey-io.jp/files/webpublic-0a1b2c3d.webp",
		sensitive: false,
		name: null,
	},
	image: null,
	tag: [BLOBCAT],
	manuallyApprovesFollowers: false,
	discoverable: true,
	publicKey: {
		id: "https://misskey.io/users/9k2xq3h7c1#main-key",
		type: "Key",
		owner: "https://misskey.io/users/9k2xq3h7c1",
		publicKeyPem: FAKE_PUBLIC_KEY_PEM,
	},
	isCat: true,
	attachment: [
		{
			type: "PropertyValue",
			name: "Portfolio",
			value:
				'<a href="https://carol.art" rel="me nofollow noopener" target="_blank">https://carol.art</a>',
		},
	],
};

/** A reply to a local article, with Misskey's markdown source kept beside the HTML. */
export const MISSKEY_CREATE_NOTE = {
	"@context": CONTEXT,
	id: "https://misskey.io/notes/9k3a1b2c3d/activity",
	actor: "https://misskey.io/users/9k2xq3h7c1",
	type: "Create",
	published: "2026-10-02T08:00:00.000Z",
	object: {
		id: "https://misskey.io/notes/9k3a1b2c3d",
		type: "Note",
		attributedTo: "https://misskey.io/users/9k2xq3h7c1",
		content:
			'<p><a href="https://letters.blog/@hello" class="u-url mention">@hello@letters.blog</a><span> Lovely :blobcat:</span></p>',
		_misskey_content: "@hello@letters.blog Lovely :blobcat:",
		source: {
			content: "@hello@letters.blog Lovely :blobcat:",
			mediaType: "text/x.misskeymarkdown",
		},
		published: "2026-10-02T08:00:00.000Z",
		to: ["https://www.w3.org/ns/activitystreams#Public"],
		cc: ["https://misskey.io/users/9k2xq3h7c1/followers", LOCAL_ACTOR],
		inReplyTo: LOCAL_ARTICLE,
		attachment: [],
		sensitive: false,
		tag: [{ type: "Mention", href: LOCAL_ACTOR, name: "@hello@letters.blog" }, BLOBCAT],
	},
	to: ["https://www.w3.org/ns/activitystreams#Public"],
	cc: ["https://misskey.io/users/9k2xq3h7c1/followers", LOCAL_ACTOR],
};

/** An emoji reaction: a Like whose `content` and `_misskey_reaction` name the emoji. */
export const MISSKEY_REACTION = {
	"@context": CONTEXT,
	type: "Like",
	id: "https://misskey.io/likes/9k3b4c5d6e",
	actor: "https://misskey.io/users/9k2xq3h7c1",
	object: LOCAL_ARTICLE,
	content: ":blobcat:",
	_misskey_reaction: ":blobcat:",
	tag: [BLOBCAT],
};

/** A quote of a local article, named by `_misskey_quote` and `quoteUrl`. */
export const MISSKEY_QUOTE = {
	"@context": CONTEXT,
	id: "https://misskey.io/notes/9k3c7d8e9f/activity",
	actor: "https://misskey.io/users/9k2xq3h7c1",
	type: "Create",
	published: "2026-10-02T09:30:00.000Z",
	object: {
		id: "https://misskey.io/notes/9k3c7d8e9f",
		type: "Note",
		attributedTo: "https://misskey.io/users/9k2xq3h7c1",
		content:
			'<p><span>This one</span><span class="quote-inline"><br><br>RE: <a href="https://letters.blog/articles/remix-v3">https://letters.blog/articles/remix-v3</a></span></p>',
		_misskey_content: "This one",
		_misskey_quote: LOCAL_ARTICLE,
		quoteUrl: LOCAL_ARTICLE,
		published: "2026-10-02T09:30:00.000Z",
		to: ["https://www.w3.org/ns/activitystreams#Public"],
		cc: ["https://misskey.io/users/9k2xq3h7c1/followers"],
		inReplyTo: null,
		attachment: [],
		sensitive: false,
		tag: [],
	},
	to: ["https://www.w3.org/ns/activitystreams#Public"],
	cc: ["https://misskey.io/users/9k2xq3h7c1/followers"],
};

/** A follow of the local actor; Misskey ids it by follower and followee. */
export const MISSKEY_FOLLOW = {
	"@context": CONTEXT,
	id: "https://misskey.io/follows/9k2xq3h7c1/9k3d0e1f2a",
	type: "Follow",
	actor: "https://misskey.io/users/9k2xq3h7c1",
	object: LOCAL_ACTOR,
};
