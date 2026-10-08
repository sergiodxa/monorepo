/**
 * Documents in the shapes Pixelfed emits: its actor with the security context listed
 * first, a photo post whose attachments are typed `Image`, and a like. Ids are made up;
 * the members are Pixelfed's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { FAKE_PUBLIC_KEY_PEM, LOCAL_ARTICLE } from "./shared.js";

/** A Pixelfed account. */
export const PIXELFED_ACTOR = {
	"@context": [
		"https://w3id.org/security/v1",
		"https://www.w3.org/ns/activitystreams",
		{
			toot: "http://joinmastodon.org/ns#",
			manuallyApprovesFollowers: "as:manuallyApprovesFollowers",
			alsoKnownAs: { "@id": "as:alsoKnownAs", "@type": "@id" },
			movedTo: { "@id": "as:movedTo", "@type": "@id" },
			indexable: "toot:indexable",
			suspended: "toot:suspended",
		},
	],
	id: "https://pixelfed.social/users/dan",
	type: "Person",
	following: "https://pixelfed.social/users/dan/following",
	followers: "https://pixelfed.social/users/dan/followers",
	inbox: "https://pixelfed.social/users/dan/inbox",
	outbox: "https://pixelfed.social/users/dan/outbox",
	preferredUsername: "dan",
	name: "Dan",
	summary: "Film photography and long walks.",
	url: "https://pixelfed.social/dan",
	manuallyApprovesFollowers: false,
	indexable: true,
	published: "2019-06-01T00:00:00Z",
	publicKey: {
		id: "https://pixelfed.social/users/dan#main-key",
		owner: "https://pixelfed.social/users/dan",
		publicKeyPem: FAKE_PUBLIC_KEY_PEM,
	},
	icon: {
		type: "Image",
		mediaType: "image/jpeg",
		url: "https://pixelfed.social/storage/avatars/000/000/000/001/avatar.jpg?v=4",
	},
	endpoints: { sharedInbox: "https://pixelfed.social/f/inbox" },
};

/** A photo post with two images and a hashtag. */
export const PIXELFED_CREATE_NOTE = {
	"@context": [
		"https://w3id.org/security/v1",
		"https://www.w3.org/ns/activitystreams",
		{
			Hashtag: "as:Hashtag",
			sensitive: "as:sensitive",
			commentsEnabled: { "@id": "pixelfed:commentsEnabled", "@type": "schema:Boolean" },
			capabilities: { "@id": "pixelfed:capabilities", "@container": "@set" },
			pixelfed: "http://pixelfed.org/ns#",
			schema: "http://schema.org/",
			blurhash: "toot:blurhash",
			toot: "http://joinmastodon.org/ns#",
		},
	],
	id: "https://pixelfed.social/p/dan/712345678901234567/activity",
	type: "Create",
	actor: "https://pixelfed.social/users/dan",
	published: "2026-10-03T18:20:00+00:00",
	to: ["https://www.w3.org/ns/activitystreams#Public"],
	cc: ["https://pixelfed.social/users/dan/followers"],
	object: {
		id: "https://pixelfed.social/p/dan/712345678901234567",
		type: "Note",
		summary: null,
		content:
			'Golden hour <a href="https://pixelfed.social/discover/tags/filmphotography?src=hash" title="#filmphotography" class="u-url hashtag" rel="external nofollow noopener">#filmphotography</a>',
		inReplyTo: null,
		published: "2026-10-03T18:20:00+00:00",
		url: "https://pixelfed.social/p/dan/712345678901234567",
		attributedTo: "https://pixelfed.social/users/dan",
		to: ["https://www.w3.org/ns/activitystreams#Public"],
		cc: ["https://pixelfed.social/users/dan/followers"],
		sensitive: false,
		attachment: [
			{
				type: "Image",
				mediaType: "image/jpeg",
				url: "https://pixelfed.social/storage/m/_v2/000/001/a1b2c3.jpg",
				name: "A beach at sunset",
				blurhash: "U9Fh=@~qD%M{xuIUWBof00Rj%Mxu",
				width: 1080,
				height: 1350,
			},
			{
				type: "Image",
				mediaType: "image/jpeg",
				url: "https://pixelfed.social/storage/m/_v2/000/001/d4e5f6.jpg",
				name: null,
				blurhash: "U7F~gc00_3t7M{t7t7of~qWBRjof",
				width: 1080,
				height: 1080,
			},
		],
		tag: [
			{
				type: "Hashtag",
				href: "https://pixelfed.social/discover/tags/filmphotography",
				name: "#filmphotography",
			},
		],
		commentsEnabled: true,
		capabilities: {
			announce: "https://www.w3.org/ns/activitystreams#Public",
			like: "https://www.w3.org/ns/activitystreams#Public",
			reply: "https://www.w3.org/ns/activitystreams#Public",
		},
		location: null,
	},
};

/** A like of a local article. */
export const PIXELFED_LIKE = {
	"@context": "https://www.w3.org/ns/activitystreams",
	id: "https://pixelfed.social/users/dan#likes/9988776",
	type: "Like",
	actor: "https://pixelfed.social/users/dan",
	object: LOCAL_ARTICLE,
};
