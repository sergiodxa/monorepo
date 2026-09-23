/**
 * The applications the showcase lists, and the same five a package page may name as
 * users of it. The list is curated rather than exhaustive: an app that reaches for a
 * handful of packages proves nothing about them, and a count a reader cannot check
 * anywhere else on the site is worse than no count. These five are the ones whose
 * dependency lists say something.
 *
 * One list serves both surfaces on purpose. A package page claiming five users while
 * the showcase lists five applications is consistent; one claiming nine and linking
 * five is the first thing a reader notices about the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One application, named by its workspace directory and by how it is written about. */
export interface ApplicationDefinition {
	directory: string;
	title: string;
	/** What it does, in the sentence the showcase lists it under. */
	summary: string;
	/** What reading its source is worth, which is why it is in the showcase at all. */
	study: string;
	/**
	 * Where it is running, or `null` for one whose source is all there is to read.
	 * Unshipped code is still readable code, so it is labelled rather than hidden.
	 */
	href: string | null;
}

export const APPLICATIONS: ApplicationDefinition[] = [
	{
		directory: "uptime",
		title: "uptime",
		summary: "Monitors that check a URL on a schedule and say what they saw.",
		study:
			"The widest reader of the collection: scheduled jobs, rate limits, billing, mail, feature flags and a full marketing site, all on the same set.",
		href: "https://uptime.sergiodxa.com",
	},
	{
		directory: "auth-saas",
		title: "auth-saas",
		summary: "A multi-tenant OpenID Connect provider, a tenant to a Durable Object.",
		study:
			"What the security packages look like under load: JWTs, passkeys, SAML, signed webhooks and per-tenant storage composed into one provider.",
		href: null,
	},
	{
		directory: "reader",
		title: "reader",
		summary: "A feed reader that subscribes, polls and pushes what it finds.",
		study:
			"Every feed format in the collection read by one app — RSS, Atom, JSON Feed and OPML — alongside WebSub, caching and article extraction.",
		href: null,
	},
	{
		directory: "blog",
		title: "blog",
		summary: "The author's own site, its articles written in markdown.",
		study:
			"The content pipeline end to end: markdown to a typed AST, syntax highlighting, feeds, sitemaps and the SEO tags around them.",
		href: "https://sergiodxa.com",
	},
	{
		directory: "books",
		title: "books",
		summary: "A reading log, kept small on purpose.",
		study:
			"The smallest complete application here, and the shortest read: what an app needs from the collection before it needs anything else.",
		href: "https://books.sergiodxa.com",
	},
];
