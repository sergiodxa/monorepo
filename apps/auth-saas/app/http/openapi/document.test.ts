/**
 * Checks the management API's OpenAPI document builds, names the client-credentials
 * flow and every scope, and is served as JSON by the route the API maps it to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parse, stringify } from "@sdxc/openapi";
import { openapiHandler } from "@sdxc/openapi/router";
import { unwrap } from "@sdxc/result";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { buildManagementDocument } from "~/app/http/openapi/document";
import { MANAGEMENT_SCOPES } from "~/app/services/management-scopes";
import routes from "~/routes/management";

const ISSUER = "https://api.example.com";

describe("the management API's OpenAPI document", () => {
	test("builds, with the client-credentials flow naming every scope", () => {
		let document = unwrap(buildManagementDocument(ISSUER).build());

		let scheme = document.components?.securitySchemes?.oauth2;
		expect(scheme).toMatchObject({
			type: "oauth2",
			flows: { clientCredentials: { tokenUrl: `${ISSUER}/oauth/token` } },
		});
		let scopes = Object.keys(
			(scheme as { flows: { clientCredentials: { scopes: object } } }).flows.clientCredentials
				.scopes,
		);
		expect(scopes.sort()).toEqual([...MANAGEMENT_SCOPES].sort());
	});

	test("matches the committed snapshot", async () => {
		let document = unwrap(buildManagementDocument(ISSUER).build());
		await expect(unwrap(stringify(document))).toMatchFileSnapshot("./openapi.snapshot.json");
	});

	test("is served at /openapi.json", async () => {
		let router = createRouter();
		router.map(
			routes.openapi,
			openapiHandler(() => buildManagementDocument(ISSUER).build()),
		);

		let response = await router.fetch(new Request(`${ISSUER}/openapi.json`));

		expect(response.status).toBe(200);
		let served = unwrap(parse(await response.text()));
		expect(served.info.title).toBe("Management API");
	});
});
