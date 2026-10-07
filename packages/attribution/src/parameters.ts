/**
 * The query parameters that describe how a visitor reached a page rather than which page they
 * asked for: the `utm_*` campaign parameters, ad-network click identifiers and the parameters
 * email platforms append. One list serves capture, link cleaning and canonical URLs alike.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The prefix every campaign parameter in the Urchin convention shares. */
const CAMPAIGN_PREFIX = "utm_";

/**
 * The nine `utm_*` parameters a touch's `Utm` fields are read from, keyed by field. Stripping
 * removes every `utm_`-prefixed name, so a non-standard one such as `utm_referral` goes too.
 */
export const CAMPAIGN_PARAMETERS = {
	source: "utm_source",
	medium: "utm_medium",
	campaign: "utm_campaign",
	term: "utm_term",
	content: "utm_content",
	id: "utm_id",
	sourcePlatform: "utm_source_platform",
	creativeFormat: "utm_creative_format",
	marketingTactic: "utm_marketing_tactic",
} as const;

/**
 * What a click identifier says about the visit. `kind` places the network for channel rules;
 * an `email` identifier encodes the subscriber, so its value is never read into a touch.
 */
export interface ClickIdentifier {
	network: string;
	paid: boolean;
	kind: "search" | "social" | "display" | "email";
}

/**
 * Every click identifier, by its lowercase parameter name. `fbclid` and `igshid` are unpaid
 * because Meta appends them to every outbound click, paid or not.
 */
export const CLICK_IDENTIFIERS: Readonly<Record<string, ClickIdentifier>> = {
	gclid: { network: "google-ads", paid: true, kind: "search" },
	gbraid: { network: "google-ads", paid: true, kind: "search" },
	wbraid: { network: "google-ads", paid: true, kind: "search" },
	dclid: { network: "google-display", paid: true, kind: "display" },
	msclkid: { network: "microsoft-ads", paid: true, kind: "search" },
	yclid: { network: "yandex-direct", paid: true, kind: "search" },
	fbclid: { network: "meta", paid: false, kind: "social" },
	igshid: { network: "instagram", paid: false, kind: "social" },
	ttclid: { network: "tiktok-ads", paid: true, kind: "social" },
	li_fat_id: { network: "linkedin-ads", paid: true, kind: "social" },
	twclid: { network: "x-ads", paid: true, kind: "social" },
	rdt_cid: { network: "reddit-ads", paid: true, kind: "social" },
	epik: { network: "pinterest-ads", paid: true, kind: "social" },
	sccid: { network: "snapchat-ads", paid: true, kind: "social" },
	mc_cid: { network: "mailchimp", paid: false, kind: "email" },
	mc_eid: { network: "mailchimp", paid: false, kind: "email" },
	_hsenc: { network: "hubspot", paid: false, kind: "email" },
	_hsmi: { network: "hubspot", paid: false, kind: "email" },
	vero_conv: { network: "vero", paid: false, kind: "email" },
	vero_id: { network: "vero", paid: false, kind: "email" },
	oly_anon_id: { network: "omeda", paid: false, kind: "email" },
	oly_enc_id: { network: "omeda", paid: false, kind: "email" },
};

/**
 * Whether a query parameter names campaign metadata rather than what the visitor asked for.
 * Names are case-folded, so `UTM_Campaign` and `GCLID` match.
 *
 * @example isTrackingParameter("utm_source") // true
 * @example isTrackingParameter("p") // false
 */
export function isTrackingParameter(name: string): boolean {
	let folded = name.toLowerCase();
	return folded.startsWith(CAMPAIGN_PREFIX) || Object.hasOwn(CLICK_IDENTIFIERS, folded);
}

/**
 * A copy of the URL with its tracking parameters removed and every other parameter left in the
 * order and encoding the publisher wrote, so a site that routes on `?p=123` keeps its address.
 *
 * @example withoutTracking(new URL("https://example.com/post?p=1&fbclid=x")).toString() // "https://example.com/post?p=1"
 */
export function withoutTracking(url: URL): URL {
	let stripped = new URL(url);
	if (stripped.search === "") return stripped;

	let kept = stripped.search
		.slice(1)
		.split("&")
		.filter((pair) => {
			if (pair === "") return false;
			let name = pair.split("=", 1)[0] ?? "";
			return !isTrackingParameter(decodeName(name));
		});

	stripped.search = kept.length === 0 ? "" : `?${kept.join("&")}`;
	return stripped;
}

/** A parameter name as `URLSearchParams` would read it, falling back to the raw text. */
function decodeName(name: string): string {
	try {
		return decodeURIComponent(name.replaceAll("+", " "));
	} catch {
		return name;
	}
}
