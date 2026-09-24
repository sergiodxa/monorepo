/**
 * SCIM 2.0 resources and protocol messages: the RFC 7643 User and Group types with typed
 * extensions, resource metadata and versions, list queries, `ListResponse`, projection, and
 * the RFC 7644 error document, as plain functions over plain data and `Response` objects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Filter } from "./filter.js";

/** Types for SCIM resources and protocol messages. */
export namespace Scim {
	/** One value of a multi-valued attribute, RFC 7643 §2.4. */
	export interface MultiValued<Value = string> {
		value: Value;
		display?: string;
		type?: string;
		primary?: boolean;
	}

	/** Resource metadata, RFC 7643 §3.1. */
	export interface Meta {
		resourceType: string;
		created: Date;
		lastModified: Date;
		/** The resource's own URI, as the `Location` header of a create also carries. */
		location: string;
		/** An entity tag, `W/"..."` when weak, as `version()` produces. */
		version?: string;
	}

	/** RFC 7643 §4.1.1 `name`. */
	export interface Name {
		formatted?: string;
		familyName?: string;
		givenName?: string;
		middleName?: string;
		honorificPrefix?: string;
		honorificSuffix?: string;
	}

	/** The Enterprise User extension, RFC 7643 §4.3. */
	export interface EnterpriseUser {
		employeeNumber?: string;
		costCenter?: string;
		organization?: string;
		division?: string;
		department?: string;
		/** `ref` is the wire `$ref`. */
		manager?: { value?: string; ref?: string; displayName?: string };
	}

	/** One of a user's groups, RFC 7643 §4.1.2; `ref` is the wire `$ref`. */
	export interface GroupMembership extends MultiValued {
		ref?: string;
	}

	/** RFC 7643 §4.1.2 `addresses` value. */
	export interface Address {
		formatted?: string;
		streetAddress?: string;
		locality?: string;
		region?: string;
		postalCode?: string;
		country?: string;
		type?: string;
		primary?: boolean;
	}

	/**
	 * A User, RFC 7643 §4.1, with extension data under `extensions`, keyed by the name the
	 * parser was given for each extension URN.
	 *
	 * @template Extensions - The parsed extensions, `{ enterprise?: EnterpriseUser }` by default
	 */
	export interface User<Extensions extends object = { enterprise?: EnterpriseUser }> {
		id?: string;
		externalId?: string;
		userName: string;
		name?: Name;
		displayName?: string;
		nickName?: string;
		profileUrl?: string;
		title?: string;
		userType?: string;
		preferredLanguage?: string;
		locale?: string;
		timezone?: string;
		active?: boolean;
		/** Accepted from a request and left out of `userResource`, as RFC 7643 returns it `never`. */
		password?: string;
		emails?: MultiValued[];
		phoneNumbers?: MultiValued[];
		ims?: MultiValued[];
		photos?: MultiValued[];
		addresses?: Address[];
		/** Read-only: membership is managed through the Group resource. */
		groups?: GroupMembership[];
		entitlements?: MultiValued[];
		roles?: MultiValued[];
		x509Certificates?: MultiValued[];
		extensions: Extensions;
		meta?: Meta;
	}

	/** One Group member; `ref` is the wire `$ref`. */
	export interface Member {
		value: string;
		ref?: string;
		display?: string;
		type?: "User" | "Group";
	}

	/** A Group, RFC 7643 §4.2. */
	export interface Group {
		id?: string;
		externalId?: string;
		displayName: string;
		members?: Member[];
		meta?: Meta;
	}

	/** A list request's parameters, RFC 7644 §3.4.2, with the RFC's defaults and clamping applied. */
	export interface ListQuery {
		filter: Filter.Expression | null;
		/** One-based, at least 1. */
		startIndex: number;
		/** From 0 through the configured `maxCount`. */
		count: number;
		sortBy: Filter.AttributePath | null;
		sortOrder: "ascending" | "descending";
		attributes: Filter.AttributePath[];
		excludedAttributes: Filter.AttributePath[];
	}

	/** One page of results for `listResponse`. */
	export interface Page<Resource> {
		resources: Resource[];
		/** Matches across every page, not the length of this one. */
		totalResults: number;
		startIndex: number;
	}

	/** RFC 7644 §3.12 Table 9's `scimType` values. */
	export type ErrorType =
		| "invalidFilter"
		| "tooMany"
		| "uniqueness"
		| "mutability"
		| "invalidSyntax"
		| "invalidPath"
		| "noTarget"
		| "invalidValue"
		| "invalidVers"
		| "sensitive";
}

export type { ScimErrorOptions } from "./lib/error.js";
export type { ListQueryOptions } from "./lib/list-query.js";
export type {
	ExtensionSchemas,
	InferExtensions,
	ParseUserOptions,
	ResourceOptions,
} from "./lib/resource.js";

export {
	ENTERPRISE_USER_SCHEMA,
	ERROR_SCHEMA,
	GROUP_SCHEMA,
	LIST_RESPONSE_SCHEMA,
	MEDIA_TYPE,
	PATCH_OP_SCHEMA,
	SEARCH_REQUEST_SCHEMA,
	USER_SCHEMA,
} from "./lib/constants.js";
export { ScimError } from "./lib/error.js";
export { parseListQuery, parseSearchRequest, readBody } from "./lib/list-query.js";
export { project } from "./lib/project.js";
export { groupResource, parseGroup, parseUser, userResource } from "./lib/resource.js";
export { errorResponse, listResponse, scimResponse } from "./lib/response.js";
export { matchesVersion, version } from "./lib/version.js";
