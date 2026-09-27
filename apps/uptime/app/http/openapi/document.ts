/**
 * The uptime API's OpenAPI 3.1 document, assembled from the operation modules beside it.
 * Those modules hold only schemas, so building the document loads no controller, and
 * `/api/v1/openapi.json`, the reference pages and the conformance tests all read it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createDocument } from "@sdxc/openapi";
import { bearer } from "@sdxc/openapi/security";

import { OPERATIONS as ALERTS } from "~/app/http/openapi/alerts";
import { OPERATIONS as API_KEYS } from "~/app/http/openapi/api-keys";
import { OPERATIONS as CRON_JOBS } from "~/app/http/openapi/cron-jobs";
import { OPERATIONS as DNS_MONITORS } from "~/app/http/openapi/dns-monitors";
import { OPERATIONS as FLOW_MONITORS } from "~/app/http/openapi/flow-monitors";
import { OPERATIONS as MAINTENANCE } from "~/app/http/openapi/maintenance";
import { OPERATIONS as MONITORS } from "~/app/http/openapi/monitors";
import { OPERATIONS as PING } from "~/app/http/openapi/ping";
import { OPERATIONS as STATUS } from "~/app/http/openapi/status";
import { OPERATIONS as STATUS_PAGES } from "~/app/http/openapi/status-pages";
import { OPERATIONS as TCP_MONITORS } from "~/app/http/openapi/tcp-monitors";
import { OPERATIONS as TEAM } from "~/app/http/openapi/team";
import { apiProblems } from "~/app/services/api-problems";

/**
 * Starts the document builder. It assembles nothing until `build()`, so a caller at module
 * scope costs no work until the first request that reads it.
 */
export function buildApiDocument() {
	return createDocument({
		info: {
			title: "Uptime API",
			version: "1",
			description: "Monitor websites, APIs, DNS, TCP services, cron jobs and user flows.",
		},
		servers: [{ url: "https://uptime.sergiodxa.com" }],
		securitySchemes: {
			apiKey: bearer({
				description:
					"An API key from the team settings page, sent as a bearer token. Refusals carry a WWW-Authenticate challenge pointing at /.well-known/oauth-protected-resource/api/v1.",
			}),
		},
		problems: apiProblems,
	}).add(
		...STATUS,
		...MONITORS,
		...DNS_MONITORS,
		...TCP_MONITORS,
		...FLOW_MONITORS,
		...CRON_JOBS,
		...ALERTS,
		...MAINTENANCE,
		...STATUS_PAGES,
		...TEAM,
		...API_KEYS,
		...PING,
	);
}
