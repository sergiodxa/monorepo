/**
 * The campaign metadata and click identifiers an outbound link is stripped of, and the
 * one function that strips them.
 *
 * It runs as a link is rendered rather than as a post is stored. The stored address is the
 * publisher's own and stays that way, so nothing here can be got wrong in a way that
 * cannot be undone; the list will grow when a network mints a new identifier, and a
 * render-time rule reaches every post already held rather than only what arrives after it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The prefix every campaign parameter in the Urchin convention shares. */
const CAMPAIGN_PREFIX = "utm_";

/**
 * Click identifiers, each minted by one ad network and each, by its own specification,
 * describing the advertisement a visit is attributed to rather than the page being asked
 * for. A server that answers differently without one is misconfigured, which is what the
 * per-feed preference beside this exists for.
 */
const CLICK_IDENTIFIERS = new Set([
	"_hsenc",
	"_hsmi",
	"dclid",
	"epik",
	"fbclid",
	"gbraid",
	"gclid",
	"igshid",
	"li_fat_id",
	"mc_cid",
	"mc_eid",
	"msclkid",
	"oly_anon_id",
	"oly_enc_id",
	"rdt_cid",
	"ttclid",
	"twclid",
	"vero_conv",
	"vero_id",
	"wbraid",
	"yclid",
]);

/** Whether one parameter names campaign metadata rather than what the reader asked for. */
function isTracking(name: string): boolean {
	let folded = name.toLowerCase();
	return folded.startsWith(CAMPAIGN_PREFIX) || CLICK_IDENTIFIERS.has(folded);
}

/**
 * The address with its tracking parameters removed, and everything else left exactly as the
 * publisher wrote it.
 *
 * Only the names above are ever removed, never an unknown one and never the query as a
 * whole, so a site that routes on `?p=123` is handed the address it published.
 *
 * @param url - The post's address, already parsed and known to be absolute.
 * @example withoutTrackingParameters(new URL(item.url)).toString();
 */
export function withoutTrackingParameters(url: URL): URL {
	let stripped = new URL(url);

	/**
	 * The names are read out before any is removed, since deleting while walking the live
	 * list skips the parameter that slid into the place of the one just taken out.
	 */
	let names = [...stripped.searchParams.keys()];
	for (let name of names) {
		if (isTracking(name)) stripped.searchParams.delete(name);
	}

	return stripped;
}
