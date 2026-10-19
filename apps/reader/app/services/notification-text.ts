/**
 * The two lines a notification is read as, on a lock screen and in an inbox alike: a count,
 * and up to three publishers by name. The push payload and the email channel both write
 * them from here, so the two channels say the same thing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";

/** What a check found, as far as the copy reads it. */
export interface NotificationSummary {
	/** Posts written since the last notification. */
	posts: number;
	/** How many feeds they came from. */
	feeds: number;
	/** Up to three of those feeds, by name. */
	titles: string[];
}

/** The two lines a notification is drawn as. */
export interface NotificationText {
	title: string;
	body: string;
}

/**
 * How the summary reads in one language. No post title, no post URL and no author — a feed
 * title is a publication the reader already chose out of a list, and a post title is what
 * they are reading right now.
 *
 * @param t - A translator already fixed to a language.
 * @param summary - What the check found since the last notification.
 * @example let { title, body } = textFrom(t, summary);
 */
export function textFrom(t: Translate, summary: NotificationSummary): NotificationText {
	return {
		title: t("notifications.title", { count: summary.posts }),
		body: t("notifications.body", {
			count: summary.feeds,
			feeds: summary.titles.join(", "),
		}),
	};
}
