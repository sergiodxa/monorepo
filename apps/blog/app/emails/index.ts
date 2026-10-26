/**
 * Every email the site sends, declared with the schema of its props. Importing it costs the
 * schemas alone, so a job or the support desk sends an email without loading the template
 * that renders it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { email, emails } from "@sdxc/mail";
import * as s from "remix/data-schema";

/** One flagged bookmark as the digest lists it. */
const DIGEST_ITEM = s.object({
	title: s.string(),
	url: s.string(),
	flag: s.enum_(["moved", "gone"]),
	/** The final response's status, or `null` when the page never answered. */
	httpStatus: s.nullable(s.number()),
	/** Where a moved bookmark's redirects end now. */
	finalUrl: s.nullable(s.string()),
	/** The bookmark's CMS edit page, absolute so it opens from any mail client. */
	editUrl: s.string(),
});

/** A validated Encore support request, as the form's validator produced it. */
const SUPPORT_REQUEST = s.object({
	name: s.string(),
	email: s.string(),
	topic: s.string(),
	platform: s.string(),
	osVersion: s.string(),
	appVersion: s.string(),
	message: s.string(),
});

/** A validated press kit invitation, as the contact form's validator produced it. */
const PRESS_CONTACT = s.object({
	name: s.string(),
	email: s.string(),
	kind: s.string(),
	event: s.string(),
	message: s.string(),
});

/** The spam filter's doubt about a request, listed in the email when it was unsure. */
const SPAM_DOUBT = s.object({
	score: s.number(),
	signals: s.array(
		s.object({ check: s.string(), score: s.number(), detail: s.optional(s.string()) }),
	),
});

export default emails({
	bookmarks: {
		/** The bookmarks the weekly check found moved or gone since the last digest. */
		digest: email({ props: s.object({ items: s.array(DIGEST_ITEM) }) }),
	},
	press: {
		/** One invitation from the press kit's contact form, delivered to the author. */
		contact: email({
			props: s.object({
				request: PRESS_CONTACT,
				pageLanguage: s.string(),
				flagged: s.optional(SPAM_DOUBT),
			}),
		}),
	},
	encore: {
		/** One support request, delivered to the support inbox. */
		support: email({
			props: s.object({ request: SUPPORT_REQUEST, flagged: s.optional(SPAM_DOUBT) }),
		}),
	},
});
