/**
 * Turns the posts a store answered with into the rows a timeline prints, and the short
 * times that run down the column beside them.
 *
 * The queue, a single feed and a search show the same row and differ only in where their
 * posts came from, so the mapping lives here and each controller says whether its posts
 * come from more than one feed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n } from "@sdxc/i18n";

import type { UserStore } from "~/database/user-do";
import type { TagChips } from "~/resources/views/tag-chips";
import type { Timeline } from "~/resources/views/timeline";

import routes from "~/routes/web";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How recent a post has to be for the column to say how long ago it arrived. Inside a
 * week "two days ago" places a post against the reader's own morning; past it, the day
 * it was published is the thing they remember it by.
 */
const RELATIVE_WINDOW = 7 * DAY;

/** What building a row needs off the request. */
export interface TimelineContext {
	i18next: i18n;
	locale: string;
}

/**
 * How long ago something happened, in the largest unit that still counts something:
 * minutes inside the hour, hours inside the day, days beyond that. Anything under a
 * minute reads as a minute, which is the smallest amount of time worth naming here.
 *
 * @param elapsed - Milliseconds since the moment being described.
 * @param locale - The request's language, which words and orders the phrase.
 */
function ago(elapsed: number, locale: string): string {
	let relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

	if (elapsed < HOUR) return relative.format(-Math.max(1, Math.round(elapsed / MINUTE)), "minute");
	if (elapsed < DAY) return relative.format(-Math.round(elapsed / HOUR), "hour");
	return relative.format(-Math.round(elapsed / DAY), "day");
}

/**
 * The date as a column of a list carries it: how long ago it was while that still places
 * it, then the day it fell on, and the year as well once the year is a different one.
 *
 * @param moment - Epoch milliseconds of the thing being dated.
 * @param locale - The request's language, which words and orders the result.
 * @param now - The moment the page is being rendered at, which the date is read against.
 * @returns A phrase short enough to scan down a column, such as `3 hours ago` or `Jan 2`.
 * @example shortDate(item.publishedAt, ctx.locale, Date.now());
 */
export function shortDate(moment: number, locale: string, now: number): string {
	let elapsed = now - moment;
	if (elapsed >= 0 && elapsed < RELATIVE_WINDOW) return ago(elapsed, locale);

	let isThisYear = new Date(now).getFullYear() === new Date(moment).getFullYear();

	return new Intl.DateTimeFormat(locale, {
		month: "short",
		day: "numeric",
		year: isThisYear ? undefined : "numeric",
	}).format(moment);
}

/**
 * The full date, which is what a short one stands for and what its tooltip spells out.
 *
 * @param moment - Epoch milliseconds of the thing being dated.
 * @param locale - The request's language, which words and orders the result.
 * @example exactDate(item.publishedAt, ctx.locale);
 */
export function exactDate(moment: number, locale: string): string {
	return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(moment);
}

/**
 * A post's address as a link may carry it: an absolute `http` or `https` URL, which is
 * what a browser opens as a web page. The publisher wrote that address and it is stored
 * as written, so anything else — a scheme of its own, an address relative to a site this
 * app is not — leaves the title plain text rather than a link somewhere unintended.
 *
 * @param stored - The address the post carries, as the store answered with it.
 */
function linkable(stored: string | null): string | null {
	if (stored === null || !URL.canParse(stored)) return null;

	let url = new URL(stored);
	if (url.protocol !== "http:" && url.protocol !== "https:") return null;

	return url.toString();
}

/**
 * The copy every row of a list prints, which is the same on every surface that prints one:
 * three lists of the same rows differ in the posts they hold and in nothing a row says.
 *
 * @param i18next - The request's dictionary.
 * @example <Timeline entries={entries} copy={timelineCopy(ctx.i18next)} {...placement} />
 */
export function timelineCopy(i18next: i18n): Timeline.Copy {
	return {
		markRead: i18next.t("timeline.markRead"),
		markUnread: i18next.t("timeline.markUnread"),
		markFailed: i18next.t("timeline.markFailed"),
		read: i18next.t("timeline.read"),
		save: i18next.t("timeline.save"),
		unsave: i18next.t("timeline.unsave"),
		saveFailed: i18next.t("timeline.saveFailed"),
		saveFull: i18next.t("timeline.saveFull"),
		saved: i18next.t("timeline.saved"),
		flagged: i18next.t("timeline.flagged"),
		readHere: i18next.t("timeline.readHere"),
		newer: i18next.t("timeline.newer"),
		older: i18next.t("timeline.older"),
		end: i18next.t("timeline.end"),
	};
}

/**
 * What the strip of labels under a post prints, which is the same on both surfaces that
 * draw one.
 *
 * @param i18next - The request's dictionary.
 * @example <Timeline entries={entries} tagging={{ ...taggingCopy(ctx.i18next), options }} />
 */
export function taggingCopy(i18next: i18n): TagChips.Copy {
	return {
		legend: i18next.t("tags.strip.legend"),
		add: i18next.t("tags.strip.add"),
		placeholder: i18next.t("tags.strip.placeholder"),
		remove: i18next.t("tags.strip.remove"),
	};
}

/**
 * Builds one page of timeline rows from the posts a store answered with.
 *
 * @param ctx - The request's dictionary and language, which every label is resolved through.
 * @param items - The posts to print, in the order they are printed.
 * @param feedTitles - Feed titles by id for a surface holding posts from many feeds; `null`
 * on a surface showing one feed, whose every row would otherwise name the same source.
 * @param tagging - Whether each row carries the strip of labels and the field that adds
 * one, which the surfaces whose posts are kept by definition ask for and no river does.
 * @example timelineEntries(ctx, page.items, new Map(page.feeds.map((f) => [f.id, f.title])));
 */
export function timelineEntries(
	ctx: TimelineContext,
	items: UserStore.Item[],
	feedTitles: Map<string, string> | null,
	tagging = false,
): Timeline.Entry[] {
	let now = Date.now();

	return items.map((item) => {
		let url = linkable(item.url);

		/**
		 * Inside one feed the source is the same word on every row, so the author is what
		 * tells one post from the next there.
		 */
		let source: string | null = null;
		if (feedTitles) source = feedTitles.get(item.feedId) ?? null;
		else if (item.author) source = ctx.i18next.t("timeline.byAuthor", { author: item.author });

		return {
			id: item.id,
			title: item.title,
			url,
			/**
			 * Where the browser reports the click, so following the title is what takes the
			 * post out of the queue. A row with nothing to open carries no report.
			 */
			ping: url === null ? null : routes.items.open.href({ itemId: item.id }),
			/**
			 * The post's own page, which holds what the feed gave and, underneath it, the
			 * article behind the link. A row whose feed gave no address has nothing to fetch,
			 * so it carries no way in.
			 */
			readHref: url === null ? null : routes.post.href({ feed: item.feedId, item: item.id }),
			source,
			summary: item.summary,
			time: shortDate(item.publishedAt, ctx.locale, now),
			timeLabel: ctx.i18next.t("timeline.publishedOn", {
				date: exactDate(item.publishedAt, ctx.locale),
			}),
			dateTime: new Date(item.publishedAt).toISOString(),
			isRead: item.readAt !== null,
			/**
			 * Read off the post rather than off the page it is on, so the mark says which of
			 * its two things it would do wherever a reader meets the post: a post kept from
			 * the queue shows as kept there, and the one control means one thing everywhere.
			 */
			isSaved: item.savedAt !== null,
			/**
			 * Whether a rule of the reader's own picked this post out on arrival. Read off the
			 * post, so the mark means the same thing wherever the post is met.
			 */
			isFlagged: item.flaggedAt !== null,
			/**
			 * The labels on the post, each a way into what else is kept under it, and the
			 * address another one is applied at. Both are left off wherever the strip is not
			 * drawn, so a river's rows carry nothing they would never print.
			 */
			tags: tagging
				? item.tags.map((tag) => ({
						id: tag.id,
						name: tag.name,
						href: routes.tag.href({ tag: tag.id }),
						removeAction: routes.tags.remove.href({ itemId: item.id, tagId: tag.id }),
					}))
				: [],
			applyTagAction: tagging ? routes.tags.apply.href({ itemId: item.id }) : null,
		};
	});
}
