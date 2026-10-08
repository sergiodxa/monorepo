/**
 * Documents in the shapes Threads emits: trailing-slash ids under `/ap/`, a profile URL
 * on another host than the actor, and a post whose `url` is a list of Links. Ids are
 * made up; the members are those Threads publishes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { FAKE_PUBLIC_KEY_PEM, LOCAL_ACTOR, LOCAL_ARTICLE } from "./shared.js";

/** The `@context` Threads writes. */
const CONTEXT = [
	"https://www.w3.org/ns/activitystreams",
	"https://w3id.org/security/v1",
	{
		manuallyApprovesFollowers: "as:manuallyApprovesFollowers",
		sensitive: "as:sensitive",
		toot: "http://joinmastodon.org/ns#",
		discoverable: "toot:discoverable",
		indexable: "toot:indexable",
	},
];

/** A Threads profile shared to the fediverse. */
export const THREADS_ACTOR = {
	"@context": CONTEXT,
	id: "https://threads.net/ap/users/17841400000000001/",
	type: "Person",
	preferredUsername: "frank",
	name: "Frank",
	summary: "",
	url: "https://www.threads.net/@frank",
	inbox: "https://threads.net/ap/users/17841400000000001/inbox/",
	outbox: "https://threads.net/ap/users/17841400000000001/outbox/",
	followers: "https://threads.net/ap/users/17841400000000001/followers/",
	following: "https://threads.net/ap/users/17841400000000001/following/",
	endpoints: { sharedInbox: "https://threads.net/ap/inbox/" },
	publicKey: {
		id: "https://threads.net/ap/users/17841400000000001/#main-key",
		owner: "https://threads.net/ap/users/17841400000000001/",
		publicKeyPem: FAKE_PUBLIC_KEY_PEM,
	},
	icon: {
		type: "Image",
		url: "https://scontent.cdninstagram.com/v/t51.2885-19/000000000_n.jpg",
	},
	manuallyApprovesFollowers: false,
	discoverable: true,
	indexable: false,
	published: "2024-03-21T00:00:00Z",
};

/** A reply whose `url` lists the HTML page among other links. */
export const THREADS_CREATE_NOTE = {
	"@context": CONTEXT,
	id: "https://threads.net/ap/users/17841400000000001/post/18000000000000001/activity/",
	type: "Create",
	actor: "https://threads.net/ap/users/17841400000000001/",
	published: "2026-10-05T15:00:00+0000",
	to: ["as:Public"],
	cc: ["https://threads.net/ap/users/17841400000000001/followers/", LOCAL_ACTOR],
	object: {
		id: "https://threads.net/ap/users/17841400000000001/post/18000000000000001/",
		type: "Note",
		attributedTo: "https://threads.net/ap/users/17841400000000001/",
		content: "<p>Bookmarking this for later.</p>",
		published: "2026-10-05T15:00:00+0000",
		inReplyTo: LOCAL_ARTICLE,
		to: ["as:Public"],
		cc: ["https://threads.net/ap/users/17841400000000001/followers/", LOCAL_ACTOR],
		url: [
			{ type: "Link", href: "threads://post/C8abcdEFgh", mediaType: "application/x-threads" },
			{
				type: "Link",
				href: "https://www.threads.net/@frank/post/C8abcdEFgh",
				mediaType: "text/html",
			},
		],
		sensitive: false,
		tag: [{ type: "Mention", href: LOCAL_ACTOR, name: "@hello@letters.blog" }],
		attachment: [],
	},
};

/** A like of a local article. */
export const THREADS_LIKE = {
	"@context": "https://www.w3.org/ns/activitystreams",
	id: "https://threads.net/ap/users/17841400000000001/likes/18000000000000002/",
	type: "Like",
	actor: "https://threads.net/ap/users/17841400000000001/",
	object: LOCAL_ARTICLE,
};
