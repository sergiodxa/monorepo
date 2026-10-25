/**
 * The SCIM discovery surface: attribute definitions for User, Group and Enterprise User, and
 * the `ServiceProviderConfig`, `ResourceTypes` and `Schemas` documents. The same definitions
 * drive filtering, PATCH and projection, so what `/Schemas` advertises is what gets evaluated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Types for attribute definitions and the discovery documents built from them. */
export namespace Discovery {
	/** One attribute's characteristics, RFC 7643 §2.2 and §7. */
	export interface Attribute {
		name: string;
		type:
			| "string"
			| "boolean"
			| "decimal"
			| "integer"
			| "dateTime"
			| "reference"
			| "binary"
			| "complex";
		multiValued: boolean;
		required: boolean;
		/** Whether string comparisons respect case; `false` makes filter `eq` fold case. */
		caseExact: boolean;
		mutability: "readOnly" | "readWrite" | "immutable" | "writeOnly";
		/** When projection writes the attribute: `always`, only on `request`, by `default`, or `never`. */
		returned: "always" | "never" | "default" | "request";
		uniqueness: "none" | "server" | "global";
		description?: string;
		subAttributes?: Attribute[];
		canonicalValues?: string[];
		referenceTypes?: string[];
	}

	/** One schema's attributes, as a `/Schemas` entry lists them. */
	export interface SchemaDefinition {
		/** The schema URN. */
		id: string;
		name: string;
		description?: string;
		attributes: Attribute[];
	}

	/**
	 * Every definition an endpoint serves, by URN, core schema first: an attribute written
	 * without a URN resolves against the definitions in insertion order.
	 */
	export interface Definitions {
		[urn: string]: SchemaDefinition;
	}

	/** One entry of `authenticationSchemes`, RFC 7643 §5. */
	export interface AuthenticationScheme {
		/** `oauthbearertoken`, `httpbasic` and the like. */
		type: string;
		name: string;
		description: string;
		specUri?: string;
		documentationUri?: string;
		primary?: boolean;
	}

	/** RFC 9865 §4's `pagination` capability. */
	export interface Pagination {
		cursor: boolean;
		index: boolean;
		/** How a request naming neither `startIndex` nor `cursor` pages. */
		defaultPaginationMethod?: "cursor" | "index";
		defaultPageSize?: number;
		maxPageSize?: number;
		/** The minimum seconds a cursor stays valid between page requests. */
		cursorTimeout?: number;
	}

	/** RFC 9967 §4's `securityEvents` capability. */
	export interface SecurityEvents {
		/** `none`, `long` when the server goes asynchronous at its discretion, `request` on `Prefer: respond-async`. */
		asyncRequest: "none" | "long" | "request";
		/** The event URIs the server can deliver over a SET stream; informational. */
		eventUris: string[];
	}

	/** What `serviceProviderConfig` advertises. */
	export interface ServiceProviderConfigOptions {
		patch: boolean;
		/** `maxResults` should be the same ceiling `parseListQuery` clamps `count` to. */
		filter: { supported: boolean; maxResults: number };
		sort: boolean;
		etag: boolean;
		changePassword?: boolean;
		/** Present only when the app serves `/Bulk`. */
		bulk?: { maxOperations: number; maxPayloadSize: number };
		authenticationSchemes: AuthenticationScheme[];
		documentationUri?: string;
		/** Present only when given; `maxPageSize` should match `filter.maxResults`. */
		pagination?: Pagination;
		/** Present only when given; its absence tells clients events are unsupported. */
		securityEvents?: SecurityEvents;
	}

	/** One resource endpoint `resourceTypes` lists. */
	export interface ResourceType {
		/** Also the entry's `name`, such as `User`. */
		id: string;
		/** Relative to the SCIM base URL, such as `/Users`. */
		endpoint: string;
		/** The core schema URN. */
		schema: string;
		extensions?: { schema: string; required: boolean }[];
	}
}

export {
	ENTERPRISE_USER_DEFINITION,
	GROUP_DEFINITION,
	USER_DEFINITION,
} from "./lib/discovery/definitions.js";
export {
	pickAttributes,
	resourceTypes,
	schemas,
	serviceProviderConfig,
} from "./lib/discovery/documents.js";
