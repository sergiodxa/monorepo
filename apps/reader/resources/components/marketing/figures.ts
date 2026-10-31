/**
 * Every number the public pages quote, read from the constant that enforces it and
 * formatted for the request's locale. Copy interpolates these, so a limit changed in code
 * is a limit changed on every page that mentions it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";

import { DAY_MS } from "@sdxc/dates/zone";

import tools from "~/app/mcp/tools";
import { GRACE_PERIOD_MS, TIER_LIMITS } from "~/app/services/entitlement";
import { HISTORY_ENTRY_LIMIT } from "~/app/services/history";
import { EMAIL_GAP_MS } from "~/app/services/notify";
import { MAX_SUMMARY_LENGTH } from "~/app/services/refresh";
import { POLL_FLOOR_MS } from "~/database/feed-schema";
import { TAG_LIMIT } from "~/database/schema";
import { formatInterval } from "~/resources/components/marketing/scenes";

/**
 * The figures as message variables. Every page passes the whole set to every message it
 * renders, so a sentence may quote any of them without its controller knowing which.
 */
export function landingFigures(locale: string): Record<string, string> {
	let count = (value: number) => value.toLocaleString(locale);
	let interval = (ms: number | null) => (ms === null ? "" : formatInterval(ms));

	return {
		freeFeeds: count(TIER_LIMITS.free.feeds),
		freePosts: count(TIER_LIMITS.free.posts),
		freeSaved: count(TIER_LIMITS.free.saved),
		premiumPosts: count(TIER_LIMITS.premium.posts),
		paidRules: count(TIER_LIMITS.paid.rules),
		freeSearchDays: count(TIER_LIMITS.free.searchWindowDays ?? 0),
		paidCheck: interval(TIER_LIMITS.paid.checkIntervalMs),
		premiumCheck: interval(TIER_LIMITS.premium.checkIntervalMs),
		pollFloor: formatInterval(POLL_FLOOR_MS),
		historyPosts: count(HISTORY_ENTRY_LIMIT),
		freePins: count(TIER_LIMITS.free.pins),
		pinLimit: count(TIER_LIMITS.paid.pins),
		tagLimit: count(TAG_LIMIT),
		freeSavedSearches: count(TIER_LIMITS.free.savedSearches),
		savedSearchLimit: count(TIER_LIMITS.paid.savedSearches),
		summaryChars: count(MAX_SUMMARY_LENGTH),
		graceDays: count(GRACE_PERIOD_MS / DAY_MS),
		emailGapHours: count(EMAIL_GAP_MS / (60 * 60 * 1000)),
		toolCount: count(Object.keys(tools).length),
	};
}

/**
 * The request's translator with {@link landingFigures} bound in, so every message on a
 * public page can quote any figure, and a value a call site passes still wins.
 *
 * @example let t = landingTranslate(ctx.intl, ctx.locale);
 */
export function landingTranslate(intl: { t: Translate }, locale: string): Translate {
	let figures = landingFigures(locale);
	return (key, values) => intl.t(key, { ...figures, ...values });
}
