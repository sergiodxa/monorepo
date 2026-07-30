/**
 * Structured-data builders for the public pages: schema.org JSON-LD objects a
 * controller hands to `DocumentLayout`'s `seo.jsonLd`, plus the canonical base URL
 * every absolute link in `<head>` is resolved against.
 *
 * These are plain object builders — no serialization, no escaping, no `<script>` of
 * their own. `DocumentLayout` owns emitting them, so a controller only decides *which*
 * schema describes its page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Canonical origin every `<head>` URL (canonical link, `og:url`, schema `url`) is built against. */
export const BASE_URL = "https://uptime.sergiodxa.com";

/** The product's own description, reused by the schemas that describe the site as a whole. */
const SITE_DESCRIPTION =
	"Usage-based uptime monitoring service. Monitor websites, APIs, DNS, SSL certificates, and cron jobs from multiple global regions.";

/**
 * Resolves a request URL to its canonical absolute form: same origin as
 * {@link BASE_URL} regardless of which host served the request (custom domain, the
 * `workers.dev` subdomain, a preview deployment), with the trailing slash dropped
 * everywhere but the root so one page never advertises two canonical URLs.
 *
 * @example canonicalUrl("https://ping.workers.dev/features/monitors/") // "https://uptime.sergiodxa.com/features/monitors"
 */
export function canonicalUrl(url: string | URL): string {
	let { pathname, search } = new URL(url);
	let canonical = new URL(`${pathname}${search}`, BASE_URL).toString();
	if (canonical !== `${BASE_URL}/` && canonical.endsWith("/")) return canonical.slice(0, -1);
	return canonical;
}

/** `Organization` schema — the publisher behind the product. */
export function getOrganizationSchema() {
	return {
		"@context": "https://schema.org",
		"@type": "Organization",
		name: "Uptime",
		url: BASE_URL,
		logo: `${BASE_URL}/android-chrome-512x512.png`,
		sameAs: ["https://github.com/sergiodxa"],
	};
}

/** `WebSite` schema — for the homepage only, where the subject is the site itself. */
export function getWebSiteSchema() {
	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: "Uptime",
		url: BASE_URL,
		description: SITE_DESCRIPTION,
	};
}

/** `SoftwareApplication` schema — for a page whose subject is the product or one of its capabilities. */
export function getSoftwareApplicationSchema(options: {
	name: string;
	description: string;
	featureList?: string[];
}) {
	return {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		name: options.name,
		description: options.description,
		applicationCategory: "WebApplication",
		operatingSystem: "Any",
		offers: {
			"@type": "Offer",
			price: "0",
			priceCurrency: "USD",
			description: "Usage-based pricing starting at $0/month",
		},
		...(options.featureList && { featureList: options.featureList }),
	};
}

/**
 * `FAQPage` schema — for a page carrying a real FAQ section, so the questions can
 * surface as rich results. Pass the same question/answer pairs the page renders;
 * a schema describing answers a visitor can't find on the page is a violation of
 * Google's structured-data policy, not just a mismatch.
 */
export function getFAQSchema(faqs: Array<{ question: string; answer: string }>) {
	return {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: faqs.map((faq) => ({
			"@type": "Question",
			name: faq.question,
			acceptedAnswer: { "@type": "Answer", text: faq.answer },
		})),
	};
}
