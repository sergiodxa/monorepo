/**
 * Reads UTM attribution off a request's query string so the forms on the page can carry
 * it through as hidden fields. Every page that collects an email needs the same four
 * parameters, and losing them loses the campaign a subscriber came from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** UTM attribution, as the forms render it into hidden fields. */
export interface Attribution {
	source?: string;
	campaign?: string;
	medium?: string;
	referral?: string;
}

/**
 * Extracts the four `utm_*` parameters a link may carry.
 *
 * @param params - The request URL's search params.
 * @returns The attribution, with absent parameters left undefined.
 * @example readAttribution(ctx.url.searchParams) // { source: "newsletter" }
 */
export function readAttribution(params: URLSearchParams): Attribution {
	return {
		source: params.get("utm_source") ?? undefined,
		campaign: params.get("utm_campaign") ?? undefined,
		medium: params.get("utm_medium") ?? undefined,
		referral: params.get("utm_referral") ?? undefined,
	};
}
