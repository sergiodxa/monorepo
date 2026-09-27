/**
 * The SCIM surface a tenant serves: the attribute definitions `/Schemas` advertises and
 * filters and PATCH evaluate against, the resource shapes the SCIM RPC methods take and
 * answer, and their wire form. One module, so the advertised and evaluated surface agree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Scim } from "@sdxc/scim";
import type { Discovery } from "@sdxc/scim/discovery";

import {
	ENTERPRISE_USER_SCHEMA,
	groupResource,
	USER_SCHEMA,
	GROUP_SCHEMA,
	userResource,
} from "@sdxc/scim";
import {
	ENTERPRISE_USER_DEFINITION,
	GROUP_DEFINITION,
	pickAttributes,
	USER_DEFINITION,
} from "@sdxc/scim/discovery";
import * as s from "remix/data-schema";

import type { AttributeValue } from "./subjects";

/** The largest page a list answers, whatever `count` asks for; `filter.maxResults` advertises it. */
export const SCIM_MAX_PAGE_SIZE = 200;

/**
 * The User attributes this tenant maps onto subjects, with the Enterprise extension's scalar
 * members, which land in declared subject attributes. The core schema comes first, so an
 * unqualified name resolves against it before the extension.
 */
export const SCIM_USER_DEFINITIONS: Discovery.Definitions = {
	[USER_SCHEMA]: pickAttributes(USER_DEFINITION, [
		"userName",
		"name.givenName",
		"name.familyName",
		"name.formatted",
		"displayName",
		"preferredLanguage",
		"timezone",
		"active",
		"emails.value",
		"emails.primary",
		"photos.value",
		"photos.type",
	]),
	[ENTERPRISE_USER_SCHEMA]: pickAttributes(ENTERPRISE_USER_DEFINITION, [
		"employeeNumber",
		"costCenter",
		"organization",
		"division",
		"department",
	]),
};

/** The Group attributes a synced group carries: a name and its member subjects. */
export const SCIM_GROUP_DEFINITIONS: Discovery.Definitions = {
	[GROUP_SCHEMA]: pickAttributes(GROUP_DEFINITION, ["displayName", "members.value"]),
};

/** The user list's filterable paths; a filter naming any other attribute is refused. */
export const SCIM_USER_FILTER_PATHS = ["userName", "externalId", "emails.value"];

/** The group list's filterable paths; a filter naming any other attribute is refused. */
export const SCIM_GROUP_FILTER_PATHS = ["displayName", "externalId"];

/**
 * The Enterprise extension read as free-form scalar members, since each one becomes a
 * declared subject attribute of its own rather than a fixed field.
 */
export const SCIM_USER_EXTENSIONS = {
	enterprise: {
		urn: ENTERPRISE_USER_SCHEMA,
		schema: s.record(s.string(), s.union([s.string(), s.number(), s.boolean(), s.null_()])),
	},
};

/** A SCIM User as the provisioning RPC methods take it, the Enterprise members under `enterprise`. */
export type ScimUserResource = Scim.User<{ enterprise?: Record<string, AttributeValue> }>;

/** A SCIM Group as the provisioning RPC methods take it. */
export type ScimGroupResource = Scim.Group;

/** When a stored resource was created and last changed, as epoch milliseconds, for `meta`. */
interface Timestamps {
	createdAt: number;
	updatedAt: number;
}

/** A user as one provisioning call hands it back: its current resource, always carrying `id`. */
export interface ScimUserRepresentation extends ScimUserResource, Timestamps {
	id: string;
}

/** A group as one provisioning call hands it back: its current resource and whole membership. */
export interface ScimGroupRepresentation extends ScimGroupResource, Timestamps {
	id: string;
	members: Scim.Member[];
}

/**
 * The `meta` a representation answers with, `location` resolved against the request's
 * origin. `created` and `lastModified` come from the stored rows.
 *
 * @param resourceType - `User` or `Group`
 * @param representation - The stored timestamps
 * @param location - The resource's own URL
 * @returns The metadata
 */
function metaFor(resourceType: string, representation: Timestamps, location: string): Scim.Meta {
	return {
		resourceType,
		created: new Date(representation.createdAt),
		lastModified: new Date(representation.updatedAt),
		location,
	};
}

/**
 * The wire User for a representation, with `meta` when its `location` is known. PATCH
 * applies operations to this same shape, so what a client reads is what it patches.
 *
 * @param representation - The user
 * @param location - The resource's own URL, for `meta`
 * @returns The wire object
 */
export function userWire(
	representation: ScimUserRepresentation,
	location?: string,
): Record<string, unknown> {
	let { createdAt: _createdAt, updatedAt: _updatedAt, ...user } = representation;
	let meta = location ? metaFor("User", representation, location) : undefined;
	return userResource({ ...user, ...(meta ? { meta } : {}) }, { extensions: SCIM_USER_EXTENSIONS });
}

/**
 * The wire Group for a representation, with `meta` when its `location` is known.
 *
 * @param representation - The group
 * @param location - The resource's own URL, for `meta`
 * @returns The wire object
 */
export function groupWire(
	representation: ScimGroupRepresentation,
	location?: string,
): Record<string, unknown> {
	let { createdAt: _createdAt, updatedAt: _updatedAt, ...group } = representation;
	let meta = location ? metaFor("Group", representation, location) : undefined;
	return groupResource({ ...group, ...(meta ? { meta } : {}) });
}
