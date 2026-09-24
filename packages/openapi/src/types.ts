/**
 * The OpenAPI 3.1 object model, as types only. Wire names are OpenAPI's own, already
 * camelCase, so a document is these objects serialized as they are; fields the
 * specification makes optional are optional here, since a parsed document may omit them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { JSONSchema } from "@sdxc/json-schema";

export namespace OpenAPI {
	/** The root object. A built document always carries every field it can derive. */
	export interface Document {
		/** `"3.1.1"` in a built document; any `3.1.x` in a parsed one. */
		openapi: string;
		info: Info;
		jsonSchemaDialect?: string;
		servers?: Server[];
		paths?: Record<string, PathItem>;
		components?: Components;
		security?: SecurityRequirement[];
		tags?: Tag[];
		externalDocs?: ExternalDocumentation;
	}

	/** What the API is and which version of it the document describes. */
	export interface Info {
		title: string;
		version: string;
		summary?: string;
		description?: string;
		termsOfService?: string;
		contact?: { name?: string; url?: string; email?: string };
		license?: { name: string; identifier?: string; url?: string };
	}

	/** An origin the API is served from; a built document writes absolute URLs only. */
	export interface Server {
		url: string;
		description?: string;
	}

	/** A group operations list by name, with the text a reference renders for it. */
	export interface Tag {
		name: string;
		description?: string;
		externalDocs?: ExternalDocumentation;
	}

	/** A link to documentation that lives outside the document. */
	export interface ExternalDocumentation {
		url: string;
		description?: string;
	}

	/** Scheme name to the scopes (or, for non-OAuth schemes, roles) an operation requires. */
	export type SecurityRequirement = Record<string, string[]>;

	/** The HTTP methods a path item can describe. */
	export type Method = "get" | "put" | "post" | "delete" | "options" | "head" | "patch" | "trace";

	/** The operations one path template answers, keyed by lowercase method. */
	export interface PathItem {
		summary?: string;
		description?: string;
		parameters?: (Parameter | Reference)[];
		get?: Operation;
		put?: Operation;
		post?: Operation;
		delete?: Operation;
		options?: Operation;
		head?: Operation;
		patch?: Operation;
		trace?: Operation;
	}

	/** One method on one path: its inputs, its responses and the security it requires. */
	export interface Operation {
		operationId?: string;
		summary?: string;
		description?: string;
		tags?: string[];
		parameters?: (Parameter | Reference)[];
		requestBody?: RequestBody | Reference;
		/** Keyed by status code, a range such as `"4XX"`, or `"default"`. */
		responses?: Record<string, Response | Reference>;
		security?: SecurityRequirement[];
		deprecated?: boolean;
	}

	/** A pointer to a reusable object under `components`. */
	export interface Reference {
		$ref: string;
		summary?: string;
		description?: string;
	}

	/** One input read from the path, query string, a header or a cookie. */
	export interface Parameter {
		name: string;
		in: "path" | "query" | "header" | "cookie";
		/** Always `true` for a path parameter. */
		required?: boolean;
		description?: string;
		deprecated?: boolean;
		schema?: JSONSchema;
	}

	/** The body an operation accepts, one schema per media type. */
	export interface RequestBody {
		description?: string;
		required?: boolean;
		content: Record<string, MediaType>;
	}

	/** The schema of a body in one media type. */
	export interface MediaType {
		schema?: JSONSchema;
		example?: unknown;
	}

	/** What one status answers with: its headers and a body per media type. */
	export interface Response {
		description: string;
		headers?: Record<string, Header | Reference>;
		content?: Record<string, MediaType>;
	}

	/** A response header and the schema of its value. */
	export interface Header {
		description?: string;
		required?: boolean;
		deprecated?: boolean;
		schema?: JSONSchema;
	}

	/** Reusable objects the rest of the document points at with `$ref`. */
	export interface Components {
		schemas?: Record<string, JSONSchema>;
		responses?: Record<string, Response>;
		parameters?: Record<string, Parameter>;
		requestBodies?: Record<string, RequestBody>;
		headers?: Record<string, Header>;
		securitySchemes?: Record<string, SecurityScheme>;
	}

	/** The ways a caller can authenticate, named in `securitySchemes`. */
	export type SecurityScheme = HttpScheme | ApiKeyScheme | OAuth2Scheme | OpenIdConnectScheme;

	/** Credentials sent in `Authorization` under an HTTP authentication scheme. */
	export interface HttpScheme {
		type: "http";
		/** An HTTP authentication scheme name, such as `bearer` or `basic`. */
		scheme: string;
		bearerFormat?: string;
		description?: string;
	}

	/** A key sent in a named header, query parameter or cookie. */
	export interface ApiKeyScheme {
		type: "apiKey";
		in: "header" | "query" | "cookie";
		name: string;
		description?: string;
	}

	/** An OAuth 2.0 access token, obtained through the listed flows. */
	export interface OAuth2Scheme {
		type: "oauth2";
		flows: OAuthFlows;
		description?: string;
	}

	/** The OAuth 2.0 grants a client can use to obtain a token. */
	export interface OAuthFlows {
		implicit?: OAuthFlow;
		password?: OAuthFlow;
		clientCredentials?: OAuthFlow;
		authorizationCode?: OAuthFlow;
	}

	/** One grant's endpoints and the scopes it can issue. */
	export interface OAuthFlow {
		authorizationUrl?: string;
		tokenUrl?: string;
		refreshUrl?: string;
		/** Scope name to a short description of what it grants. */
		scopes: Record<string, string>;
	}

	/** An OpenID Connect provider, discovered through its configuration document. */
	export interface OpenIdConnectScheme {
		type: "openIdConnect";
		openIdConnectUrl: string;
		description?: string;
	}
}
