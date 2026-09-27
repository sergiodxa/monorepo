/**
 * The team status operation of the API document: one call rolling every HTTP monitor's
 * latest check into an overall state, so a dashboard or a chat bot reads the team's
 * health without walking each monitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import { defineOperation } from "@sdxc/openapi";

import { envelope } from "~/app/http/openapi/envelope";
import { epochMs, resourceId } from "~/app/http/openapi/fields";
import routes from "~/routes/web";

/** One monitor's state, from its latest completed check. */
const MONITOR_STATUS = s
	.object({
		id: resourceId("mon"),
		name: s.string(),
		status: s.enum_(["up", "down", "unknown"]).meta({
			description: "`unknown` until a completed check carries a status code",
		}),
		enabled: s.boolean(),
		lastCheck: s.nullable(epochMs()),
		responseTimeMs: s.nullable(s.integer()),
	})
	.meta({ id: "MonitorStatus" });

/** The team's overall state; the summary counts cover enabled monitors only. */
const TEAM_STATUS = s
	.object({
		overall: s.enum_(["operational", "partial_outage", "major_outage", "unknown"]).meta({
			description: "`unknown` when the team has no enabled monitor",
		}),
		monitors: s.array(MONITOR_STATUS),
		summary: s.object({
			total: s.integer(),
			up: s.integer(),
			down: s.integer(),
			degraded: s.integer(),
			unknown: s.integer(),
		}),
	})
	.meta({ id: "TeamStatus" });

const STATUS_SHOW = defineOperation("statusShow", routes.api.v1.status, {
	summary: "Show the team's overall status",
	tags: ["Status"],
	responses: {
		200: { description: "The team's status", body: envelope({ status: TEAM_STATUS }) },
	},
	problems: ["unauthorized", "forbidden"],
	security: [{ apiKey: ["monitors:read"] }],
});

/** Every operation in this module, in the order the reference lists them. */
export const OPERATIONS = [STATUS_SHOW];
