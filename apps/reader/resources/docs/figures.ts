/**
 * Every number the help pages quote, read from the constant that enforces it, on top of
 * the figures the public pages already share. A limit changed in code is a limit changed
 * in every help page that states it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DEFAULT_MAX_QUERY_LENGTH, DEFAULT_MAX_QUERY_TERMS } from "@sdxc/search/query";

import { TIER_LIMITS } from "~/app/services/entitlement";
import { HISTORY_PAGE_LIMIT } from "~/app/services/history";
import { PUSH_GAP_MS } from "~/app/services/notify";
import {
	AGENT_DAILY_CALLS,
	SEARCH_NAME_LENGTH,
	TAG_NAME_LENGTH,
	TAGS_PER_ITEM,
	TOKEN_LIFETIME_MS,
	TOKEN_LIMIT,
} from "~/database/schema";
import { landingFigures } from "~/resources/components/marketing/figures";

/** One day, which the token lifetime is quoted in. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The landing's figures plus the ones only a help page needs, each formatted for the
 * request's locale.
 *
 * @example let figures = docsFigures("en"); figures.freeFeeds; // "20"
 */
export function docsFigures(locale: string): Record<string, string> {
	let count = (value: number) => value.toLocaleString(locale);

	return {
		...landingFigures(locale),
		paidFeeds: count(TIER_LIMITS.paid.feeds),
		premiumFeeds: count(TIER_LIMITS.premium.feeds),
		premiumRules: count(TIER_LIMITS.premium.rules),
		historyPages: count(HISTORY_PAGE_LIMIT),
		tagsPerPost: count(TAGS_PER_ITEM),
		tagNameLength: count(TAG_NAME_LENGTH),
		searchNameLength: count(SEARCH_NAME_LENGTH),
		queryTerms: count(DEFAULT_MAX_QUERY_TERMS),
		queryLength: count(DEFAULT_MAX_QUERY_LENGTH),
		tokenLimit: count(TOKEN_LIMIT),
		tokenDays: count(TOKEN_LIFETIME_MS / DAY_MS),
		agentCalls: count(AGENT_DAILY_CALLS),
		pushGapMinutes: count(PUSH_GAP_MS / 60_000),
	};
}
