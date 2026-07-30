/**
 * The head-of-document elements, as `remix/ui` components: one input produces the
 * title, description, canonical link, robots directives, and the Open Graph and Twitter
 * tag sets, and structured data goes out as a single escaped `application/ld+json`
 * script. It exists so every page emits the same tag set instead of hand-written pairs
 * that drift between layouts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SeoSite } from "../create-seo";
import type { SchemaOrg } from "../lib/schema";

import { serializeJsonLd } from "../lib/json-ld";

/** `og:type` for a page that isn't explicitly something else. */
const DEFAULT_OG_TYPE = "website";

/** `twitter:card` layout used unless the site configures another one. */
const DEFAULT_TWITTER_CARD = "summary_large_image";

/** Props for {@link Seo} and its parts. */
export namespace Seo {
	/** The Open Graph facts about a page that aren't already in its title or description. */
	export interface OpenGraph {
		/** `og:type`. Defaults to `"website"`. */
		type?: "website" | "article";
		/** Absolute image URL for the social card — build it with `seo.absolute()`. */
		image?: string;
		/** Alternative text for the card image, for the consumers that expose it. */
		imageAlt?: string;
		/** `og:locale`, e.g. `"en_US"`. */
		locale?: string;
	}

	/** Everything {@link Seo.Meta} needs for one page. */
	export interface MetaProps {
		/** The page title, already localized. Omitted pages emit no title tags at all. */
		title?: string;
		/** Meta description, reused for both social namespaces. Falls back to `site.description`. */
		description?: string;
		/** The page's canonical absolute URL, from `seo.canonical()`. */
		canonical: string;
		/** Site identity, from `seo.site`. Without it the site-level tags are skipped. */
		site?: SeoSite;
		/** Open Graph facts beyond the title and description. */
		og?: OpenGraph;
		/** `robots` content from `seo.robotsTag()`. Omit to leave the page indexable. */
		robots?: string;
	}

	/** Everything {@link Seo.JsonLd} needs. */
	export interface JsonLdProps {
		/** One node or several; several go into one script as an array, which is easier to audit. */
		schema: SchemaOrg.Node | SchemaOrg.Node[];
	}

	/** Everything {@link Seo} needs: the metadata input plus optional structured data. */
	export interface Props extends MetaProps {
		/** Structured data for the page. Omit on pages that describe nothing in particular. */
		schema?: SchemaOrg.Node | SchemaOrg.Node[];
	}
}

/**
 * Emits a page's title, description, canonical link, robots directives, and the Open
 * Graph and Twitter tag sets. Both social namespaces restate the title and description
 * rather than reading the tags above them, because every consumer of these cards reads
 * its own namespace and ignores the other's. Tags whose input is missing are skipped
 * entirely, so a page never advertises an empty title or description.
 *
 * @param handle Runtime handle carrying the page's metadata input.
 * @returns The render function producing the head tags.
 * @example <Seo.Meta title={title} description={description} canonical={seo.canonical(ctx.url)} site={seo.site} />
 */
function SeoMeta(handle: Handle<Seo.MetaProps>) {
	return () => {
		let { title, canonical, site, og, robots } = handle.props;
		let description = handle.props.description ?? site?.description;
		let twitter = site?.twitter;

		return (
			<>
				{title && <title>{title}</title>}
				{description && <meta name="description" content={description} />}
				<link rel="canonical" href={canonical} />
				{robots && <meta name="robots" content={robots} />}
				<meta property="og:type" content={og?.type ?? DEFAULT_OG_TYPE} />
				<meta property="og:url" content={canonical} />
				{site && <meta property="og:site_name" content={site.name} />}
				{title && <meta property="og:title" content={title} />}
				{description && <meta property="og:description" content={description} />}
				{og?.image && <meta property="og:image" content={og.image} />}
				{og?.imageAlt && <meta property="og:image:alt" content={og.imageAlt} />}
				{og?.locale && <meta property="og:locale" content={og.locale} />}
				<meta name="twitter:card" content={twitter?.card ?? DEFAULT_TWITTER_CARD} />
				{twitter?.site && <meta name="twitter:site" content={twitter.site} />}
				{twitter?.creator && <meta name="twitter:creator" content={twitter.creator} />}
				{title && <meta name="twitter:title" content={title} />}
				{description && <meta name="twitter:description" content={description} />}
				{og?.image && <meta name="twitter:image" content={og.image} />}
			</>
		);
	};
}

/**
 * Emits structured data as one `application/ld+json` script. The serialized JSON is set
 * through `innerHTML` rather than as children, since JSX escapes text nodes and would
 * turn the JSON's own quotes into entities and leave the data unparseable; the
 * serializer escapes `<` first so no string value can close the script element early.
 *
 * @param handle Runtime handle carrying the nodes to serialize.
 * @returns The render function producing the script element.
 * @example <Seo.JsonLd schema={[organization, article, breadcrumbs]} />
 */
function SeoJsonLd(handle: Handle<Seo.JsonLdProps>) {
	return () => (
		<script type="application/ld+json" innerHTML={serializeJsonLd(handle.props.schema)} />
	);
}

/**
 * Emits a page's whole head contribution at once: the {@link Seo.Meta} tag set, plus a
 * {@link Seo.JsonLd} script when the page has structured data to describe itself with.
 * Use the parts directly when a page needs only one of the two.
 *
 * @param handle Runtime handle carrying the metadata input and optional structured data.
 * @returns The render function producing the head tags and structured data.
 * @example <Seo title={title} canonical={seo.canonical(ctx.url)} site={seo.site} schema={[organization, article]} />
 */
export function Seo(handle: Handle<Seo.Props>) {
	return () => {
		let { schema, ...meta } = handle.props;

		return (
			<>
				<SeoMeta {...meta} />
				{schema && <SeoJsonLd schema={schema} />}
			</>
		);
	};
}

/**
 * The metadata tag set on its own, for a layout that emits structured data elsewhere or
 * has none.
 */
Seo.Meta = SeoMeta;

/**
 * The structured-data script on its own, for a layout whose metadata tags are emitted
 * elsewhere.
 */
Seo.JsonLd = SeoJsonLd;
