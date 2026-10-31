/**
 * The public pages the reader publishes beside its home: one per feature, one per way of
 * reading, and one per reader it is compared with. The header, footer and each family's
 * controller read these lists, so a page linked anywhere is a page that answers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Feature pages, in the order the header and footer list them. */
export const FEATURE_SLUGS = [
	"freshness",
	"filters",
	"articles",
	"search",
	"notifications",
	"organize",
	"your-data",
	"agents",
] as const;

/** One of the {@link FEATURE_SLUGS}. */
export type FeatureSlug = (typeof FEATURE_SLUGS)[number];

/** Ways of reading, each argued on a page of its own. */
export const USE_CASE_SLUGS = ["news", "developers", "research", "podcasts"] as const;

/** One of the {@link USE_CASE_SLUGS}. */
export type UseCaseSlug = (typeof USE_CASE_SLUGS)[number];

/** Readers the product is compared with, each on a page that says where it wins. */
export const COMPARISON_SLUGS = ["feedly", "inoreader", "feedbin", "newsblur"] as const;

/** One of the {@link COMPARISON_SLUGS}. */
export type ComparisonSlug = (typeof COMPARISON_SLUGS)[number];

/** The translation key segment each feature slug's copy lives under. */
export const FEATURE_KEYS: Record<FeatureSlug, string> = {
	freshness: "freshness",
	filters: "filters",
	articles: "articles",
	search: "search",
	notifications: "notifications",
	organize: "organize",
	"your-data": "yourData",
	agents: "agents",
};

/** Whether a route segment names a page in `slugs`, narrowing it to that family's slug. */
export function isSlug<Slug extends string>(
	slugs: readonly Slug[],
	value: string | undefined,
): value is Slug {
	return slugs.some((slug) => slug === value);
}
