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

import { ENTERPRISE_USER_SCHEMA, GROUP_SCHEMA, scimResponse, USER_SCHEMA } from "@sdxc/scim";
import { resourceTypes, schemas, serviceProviderConfig } from "@sdxc/scim/discovery";
import { createAction } from "remix/router";

import {
	SCIM_GROUP_DEFINITIONS,
	SCIM_MAX_PAGE_SIZE,
	SCIM_USER_DEFINITIONS,
} from "~/database/scim-resources";
import routes from "~/routes/tenant";

/** `GET /scim/v2/ServiceProviderConfig` — what this connection supports, and nothing it does not. */
export const scimServiceProviderConfig = createAction(
	routes.scimServiceProviderConfig,
	async () => {
		return scimResponse(
			serviceProviderConfig({
				patch: true,
				filter: { supported: true, maxResults: SCIM_MAX_PAGE_SIZE },
				sort: false,
				etag: false,
				authenticationSchemes: [
					{
						type: "oauthbearertoken",
						name: "Bearer Token",
						description: "A per-connection bearer token presented in the Authorization header.",
						specUri: "https://www.rfc-editor.org/rfc/rfc6750",
					},
				],
			}),
		);
	},
);

/** `GET /scim/v2/ResourceTypes` — the two resources this connection serves. */
export const scimResourceTypes = createAction(routes.scimResourceTypes, async () => {
	return scimResponse(
		resourceTypes([
			{
				id: "User",
				endpoint: "/Users",
				schema: USER_SCHEMA,
				extensions: [{ schema: ENTERPRISE_USER_SCHEMA, required: false }],
			},
			{ id: "Group", endpoint: "/Groups", schema: GROUP_SCHEMA },
		]),
	);
});

/**
 * `GET /scim/v2/Schemas` — the attributes this connection maps, from the same definitions
 * its filters and PATCH evaluate against.
 */
export const scimSchemas = createAction(routes.scimSchemas, async () => {
	return scimResponse(
		schemas([...Object.values(SCIM_USER_DEFINITIONS), ...Object.values(SCIM_GROUP_DEFINITIONS)]),
	);
});
