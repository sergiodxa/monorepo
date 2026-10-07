/**
 * Reduces a `Referer` header to the hostname a visitor followed a link from and the kind of site
 * it is. A same-site referrer is internal navigation and reads as no referrer, so a touch only
 * ever credits an external site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Referrer, ReferrerKind } from "./types.js";

/**
 * Hosts with a known kind, matched against the referrer's hostname and each parent domain, most
 * specific first, so `mail.google.com` is `email` while `google.com` is `search`.
 */
const REFERRERS: Readonly<Record<string, ReferrerKind>> = {
	"bing.com": "search",
	"duckduckgo.com": "search",
	"search.yahoo.com": "search",
	"yandex.com": "search",
	"yandex.ru": "search",
	"baidu.com": "search",
	"ecosia.org": "search",
	"search.brave.com": "search",
	"startpage.com": "search",
	"kagi.com": "search",
	"qwant.com": "search",
	"naver.com": "search",
	"seznam.cz": "search",
	"facebook.com": "social",
	"fb.com": "social",
	"instagram.com": "social",
	"threads.net": "social",
	"t.co": "social",
	"twitter.com": "social",
	"x.com": "social",
	"linkedin.com": "social",
	"lnkd.in": "social",
	"reddit.com": "social",
	"news.ycombinator.com": "social",
	"youtube.com": "social",
	"tiktok.com": "social",
	"pinterest.com": "social",
	"bsky.app": "social",
	"mastodon.social": "social",
	"tumblr.com": "social",
	"vk.com": "social",
	"quora.com": "social",
	"discord.com": "social",
	"telegram.org": "social",
	"t.me": "social",
	"whatsapp.com": "social",
	"lobste.rs": "social",
	"mail.google.com": "email",
	"outlook.live.com": "email",
	"outlook.office.com": "email",
	"outlook.office365.com": "email",
	"mail.yahoo.com": "email",
	"mail.proton.me": "email",
	"mail.aol.com": "email",
	"app.fastmail.com": "email",
	"mail.zoho.com": "email",
	"app.hey.com": "email",
};

/**
 * Search engines that answer from a country-code domain (`google.co.uk`, `yahoo.co.jp`), matched
 * after the table so a mail subdomain listed there wins.
 */
const COUNTRY_SEARCH_ENGINES = /(^|\.)(google|bing|yahoo|yandex)\.[a-z]{2,3}(\.[a-z]{2})?$/;

/** Options for {@link classifyReferrer}. */
export interface ClassifyReferrerOptions {
	/** The hostname of the page being served; a referrer on the same host is internal. */
	host?: string;
	/** Extra `host → kind` entries, merged over the built-in table. */
	referrers?: Readonly<Record<string, ReferrerKind>>;
}

/**
 * The external site a `Referer` names, or `null` when the header is absent, malformed, not an
 * `http(s)` URL or on the page's own host. A host the tables do not list is `other`.
 *
 * @param header - The `Referer` header.
 * @example classifyReferrer("https://www.google.com/") // { host: "google.com", kind: "search" }
 * @example classifyReferrer("https://example.com/a", { host: "example.com" }) // null
 */
export function classifyReferrer(
	header: string | null,
	options: ClassifyReferrerOptions = {},
): Referrer | null {
	if (!header) return null;
	let url = URL.parse(header);
	if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) return null;

	let host = withoutWww(url.hostname.toLowerCase());
	if (host === "") return null;
	if (options.host !== undefined && host === withoutWww(options.host.toLowerCase())) return null;

	return { host, kind: kindOf(host, options.referrers) };
}

/** The hostname with one leading `www.` removed. */
function withoutWww(host: string): string {
	return host.startsWith("www.") ? host.slice(4) : host;
}

/** The kind the host or its nearest listed parent domain has, custom entries first. */
function kindOf(
	host: string,
	custom: Readonly<Record<string, ReferrerKind>> | undefined,
): ReferrerKind {
	let labels = host.split(".");
	for (let index = 0; index < labels.length - 1; index++) {
		let domain = labels.slice(index).join(".");
		let kind =
			(custom && Object.hasOwn(custom, domain) ? custom[domain] : undefined) ??
			(Object.hasOwn(REFERRERS, domain) ? REFERRERS[domain] : undefined);
		if (kind !== undefined) return kind;
	}
	return COUNTRY_SEARCH_ENGINES.test(host) ? "search" : "other";
}
