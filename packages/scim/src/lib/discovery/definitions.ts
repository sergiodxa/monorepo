/**
 * The RFC 7643 §8.7 attribute definitions for User, Group and Enterprise User, plus the
 * common attributes (`id`, `externalId`, `meta`, `schemas`) every resource carries. Filters,
 * PATCH and projection read these to learn an attribute's type, `caseExact` and mutability.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Discovery } from "../../discovery.js";

import { ENTERPRISE_USER_SCHEMA, GROUP_SCHEMA, USER_SCHEMA } from "../constants.js";

/**
 * An attribute definition with RFC 7643 §2.2's defaults filled in: a single-valued,
 * optional, case-insensitive, read-write string returned by default and unique nowhere.
 *
 * @param name - The attribute name
 * @param overrides - Characteristics that differ from the defaults
 * @returns The complete definition
 */
function attribute(
	name: string,
	overrides: Partial<Discovery.Attribute> = {},
): Discovery.Attribute {
	return {
		name,
		type: "string",
		multiValued: false,
		required: false,
		caseExact: false,
		mutability: "readWrite",
		returned: "default",
		uniqueness: "none",
		...overrides,
	};
}

/**
 * The `value`/`display`/`type`/`primary` quartet RFC 7643 §2.4 gives every multi-valued
 * attribute, with the `type` canonical values the RFC lists for that attribute.
 *
 * @param name - The attribute name
 * @param description - What the attribute holds
 * @param canonicalValues - The canonical `type` values
 * @param value - Overrides for the `value` sub-attribute
 * @returns The multi-valued complex attribute
 */
function multiValued(
	name: string,
	description: string,
	canonicalValues: string[] | null,
	value: Partial<Discovery.Attribute> = {},
): Discovery.Attribute {
	return attribute(name, {
		type: "complex",
		multiValued: true,
		description,
		subAttributes: [
			attribute("value", value),
			attribute("display"),
			attribute("type", canonicalValues ? { canonicalValues } : {}),
			attribute("primary", { type: "boolean" }),
		],
	});
}

/** The User resource's attributes, RFC 7643 §8.7.1, in the order the RFC lists them. */
export const USER_DEFINITION: Discovery.SchemaDefinition = {
	id: USER_SCHEMA,
	name: "User",
	description: "User Account",
	attributes: [
		attribute("userName", {
			required: true,
			uniqueness: "server",
			description: "The identifier the user signs in with, unique across the service provider.",
		}),
		attribute("name", {
			type: "complex",
			description: "The components of the user's real name.",
			subAttributes: [
				attribute("formatted"),
				attribute("familyName"),
				attribute("givenName"),
				attribute("middleName"),
				attribute("honorificPrefix"),
				attribute("honorificSuffix"),
			],
		}),
		attribute("displayName", { description: "The name to show for the user." }),
		attribute("nickName", { description: "The casual name to address the user by." }),
		attribute("profileUrl", {
			type: "reference",
			referenceTypes: ["external"],
			description: "The user's online profile.",
		}),
		attribute("title", { description: "The user's title, such as Vice President." }),
		attribute("userType", {
			description: "The relationship to the organization, such as Employee.",
		}),
		attribute("preferredLanguage", {
			description: "The user's preferred language, as a language tag.",
		}),
		attribute("locale", { description: "The user's default location for formatting values." }),
		attribute("timezone", { description: "The user's IANA time zone." }),
		attribute("active", { type: "boolean", description: "Whether the user may use the service." }),
		attribute("password", {
			mutability: "writeOnly",
			returned: "never",
			description: "The user's cleartext password, accepted on write and never returned.",
		}),
		multiValued("emails", "Email addresses for the user.", ["work", "home", "other"]),
		multiValued("phoneNumbers", "Phone numbers for the user.", [
			"work",
			"home",
			"mobile",
			"fax",
			"pager",
			"other",
		]),
		multiValued("ims", "Instant messaging addresses for the user.", [
			"aim",
			"gtalk",
			"icq",
			"xmpp",
			"msn",
			"skype",
			"qq",
			"yahoo",
		]),
		multiValued("photos", "URLs of images of the user.", ["photo", "thumbnail"], {
			type: "reference",
			referenceTypes: ["external"],
		}),
		attribute("addresses", {
			type: "complex",
			multiValued: true,
			description: "Physical mailing addresses for the user.",
			subAttributes: [
				attribute("formatted"),
				attribute("streetAddress"),
				attribute("locality"),
				attribute("region"),
				attribute("postalCode"),
				attribute("country"),
				attribute("type", { canonicalValues: ["work", "home", "other"] }),
				attribute("primary", { type: "boolean" }),
			],
		}),
		attribute("groups", {
			type: "complex",
			multiValued: true,
			mutability: "readOnly",
			description: "The groups the user belongs to, maintained through the Group resource.",
			subAttributes: [
				attribute("value", { mutability: "readOnly" }),
				attribute("$ref", {
					type: "reference",
					referenceTypes: ["User", "Group"],
					mutability: "readOnly",
				}),
				attribute("display", { mutability: "readOnly" }),
				attribute("type", { mutability: "readOnly", canonicalValues: ["direct", "indirect"] }),
			],
		}),
		multiValued("entitlements", "Entitlements the user holds.", null),
		multiValued("roles", "Roles the user holds.", null),
		multiValued("x509Certificates", "Certificates issued to the user.", null, {
			type: "binary",
			caseExact: true,
		}),
	],
};

/** The Group resource's attributes, RFC 7643 §8.7.1; `displayName` is required per §4.2. */
export const GROUP_DEFINITION: Discovery.SchemaDefinition = {
	id: GROUP_SCHEMA,
	name: "Group",
	description: "Group",
	attributes: [
		attribute("displayName", { required: true, description: "The name to show for the group." }),
		attribute("members", {
			type: "complex",
			multiValued: true,
			description: "The users and groups that belong to the group.",
			subAttributes: [
				attribute("value", { mutability: "immutable" }),
				attribute("$ref", {
					type: "reference",
					referenceTypes: ["User", "Group"],
					mutability: "immutable",
				}),
				attribute("display", { mutability: "readOnly" }),
				attribute("type", { mutability: "immutable", canonicalValues: ["User", "Group"] }),
			],
		}),
	],
};

/** The Enterprise User extension's attributes, RFC 7643 §8.7.1. */
export const ENTERPRISE_USER_DEFINITION: Discovery.SchemaDefinition = {
	id: ENTERPRISE_USER_SCHEMA,
	name: "EnterpriseUser",
	description: "Enterprise User",
	attributes: [
		attribute("employeeNumber", { description: "The organization's identifier for the user." }),
		attribute("costCenter", { description: "The cost center the user is charged to." }),
		attribute("organization", { description: "The organization the user belongs to." }),
		attribute("division", { description: "The division the user belongs to." }),
		attribute("department", { description: "The department the user belongs to." }),
		attribute("manager", {
			type: "complex",
			description: "The user's manager.",
			subAttributes: [
				attribute("value", { description: "The manager's resource id." }),
				attribute("$ref", { type: "reference", referenceTypes: ["User"] }),
				attribute("displayName", { mutability: "readOnly" }),
			],
		}),
	],
};

/**
 * The attributes RFC 7643 §3 gives every resource. Paths resolve against them after the
 * served definitions, so `id`, `meta.lastModified` and `schemas` filter and project even
 * though the `/Schemas` documents leave them out.
 */
export const COMMON_ATTRIBUTES: Discovery.Attribute[] = [
	attribute("id", {
		caseExact: true,
		mutability: "readOnly",
		returned: "always",
		uniqueness: "server",
	}),
	attribute("externalId", { caseExact: true }),
	attribute("schemas", {
		type: "reference",
		multiValued: true,
		mutability: "readOnly",
		returned: "always",
	}),
	attribute("meta", {
		type: "complex",
		mutability: "readOnly",
		subAttributes: [
			attribute("resourceType", { caseExact: true, mutability: "readOnly" }),
			attribute("created", { type: "dateTime", mutability: "readOnly" }),
			attribute("lastModified", { type: "dateTime", mutability: "readOnly" }),
			attribute("location", { type: "reference", caseExact: true, mutability: "readOnly" }),
			attribute("version", { caseExact: true, mutability: "readOnly" }),
		],
	}),
];
