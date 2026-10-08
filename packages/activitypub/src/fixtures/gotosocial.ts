/**
 * Documents in the shapes GoToSocial emits: members sorted by name, one-entry lists
 * written as a single value, a key id without a fragment, and `interactionPolicy`. Ids
 * are made up; the members are GoToSocial's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { FAKE_PUBLIC_KEY_PEM, LOCAL_ACTOR, LOCAL_ARTICLE } from "./shared.js";

/** A GoToSocial account that approves followers by hand. */
export const GOTOSOCIAL_ACTOR = {
	"@context": [
		"https://w3id.org/security/v1",
		"https://www.w3.org/ns/activitystreams",
		{
			discoverable: "toot:discoverable",
			featured: { "@id": "toot:featured", "@type": "@id" },
			manuallyApprovesFollowers: "as:manuallyApprovesFollowers",
			toot: "http://joinmastodon.org/ns#",
		},
	],
	discoverable: true,
	endpoints: { sharedInbox: "https://gts.superseriousbusiness.org/sharedInbox" },
	featured: "https://gts.superseriousbusiness.org/users/erin/collections/featured",
	followers: "https://gts.superseriousbusiness.org/users/erin/followers",
	following: "https://gts.superseriousbusiness.org/users/erin/following",
	icon: {
		mediaType: "image/webp",
		type: "Image",
		url: "https://gts.superseriousbusiness.org/fileserver/01H0000000/attachment/original/01H0000001.webp",
	},
	id: "https://gts.superseriousbusiness.org/users/erin",
	inbox: "https://gts.superseriousbusiness.org/users/erin/inbox",
	manuallyApprovesFollowers: true,
	name: "Erin",
	outbox: "https://gts.superseriousbusiness.org/users/erin/outbox",
	preferredUsername: "erin",
	publicKey: {
		id: "https://gts.superseriousbusiness.org/users/erin/main-key",
		owner: "https://gts.superseriousbusiness.org/users/erin",
		publicKeyPem: FAKE_PUBLIC_KEY_PEM,
	},
	published: "2023-01-10T12:00:00Z",
	summary: "<p>Small server, big opinions.</p>",
	tag: [],
	type: "Person",
	url: "https://gts.superseriousbusiness.org/@erin",
};

/** A reply addressed to one audience entry each, written as plain values. */
export const GOTOSOCIAL_CREATE_NOTE = {
	"@context": [
		"https://gotosocial.org/ns",
		"https://www.w3.org/ns/activitystreams",
		{ sensitive: "as:sensitive" },
	],
	actor: "https://gts.superseriousbusiness.org/users/erin",
	cc: "https://gts.superseriousbusiness.org/users/erin/followers",
	id: "https://gts.superseriousbusiness.org/users/erin/statuses/01J9Z8Y7X6W5V4T3S2R1Q0P9N8/activity",
	object: {
		attachment: [],
		attributedTo: "https://gts.superseriousbusiness.org/users/erin",
		cc: ["https://gts.superseriousbusiness.org/users/erin/followers", LOCAL_ACTOR],
		content: "<p>Agreed with most of this.</p>",
		contentMap: { en: "<p>Agreed with most of this.</p>" },
		id: "https://gts.superseriousbusiness.org/users/erin/statuses/01J9Z8Y7X6W5V4T3S2R1Q0P9N8",
		inReplyTo: LOCAL_ARTICLE,
		interactionPolicy: {
			canAnnounce: {
				always: ["https://www.w3.org/ns/activitystreams#Public"],
				approvalRequired: [],
			},
			canLike: { always: ["https://www.w3.org/ns/activitystreams#Public"], approvalRequired: [] },
			canReply: { always: ["https://www.w3.org/ns/activitystreams#Public"], approvalRequired: [] },
		},
		published: "2026-10-04T07:15:00Z",
		replies: {
			first: {
				id: "https://gts.superseriousbusiness.org/users/erin/statuses/01J9Z8Y7X6W5V4T3S2R1Q0P9N8/replies?page=true",
				next: "https://gts.superseriousbusiness.org/users/erin/statuses/01J9Z8Y7X6W5V4T3S2R1Q0P9N8/replies?only_other_accounts=false&page=true",
				partOf:
					"https://gts.superseriousbusiness.org/users/erin/statuses/01J9Z8Y7X6W5V4T3S2R1Q0P9N8/replies",
				type: "CollectionPage",
			},
			id: "https://gts.superseriousbusiness.org/users/erin/statuses/01J9Z8Y7X6W5V4T3S2R1Q0P9N8/replies",
			type: "Collection",
		},
		sensitive: false,
		summary: "",
		tag: { href: LOCAL_ACTOR, name: "@hello@letters.blog", type: "Mention" },
		to: "https://www.w3.org/ns/activitystreams#Public",
		type: "Note",
		url: "https://gts.superseriousbusiness.org/@erin/statuses/01J9Z8Y7X6W5V4T3S2R1Q0P9N8",
	},
	published: "2026-10-04T07:15:00Z",
	to: "https://www.w3.org/ns/activitystreams#Public",
	type: "Create",
};

/** A follow of the local actor, written with a string `@context`. */
export const GOTOSOCIAL_FOLLOW = {
	"@context": "https://www.w3.org/ns/activitystreams",
	actor: "https://gts.superseriousbusiness.org/users/erin",
	id: "https://gts.superseriousbusiness.org/users/erin/follow/01J9Z9A0B1C2D3E4F5G6H7J8K9",
	object: LOCAL_ACTOR,
	type: "Follow",
};

/** Pinned posts: an ordered collection whose items are IRIs. */
export const GOTOSOCIAL_FEATURED = {
	"@context": "https://www.w3.org/ns/activitystreams",
	id: "https://gts.superseriousbusiness.org/users/erin/collections/featured",
	orderedItems: [
		"https://gts.superseriousbusiness.org/users/erin/statuses/01J9Z8Y7X6W5V4T3S2R1Q0P9N8",
		"https://gts.superseriousbusiness.org/users/erin/statuses/01J0000000000000000000000",
	],
	totalItems: 2,
	type: "OrderedCollection",
};
