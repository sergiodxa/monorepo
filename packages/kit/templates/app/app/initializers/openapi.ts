/**
 * The API's OpenAPI document. Add each operation `routes/api.ts` declares, so
 * `/api/openapi.json` lists every documented endpoint.
 */

import { createDocument } from "@sdxc/openapi";

import { HEALTH } from "~/routes/api";

/**
 * Starts the document for the origin the API is served from, which OpenAPI requires as an
 * absolute server URL; `build()` assembles it, failing on a contract it cannot express.
 */
export function createApiDocument(origin: string) {
	return createDocument({
		info: { title: "App API", version: "1.0.0" },
		servers: [{ url: origin }],
	}).add(HEALTH);
}
