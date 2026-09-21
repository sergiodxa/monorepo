/**
 * `/scim/v2/ServiceProviderConfig`, `/scim/v2/ResourceTypes` and
 * `/scim/v2/Schemas` — static capability documents rendered straight from the
 * Worker, with no call to the tenant object: a client's capability
 * negotiation reads these before it ever presents a token, so they describe
 * exactly the subset this implementation serves rather than what a future
 * pass might add.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import {
	ENTERPRISE_USER_SCHEMA,
	GROUP_SCHEMA,
	USER_SCHEMA,
	scimJson,
} from "~/app/http/scim/response";
import routes from "~/routes/tenant";

/** The largest page `scim.ts` ever answers, regardless of what a caller asks for — the same ceiling `filter.maxResults` advertises. */
const MAX_PAGE_SIZE = 200;

/** `GET /scim/v2/ServiceProviderConfig` — what this connection supports, and nothing it does not. */
export const scimServiceProviderConfig = createAction(
	routes.scimServiceProviderConfig,
	async () => {
		return scimJson(
			{
				schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
				patch: { supported: true },
				bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
				filter: { supported: true, maxResults: MAX_PAGE_SIZE },
				changePassword: { supported: false },
				sort: { supported: false },
				etag: { supported: false },
				authenticationSchemes: [
					{
						type: "oauthbearertoken",
						name: "Bearer Token",
						description: "A per-connection bearer token presented in the Authorization header.",
						specUri: "https://www.rfc-editor.org/rfc/rfc6750",
					},
				],
			},
			200,
		);
	},
);

/** `GET /scim/v2/ResourceTypes` — the two resources this connection serves. */
export const scimResourceTypes = createAction(routes.scimResourceTypes, async () => {
	let resources = [
		{
			schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
			id: "User",
			name: "User",
			endpoint: "/Users",
			schema: USER_SCHEMA,
			schemaExtensions: [{ schema: ENTERPRISE_USER_SCHEMA, required: false }],
		},
		{
			schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
			id: "Group",
			name: "Group",
			endpoint: "/Groups",
			schema: GROUP_SCHEMA,
		},
	];

	return scimJson(
		{
			schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
			totalResults: resources.length,
			startIndex: 1,
			itemsPerPage: resources.length,
			Resources: resources,
		},
		200,
	);
});

/** A read-only, single-valued string attribute — the shape most of what this connection maps comes in. */
function stringAttribute(name: string, description: string, required = false) {
	return {
		name,
		type: "string",
		multiValued: false,
		description,
		required,
		caseExact: false,
		mutability: "readWrite",
		returned: "default",
		uniqueness: "none",
	};
}

/** `GET /scim/v2/Schemas` — the attributes this connection reads and writes on a User and a Group, nothing this pass leaves unmapped. */
export const scimSchemas = createAction(routes.scimSchemas, async () => {
	let resources = [
		{
			id: USER_SCHEMA,
			name: "User",
			description: "The subset of the SCIM User resource this connection maps.",
			attributes: [
				stringAttribute("userName", "The primary email identifier, or the username identifier."),
				stringAttribute("externalId", "This connection's own id for the resource."),
				{
					name: "name",
					type: "complex",
					multiValued: false,
					description: "The subject's given, family and formatted name.",
					required: false,
					mutability: "readWrite",
					returned: "default",
					subAttributes: [
						stringAttribute("givenName", "The subject's given name."),
						stringAttribute("familyName", "The subject's family name."),
						stringAttribute("formatted", "The subject's full name, formatted for display."),
					],
				},
				stringAttribute("displayName", "The subject's nickname."),
				stringAttribute("preferredLanguage", "The subject's locale."),
				stringAttribute("timezone", "The subject's zoneinfo."),
				{
					name: "emails",
					type: "complex",
					multiValued: true,
					description: "The subject's primary email, stamped verified on arrival.",
					required: false,
					mutability: "readWrite",
					returned: "default",
					subAttributes: [
						stringAttribute("value", "The email address."),
						{
							name: "primary",
							type: "boolean",
							multiValued: false,
							description: "Always true for the one email this connection maps.",
							required: false,
							mutability: "readWrite",
							returned: "default",
						},
					],
				},
				{
					name: "active",
					type: "boolean",
					multiValued: false,
					description: "Blocks the subject and revokes every session when set to false.",
					required: false,
					mutability: "readWrite",
					returned: "default",
				},
			],
		},
		{
			id: GROUP_SCHEMA,
			name: "Group",
			description: "The subset of the SCIM Group resource this connection maps.",
			attributes: [
				stringAttribute("displayName", "The group's display name.", true),
				stringAttribute("externalId", "This connection's own id for the group."),
				{
					name: "members",
					type: "complex",
					multiValued: true,
					description: "The subject ids belonging to this group.",
					required: false,
					mutability: "readWrite",
					returned: "default",
					subAttributes: [stringAttribute("value", "A member subject's id.")],
				},
			],
		},
	].map((resource) => ({ schemas: ["urn:ietf:params:scim:schemas:core:2.0:Schema"], ...resource }));

	return scimJson(
		{
			schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
			totalResults: resources.length,
			startIndex: 1,
			itemsPerPage: resources.length,
			Resources: resources,
		},
		200,
	);
});
