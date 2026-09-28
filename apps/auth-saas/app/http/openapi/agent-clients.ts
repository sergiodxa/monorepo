/**
 * The management API's operation for registering an agent client: a machine
 * credential granted only the client_credentials grant and bound, at
 * registration, to the one tenant it may reach.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import { defineOperation } from "@sdxc/openapi";

import {
	AUTH_PROBLEMS,
	IDEMPOTENCY_DESCRIPTION,
	IDEMPOTENCY_PROBLEMS,
	requires,
} from "~/app/http/openapi/shared";
import { MANAGEMENT_SCOPES } from "~/app/services/management-scopes";
import routes from "~/routes/management";

/** One of the management API's own scopes, the only vocabulary an agent client may be granted within. */
const AGENT_CLIENT_SCOPE = s.enum_(MANAGEMENT_SCOPES);

/** `POST /tenants/:tenantId/agent-clients`: registers a machine credential, answering its secret once. */
export const AGENT_CLIENTS_REGISTER = defineOperation(
	"agentClientsRegister",
	routes.agentClientsRegister,
	{
		summary: "Register an agent client",
		description: `A machine credential's secret is in the response and never readable again. ${IDEMPOTENCY_DESCRIPTION}`,
		tags: ["Agent clients"],
		params: s.object({ tenantId: s.string() }),
		body: s.object({ name: s.string(), scopes: s.array(AGENT_CLIENT_SCOPE) }),
		responses: {
			201: {
				description: "The registered client id and its one-time secret",
				body: s.object({ clientId: s.string(), secret: s.string() }),
			},
		},
		problems: [
			...AUTH_PROBLEMS,
			...IDEMPOTENCY_PROBLEMS,
			"validationFailed",
			"entitlementRequired",
		],
		security: requires("clients:write"),
	},
);

/** Every operation in this area, for the document to list. */
export const AGENT_CLIENTS_OPERATIONS = [AGENT_CLIENTS_REGISTER] as const;
