/**
 * The API's OpenAPI document. Add each operation `routes/api.ts` declares, so
 * `/api/openapi.json` lists every documented endpoint.
 */

import { createDocument } from "@sdxc/openapi";

import { SITE_URL } from "~/config/constants";
import problems from "~/config/problems";
import { HEALTH } from "~/routes/api";

/**
 * Starts the document with `SITE_URL`, the origin the app is published at, as its server, since
 * OpenAPI requires an absolute one; `build()` assembles it, failing on a contract it cannot express.
 */
export function createApiDocument() {
	return createDocument({
		info: { title: "App API", version: "1.0.0" },
		servers: [{ url: SITE_URL }],
		problems,
	}).add(HEALTH);
}
