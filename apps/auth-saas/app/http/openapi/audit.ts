/**
 * The management API's operations for audit events: the schemas each route's
 * handler parses with and the OpenAPI document publishes, so the two cannot drift.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import * as coerce from "@sdxc/json-schema/coerce";
import { defineOperation } from "@sdxc/openapi";

import {
	AUTH_PROBLEMS,
	LINK_HEADER,
	PAGING_PROBLEMS,
	PAGING_QUERY,
	requires,
} from "~/app/http/openapi/shared";
import routes from "~/routes/management";

/** One audit event as the list publishes it; `at` is epoch milliseconds. */
export const AUDIT_EVENT = s
	.object({
		id: s.string(),
		at: s.integer(),
		action: s.string(),
		actorType: s.enum_(["subject", "member", "client", "platform"] as const),
		actorId: s.string(),
		targetType: s.string(),
		targetId: s.string(),
		outcome: s.enum_(["succeeded", "failed", "denied"] as const),
		context: s.record(s.string(), s.any()),
		detail: s.record(s.string(), s.any()),
	})
	.meta({ id: "AuditEvent" });

/** `GET /tenants/:tenantId/audit-events`: a window of the audit log, newest first. */
export const AUDIT_EVENTS_LIST = defineOperation("auditEventsList", routes.auditEventsList, {
	summary: "List audit events",
	description: "A keyset page of the audit events recorded between from and to (epoch ms).",
	tags: ["Audit events"],
	params: s.object({ tenantId: s.string() }),
	query: s.object({
		from: coerce.number(),
		to: coerce.number(),
		action: s.optional(s.string()),
		actor_id: s.optional(s.string()),
		target_id: s.optional(s.string()),
		...PAGING_QUERY,
	}),
	responses: {
		200: { description: "The page of events", body: s.array(AUDIT_EVENT), headers: LINK_HEADER },
	},
	problems: [...AUTH_PROBLEMS, ...PAGING_PROBLEMS, "validationFailed"],
	security: requires("audit:read"),
});

/** Every operation in this area, in route-map order, for the document to list. */
export const AUDIT_OPERATIONS = [AUDIT_EVENTS_LIST] as const;
