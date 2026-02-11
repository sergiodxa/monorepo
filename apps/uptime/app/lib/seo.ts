import type { MetaDescriptor } from "react-router";

export const BASE_URL = "https://uptime.sergiodxa.com";

export interface GenerateMetaOptions {
	title: string;
	description: string;
	url: string;
	/** OG image URL - commented out for now, uncomment when ready */
	// image?: string;
	type?: "website" | "article";
	/** JSON-LD structured data to include */
	jsonLd?: object | object[];
}

/**
 * Generate standardized meta tags for SEO
 * Includes title, description, Open Graph, Twitter Cards, canonical URL, and JSON-LD
 */
export function generateMeta(options: GenerateMetaOptions): MetaDescriptor[] {
	let { title, description, url, type = "website", jsonLd } = options;

	// Ensure URL is absolute
	let absoluteUrl = url.startsWith("http") ? url : new URL(url, BASE_URL).toString();

	// Remove trailing slash for consistency (except for root)
	if (absoluteUrl !== BASE_URL + "/" && absoluteUrl.endsWith("/")) {
		absoluteUrl = absoluteUrl.slice(0, -1);
	}

	let meta: MetaDescriptor[] = [
		// Basic meta
		{ title },
		{ name: "description", content: description },

		// Open Graph
		{ property: "og:title", content: title },
		{ property: "og:description", content: description },
		{ property: "og:type", content: type },
		{ property: "og:url", content: absoluteUrl },
		{ property: "og:site_name", content: "Uptime" },

		// Twitter Card
		{ name: "twitter:card", content: "summary_large_image" },
		{ name: "twitter:title", content: title },
		{ name: "twitter:description", content: description },

		// Canonical URL
		{ tagName: "link", rel: "canonical", href: absoluteUrl },
	];

	// Uncomment when og:image is ready
	// if (image) {
	// 	let absoluteImage = image.startsWith("http") ? image : new URL(image, BASE_URL).toString();
	// 	meta.push(
	// 		{ property: "og:image", content: absoluteImage },
	// 		{ name: "twitter:image", content: absoluteImage },
	// 	);
	// }

	// Add JSON-LD structured data using React Router's built-in support
	if (jsonLd) {
		meta.push({ "script:ld+json": jsonLd });
	}

	return meta;
}

/**
 * Organization schema for structured data (JSON-LD)
 * Use on homepage/root layout
 */
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

/**
 * WebSite schema for structured data (JSON-LD)
 * Use on homepage
 */
export function getWebSiteSchema() {
	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: "Uptime",
		url: BASE_URL,
		description:
			"Usage-based uptime monitoring service. Monitor websites, APIs, DNS, SSL certificates, and cron jobs from multiple global regions.",
	};
}

/**
 * SoftwareApplication schema for feature pages
 */
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
 * FAQPage schema for pages with FAQ sections
 */
export function getFAQSchema(faqs: Array<{ question: string; answer: string }>) {
	return {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: faqs.map((faq) => ({
			"@type": "Question",
			name: faq.question,
			acceptedAnswer: {
				"@type": "Answer",
				text: faq.answer,
			},
		})),
	};
}
