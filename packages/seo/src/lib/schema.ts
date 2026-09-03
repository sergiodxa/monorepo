/**
 * The curated slice of the schema.org vocabulary this package emits, written as
 * hand-typed interfaces, plus the builders that produce those nodes from page input.
 * Literal `@context`/`@type` types make a misspelled node impossible to compile, and
 * every URL a builder receives is resolved against the configured origin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absoluteUrl, canonicalUrl } from "./urls.js";

/** The one JSON-LD context value every top-level node declares. */
const SCHEMA_CONTEXT = "https://schema.org";

/** `query-input` variable name a site search action uses when the caller doesn't pick one. */
const DEFAULT_SEARCH_QUERY_NAME = "search_term_string";

/**
 * Shapes of the schema.org nodes this package emits and of the inputs its builders
 * accept. Node types spell `@context` and `@type` as literals, so a typo is a compile
 * error instead of structured data a search engine silently ignores.
 */
export namespace SchemaOrg {
	/** The JSON-LD context literal shared by every top-level node. */
	export type Context = typeof SCHEMA_CONTEXT;

	/** Any top-level node a builder returns, which is what may be serialized into a script. */
	export type Node =
		| Organization
		| WebSite
		| WebPage
		| Article
		| BreadcrumbList
		| FAQPage
		| SoftwareApplication
		| Book;

	/** A date accepted by a builder, normalized to an ISO 8601 string on output. */
	export type DateInput = Date | string;

	/**
	 * The `BookFormatType` enumeration, spelled as the full schema.org URLs Google's
	 * documentation uses, so a format can only be one of the values the vocabulary
	 * defines instead of a free string a validator would reject.
	 */
	export type BookFormat =
		| "https://schema.org/EBook"
		| "https://schema.org/Paperback"
		| "https://schema.org/Hardcover"
		| "https://schema.org/AudiobookFormat"
		| "https://schema.org/GraphicNovel";

	/** The publisher or company behind the site. */
	export interface Organization {
		"@context": Context;
		"@type": "Organization";
		name: string;
		url: string;
		logo?: string;
		description?: string;
		sameAs?: string[];
	}

	/** The site as a whole, for the one page whose subject is the site itself. */
	export interface WebSite {
		"@context": Context;
		"@type": "WebSite";
		name: string;
		url: string;
		description: string;
		potentialAction?: SearchAction;
	}

	/** A single page, for pages with no more specific type. */
	export interface WebPage {
		"@context": Context;
		"@type": "WebPage";
		name: string;
		description: string;
		url: string;
		inLanguage?: string;
		datePublished?: string;
		dateModified?: string;
		primaryImageOfPage?: ImageObject;
	}

	/** A dated, authored piece of writing such as a blog post. */
	export interface Article {
		"@context": Context;
		"@type": "Article";
		headline: string;
		datePublished: string;
		author: Byline;
		dateModified?: string;
		description?: string;
		url?: string;
		image?: string[];
		publisher?: Publisher;
		articleSection?: string;
		keywords?: string[];
		inLanguage?: string;
	}

	/** The trail of ancestors leading to the current page. */
	export interface BreadcrumbList {
		"@context": Context;
		"@type": "BreadcrumbList";
		itemListElement: ListItem[];
	}

	/** A page carrying a real question-and-answer section. */
	export interface FAQPage {
		"@context": Context;
		"@type": "FAQPage";
		mainEntity: Question[];
	}

	/** A product or capability page whose subject is the software itself. */
	export interface SoftwareApplication {
		"@context": Context;
		"@type": "SoftwareApplication";
		name: string;
		applicationCategory: string;
		description?: string;
		operatingSystem?: string;
		url?: string;
		offers?: Offer;
		featureList?: string[];
	}

	/** A book being sold, for the page whose subject is the book itself. */
	export interface Book {
		"@context": Context;
		"@type": "Book";
		name: string;
		author: Byline;
		description?: string;
		url?: string;
		image?: string[];
		bookFormat?: BookFormat;
		inLanguage?: string;
		numberOfPages?: number;
		isbn?: string;
		datePublished?: string;
		publisher?: Publisher;
		/** Every package the book is sold as, so two prices need no second node. */
		offers?: Offer[];
	}

	/** One position in a {@link BreadcrumbList}, numbered from 1. */
	export interface ListItem {
		"@type": "ListItem";
		position: number;
		name: string;
		item: string;
	}

	/** One entry of a {@link FAQPage}, pairing a question with its single accepted answer. */
	export interface Question {
		"@type": "Question";
		name: string;
		acceptedAnswer: Answer;
	}

	/** The accepted answer of a {@link Question}, as plain text. */
	export interface Answer {
		"@type": "Answer";
		text: string;
	}

	/** The byline of an {@link Article} or a {@link Book}: a person, or the organization itself. */
	export interface Byline {
		"@type": "Person" | "Organization";
		name: string;
		url?: string;
	}

	/** The organization that published an {@link Article} or a {@link Book}. */
	export interface Publisher {
		"@type": "Organization";
		name: string;
		logo?: ImageObject;
	}

	/** An image referenced by another node, always as an absolute URL. */
	export interface ImageObject {
		"@type": "ImageObject";
		url: string;
		width?: number;
		height?: number;
	}

	/**
	 * What a {@link SoftwareApplication} or one package of a {@link Book} costs, as
	 * schema.org's string-typed price.
	 */
	export interface Offer {
		"@type": "Offer";
		price: string;
		priceCurrency: string;
		description?: string;
		url?: string;
	}

	/** A site search entry point, letting a search engine offer a search box for the site. */
	export interface SearchAction {
		"@type": "SearchAction";
		target: EntryPoint;
		"query-input": string;
	}

	/** The URL template a {@link SearchAction} substitutes the query term into. */
	export interface EntryPoint {
		"@type": "EntryPoint";
		urlTemplate: string;
	}

	/** Input for the organization builder. `url` defaults to the configured base URL. */
	export interface OrganizationInput {
		name: string;
		url?: string;
		/** Logo path or URL, resolved absolute. */
		logo?: string;
		description?: string;
		/** Profile URLs proving the same entity elsewhere, used verbatim. */
		sameAs?: string[];
	}

	/** Input for the website builder. Every field falls back to the configured site identity. */
	export interface WebSiteInput {
		name?: string;
		url?: string;
		description?: string;
		searchAction?: SearchActionInput;
	}

	/** Input for a site search action. */
	export interface SearchActionInput {
		/**
		 * Search URL with the query placeholder in braces, e.g.
		 * `"/search?q={search_term_string}"`. A root-relative template is prefixed with
		 * the configured origin without percent-encoding, so the braces survive.
		 */
		urlTemplate: string;
		/** Placeholder name inside the template. Defaults to `search_term_string`. */
		queryName?: string;
	}

	/** Input for the page builder. Copy is passed in; the package never writes it. */
	export interface WebPageInput {
		name: string;
		description: string;
		url: string;
		inLanguage?: string;
		datePublished?: DateInput;
		dateModified?: DateInput;
		/** Primary image path or URL, resolved absolute. */
		image?: string;
	}

	/** Input for the article builder. */
	export interface ArticleInput {
		headline: string;
		datePublished: DateInput;
		author: AuthorInput;
		dateModified?: DateInput;
		description?: string;
		url?: string;
		/** One image or several, each resolved absolute. */
		image?: string | string[];
		publisher?: PublisherInput;
		section?: string;
		keywords?: string[];
		inLanguage?: string;
	}

	/** Input for an article's byline. */
	export interface AuthorInput {
		name: string;
		/** Profile or author page, resolved absolute. */
		url?: string;
		/** Whether the byline is a person or the organization itself. Defaults to `"Person"`. */
		kind?: Byline["@type"];
	}

	/**
	 * Input for the book builder. Only the title and its author are required: everything
	 * else is a property a bookstore page either knows or has no honest value for.
	 */
	export interface BookInput {
		name: string;
		author: AuthorInput;
		description?: string;
		/** Sales page for the book, resolved through the canonical rules. */
		url?: string;
		/** One cover image or several, each resolved absolute. */
		image?: string | string[];
		/** schema.org book format, e.g. `"https://schema.org/EBook"`. */
		bookFormat?: BookFormat;
		inLanguage?: string;
		numberOfPages?: number;
		isbn?: string;
		datePublished?: DateInput;
		publisher?: PublisherInput;
		/** One offer, or one per package the book is sold as. */
		offers?: OfferInput | OfferInput[];
	}

	/** Input for an article's publisher. */
	export interface PublisherInput {
		name: string;
		/** Logo path or URL, resolved absolute. */
		logo?: string;
	}

	/** One breadcrumb, whose position comes from its index in the list. */
	export interface BreadcrumbInput {
		name: string;
		url: string;
	}

	/** One FAQ pair, phrased the way the page itself renders it. */
	export interface QuestionInput {
		question: string;
		answer: string;
	}

	/** Input for the software application builder. */
	export interface SoftwareApplicationInput {
		name: string;
		/** schema.org application category, e.g. `"WebApplication"`. */
		applicationCategory: string;
		description?: string;
		operatingSystem?: string;
		url?: string;
		offers?: OfferInput;
		featureList?: string[];
	}

	/** Input for an application's offer. Prices are strings, as schema.org expects. */
	export interface OfferInput {
		price: string;
		priceCurrency: string;
		description?: string;
		url?: string;
	}
}

/** Site identity and origin a bound builder set resolves its defaults from. */
export interface SchemaBuilderOptions {
	/** Normalized origin every URL in a node is resolved against. */
	baseUrl: string;
	/** Site name used when a node describes the site itself. */
	siteName: string;
	/** Description used when a node describing the site is given none. */
	defaultDescription: string;
}

/** The builder set exposed as `seo.schema`, bound to one site's configuration. */
export interface SeoSchema {
	/** Builds the `Organization` node describing the publisher behind the site. */
	organization(input: SchemaOrg.OrganizationInput): SchemaOrg.Organization;
	/** Builds the `WebSite` node, for the one page whose subject is the site itself. */
	website(input?: SchemaOrg.WebSiteInput): SchemaOrg.WebSite;
	/** Builds a `WebPage` node for a page with no more specific type. */
	webPage(input: SchemaOrg.WebPageInput): SchemaOrg.WebPage;
	/** Builds an `Article` node for a dated, authored page. */
	article(input: SchemaOrg.ArticleInput): SchemaOrg.Article;
	/** Builds a `BreadcrumbList` node, numbering positions from the given order. */
	breadcrumbs(crumbs: SchemaOrg.BreadcrumbInput[]): SchemaOrg.BreadcrumbList;
	/** Builds an `FAQPage` node from question/answer pairs the page actually renders. */
	faq(questions: SchemaOrg.QuestionInput[]): SchemaOrg.FAQPage;
	/** Builds a `SoftwareApplication` node for a product or capability page. */
	softwareApplication(input: SchemaOrg.SoftwareApplicationInput): SchemaOrg.SoftwareApplication;
	/** Builds a `Book` node for the page selling one book, with an offer per package. */
	book(input: SchemaOrg.BookInput): SchemaOrg.Book;
}

/**
 * Normalizes a date input to the ISO 8601 string schema.org date properties expect,
 * passing an already-formatted string through untouched so a source that only has the
 * date part (`"2026-07-29"`) is not widened to a midnight timestamp.
 */
function toIsoDate(value: SchemaOrg.DateInput): string {
	return value instanceof Date ? value.toISOString() : value;
}

/**
 * Resolves one image, or a list of them, into the absolute-URL array search engines
 * prefer, so a node's `image` property has one shape regardless of how it was passed.
 */
function toImageList(baseUrl: string, image: string | string[]): string[] {
	let images = Array.isArray(image) ? image : [image];
	return images.map((url) => absoluteUrl(baseUrl, url));
}

/** Builds an image node from a path or URL, resolved absolute. */
function buildImage(baseUrl: string, image: string): SchemaOrg.ImageObject {
	return { "@type": "ImageObject", url: absoluteUrl(baseUrl, image) };
}

/**
 * Builds an article byline, defaulting to `Person` since a named author is the common
 * case and an organizational byline is the one that has to be asked for.
 */
function buildByline(baseUrl: string, input: SchemaOrg.AuthorInput): SchemaOrg.Byline {
	return {
		"@type": input.kind ?? "Person",
		name: input.name,
		...(input.url && { url: absoluteUrl(baseUrl, input.url) }),
	};
}

/**
 * Builds a search action, prefixing a root-relative template by string concatenation
 * rather than through `URL`, which would percent-encode the `{}` around the query
 * placeholder and leave the template unusable.
 */
function buildSearchAction(
	baseUrl: string,
	input: SchemaOrg.SearchActionInput,
): SchemaOrg.SearchAction {
	let urlTemplate = input.urlTemplate.startsWith("/")
		? `${baseUrl}${input.urlTemplate}`
		: input.urlTemplate;

	return {
		"@type": "SearchAction",
		target: { "@type": "EntryPoint", urlTemplate },
		"query-input": `required name=${input.queryName ?? DEFAULT_SEARCH_QUERY_NAME}`,
	};
}

/** Builds an article's publisher node, resolving its logo to an absolute image URL. */
function buildPublisher(baseUrl: string, input: SchemaOrg.PublisherInput): SchemaOrg.Publisher {
	return {
		"@type": "Organization",
		name: input.name,
		...(input.logo && { logo: buildImage(baseUrl, input.logo) }),
	};
}

/** Builds an application's offer node, resolving an offer URL against the configured origin. */
function buildOffer(baseUrl: string, input: SchemaOrg.OfferInput): SchemaOrg.Offer {
	return {
		"@type": "Offer",
		price: input.price,
		priceCurrency: input.priceCurrency,
		...(input.description && { description: input.description }),
		...(input.url && { url: canonicalUrl(baseUrl, input.url) }),
	};
}

/**
 * Resolves one offer, or a list of them, into the array a node uses when the same thing
 * is sold as more than one package, so `offers` has one shape however it was passed.
 */
function toOfferList(baseUrl: string, offers: SchemaOrg.OfferInput | SchemaOrg.OfferInput[]) {
	let list = Array.isArray(offers) ? offers : [offers];
	return list.map((offer) => buildOffer(baseUrl, offer));
}

/**
 * Creates the schema.org builders bound to one site's origin and identity.
 * Every URL agrees with the canonical link, and optional properties are
 * omitted rather than `null`, which search engines treat as broken.
 *
 * @param options - Origin and site identity the builders resolve defaults from.
 * @returns Builders producing one typed node each.
 * @example createSchemaBuilders({ baseUrl: "https://example.com", siteName: "Example", defaultDescription: "..." }).website()
 */
export function createSchemaBuilders(options: SchemaBuilderOptions): SeoSchema {
	let { baseUrl, siteName, defaultDescription } = options;

	return {
		organization(input) {
			return {
				"@context": SCHEMA_CONTEXT,
				"@type": "Organization",
				name: input.name,
				url: input.url ? canonicalUrl(baseUrl, input.url) : baseUrl,
				...(input.logo && { logo: absoluteUrl(baseUrl, input.logo) }),
				...(input.description && { description: input.description }),
				...(input.sameAs && { sameAs: input.sameAs }),
			};
		},

		website(input = {}) {
			return {
				"@context": SCHEMA_CONTEXT,
				"@type": "WebSite",
				name: input.name ?? siteName,
				url: input.url ? canonicalUrl(baseUrl, input.url) : baseUrl,
				description: input.description ?? defaultDescription,
				...(input.searchAction && {
					potentialAction: buildSearchAction(baseUrl, input.searchAction),
				}),
			};
		},

		webPage(input) {
			return {
				"@context": SCHEMA_CONTEXT,
				"@type": "WebPage",
				name: input.name,
				description: input.description,
				url: canonicalUrl(baseUrl, input.url),
				...(input.inLanguage && { inLanguage: input.inLanguage }),
				...(input.datePublished && { datePublished: toIsoDate(input.datePublished) }),
				...(input.dateModified && { dateModified: toIsoDate(input.dateModified) }),
				...(input.image && { primaryImageOfPage: buildImage(baseUrl, input.image) }),
			};
		},

		article(input) {
			return {
				"@context": SCHEMA_CONTEXT,
				"@type": "Article",
				headline: input.headline,
				datePublished: toIsoDate(input.datePublished),
				author: buildByline(baseUrl, input.author),
				...(input.dateModified && { dateModified: toIsoDate(input.dateModified) }),
				...(input.description && { description: input.description }),
				...(input.url && { url: canonicalUrl(baseUrl, input.url) }),
				...(input.image && { image: toImageList(baseUrl, input.image) }),
				...(input.publisher && { publisher: buildPublisher(baseUrl, input.publisher) }),
				...(input.section && { articleSection: input.section }),
				...(input.keywords && { keywords: input.keywords }),
				...(input.inLanguage && { inLanguage: input.inLanguage }),
			};
		},

		breadcrumbs(crumbs) {
			return {
				"@context": SCHEMA_CONTEXT,
				"@type": "BreadcrumbList",
				itemListElement: crumbs.map((crumb, index) => ({
					"@type": "ListItem",
					position: index + 1,
					name: crumb.name,
					item: canonicalUrl(baseUrl, crumb.url),
				})),
			};
		},

		faq(questions) {
			return {
				"@context": SCHEMA_CONTEXT,
				"@type": "FAQPage",
				mainEntity: questions.map((entry) => ({
					"@type": "Question",
					name: entry.question,
					acceptedAnswer: { "@type": "Answer", text: entry.answer },
				})),
			};
		},

		softwareApplication(input) {
			return {
				"@context": SCHEMA_CONTEXT,
				"@type": "SoftwareApplication",
				name: input.name,
				applicationCategory: input.applicationCategory,
				...(input.description && { description: input.description }),
				...(input.operatingSystem && { operatingSystem: input.operatingSystem }),
				...(input.url && { url: canonicalUrl(baseUrl, input.url) }),
				...(input.offers && { offers: buildOffer(baseUrl, input.offers) }),
				...(input.featureList && { featureList: input.featureList }),
			};
		},

		book(input) {
			return {
				"@context": SCHEMA_CONTEXT,
				"@type": "Book",
				name: input.name,
				author: buildByline(baseUrl, input.author),
				...(input.description && { description: input.description }),
				...(input.url && { url: canonicalUrl(baseUrl, input.url) }),
				...(input.image && { image: toImageList(baseUrl, input.image) }),
				...(input.bookFormat && { bookFormat: input.bookFormat }),
				...(input.inLanguage && { inLanguage: input.inLanguage }),
				...(input.numberOfPages !== undefined && { numberOfPages: input.numberOfPages }),
				...(input.isbn && { isbn: input.isbn }),
				...(input.datePublished && { datePublished: toIsoDate(input.datePublished) }),
				...(input.publisher && { publisher: buildPublisher(baseUrl, input.publisher) }),
				...(input.offers && { offers: toOfferList(baseUrl, input.offers) }),
			};
		},
	};
}
