/**
 * The team operations of the API document: the team's profile, its memberships, its
 * domains and its invites. The request schemas here are the ones the controllers validate
 * with, so the published contract and the enforced one are the same values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { defineOperation } from "@sdxc/openapi";

import { envelope, PAGE_QUERY, pageResponse } from "~/app/http/openapi/envelope";
import { epochMs, resourceId } from "~/app/http/openapi/fields";
import { typedId } from "~/app/services/typed-id";
import routes from "~/routes/web";

/** The tag grouping the team's profile, memberships and domains. */
const TEAM_TAGS = ["Team"];

/** The tag grouping the invite operations. */
const INVITE_TAGS = ["Invites"];

/** The problems `requireApiKey` answers with, which every operation here can return. */
const AUTH_PROBLEMS = ["unauthorized", "forbidden"] as const;

/** The problems the idempotency middleware adds to a create. */
const IDEMPOTENCY_PROBLEMS = [
	"idempotencyKeyInvalid",
	"idempotencyKeyInUse",
	"idempotencyKeyReused",
] as const;

/** The team as `serializeTeam` writes it. */
const TEAM = s
	.object({
		id: resourceId("team"),
		name: s.string(),
		slug: s.string(),
		logo: s.nullable(s.string()).meta({ description: "Logo URL; null without one" }),
		ownerId: resourceId("usr"),
		createdAt: epochMs(),
		updatedAt: epochMs(),
	})
	.meta({ id: "Team" });

/** One person's membership in the team. */
const MEMBERSHIP = s
	.object({
		id: resourceId("mem"),
		subjectId: resourceId("usr"),
		teamId: resourceId("team"),
		role: s.enum_(["member", "admin"]),
		createdAt: epochMs(),
		updatedAt: epochMs(),
	})
	.meta({ id: "Membership" });

/** A team domain as `serializeTeamDomain` writes it. */
const TEAM_DOMAIN = s
	.object({
		id: resourceId("dom"),
		hostname: s.string(),
		verifiedAt: s.nullable(epochMs()).meta({ description: "When verified; null while pending" }),
		teamId: resourceId("team"),
		createdAt: epochMs(),
		updatedAt: epochMs(),
	})
	.meta({ id: "TeamDomain" });

/** An invite as `serializeInvite` writes it. */
const INVITE = s
	.object({
		id: resourceId("inv"),
		email: s.string(),
		senderId: resourceId("usr"),
		teamId: resourceId("team"),
		acceptedAt: s.nullable(epochMs()).meta({ description: "When accepted; null while pending" }),
		createdAt: epochMs(),
		updatedAt: epochMs(),
	})
	.meta({ id: "Invite" });

/** The body `PUT /api/v1/team` accepts; at least one field must be present. */
export const UPDATE_TEAM_BODY = s
	.object({
		name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
		logoUrl: s.optional(s.string().pipe(checks.url())),
	})
	.refine(
		(value) => value.name !== undefined || value.logoUrl !== undefined,
		"At least one field must be provided",
	)
	.meta({ description: "At least one of `name` and `logoUrl` must be provided" });

/** The body `POST /api/v1/team-domains` accepts. */
export const CREATE_TEAM_DOMAIN_BODY = s.object({
	hostname: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
});

/** The body `DELETE /api/v1/team-domains` accepts, naming the domain to remove. */
export const DELETE_TEAM_DOMAIN_BODY = s.object({ id: typedId("dom") });

/** The body `POST /api/v1/invites` accepts. */
export const CREATE_INVITE_BODY = s.object({ email: s.string().pipe(checks.email()) });

/** The path params naming one invite. */
export const INVITE_ID_PARAMS = s.object({ inviteId: typedId("inv") });

const TEAM_SHOW = defineOperation("teamShow", routes.api.v1.teamShow, {
	summary: "Show the team",
	tags: TEAM_TAGS,
	responses: { 200: { description: "The team", body: envelope({ team: TEAM }) } },
	problems: AUTH_PROBLEMS,
	security: [{ apiKey: ["teams:read"] }],
});

const TEAM_UPDATE = defineOperation("teamUpdate", routes.api.v1.teamUpdate, {
	summary: "Update the team",
	tags: TEAM_TAGS,
	body: UPDATE_TEAM_BODY,
	responses: { 200: { description: "The updated team", body: envelope({ team: TEAM }) } },
	problems: ["validationError", ...AUTH_PROBLEMS],
	security: [{ apiKey: ["teams:write"] }],
});

const MEMBERSHIPS_INDEX = defineOperation("membershipsIndex", routes.api.v1.memberships, {
	summary: "List the team's memberships",
	tags: TEAM_TAGS,
	query: PAGE_QUERY,
	responses: {
		200: pageResponse("A page of the team's memberships", { memberships: s.array(MEMBERSHIP) }),
	},
	problems: ["badRequest", ...AUTH_PROBLEMS],
	security: [{ apiKey: ["teams:read"] }],
});

const TEAM_DOMAINS_INDEX = defineOperation("teamDomainsIndex", routes.api.v1.teamDomains.index, {
	summary: "List the team's domains",
	tags: TEAM_TAGS,
	query: PAGE_QUERY,
	responses: {
		200: pageResponse("A page of the team's domains", { teamDomains: s.array(TEAM_DOMAIN) }),
	},
	problems: ["badRequest", ...AUTH_PROBLEMS],
	security: [{ apiKey: ["team-domains:read"] }],
});

const TEAM_DOMAINS_CREATE = defineOperation("teamDomainsCreate", routes.api.v1.teamDomains.create, {
	summary: "Add a domain to the team",
	tags: TEAM_TAGS,
	body: CREATE_TEAM_DOMAIN_BODY,
	responses: {
		201: {
			description: "The added domain, pending verification",
			body: envelope({ teamDomain: TEAM_DOMAIN }),
		},
	},
	problems: ["validationError", ...AUTH_PROBLEMS, "conflict", ...IDEMPOTENCY_PROBLEMS],
	security: [{ apiKey: ["team-domains:write"] }],
});

const TEAM_DOMAINS_DESTROY = defineOperation(
	"teamDomainsDestroy",
	routes.api.v1.teamDomains.destroy,
	{
		summary: "Remove a domain from the team",
		tags: TEAM_TAGS,
		body: DELETE_TEAM_DOMAIN_BODY,
		responses: {
			200: { description: "The domain is removed", body: envelope({ deleted: s.literal(true) }) },
		},
		problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
		security: [{ apiKey: ["team-domains:write"] }],
	},
);

const INVITES_INDEX = defineOperation("invitesIndex", routes.api.v1.invites.index, {
	summary: "List the team's invites",
	tags: INVITE_TAGS,
	query: PAGE_QUERY,
	responses: {
		200: pageResponse("A page of invites, pending and accepted", { invites: s.array(INVITE) }),
	},
	problems: ["badRequest", ...AUTH_PROBLEMS],
	security: [{ apiKey: ["invites:read"] }],
});

const INVITES_CREATE = defineOperation("invitesCreate", routes.api.v1.invites.create, {
	summary: "Invite someone to the team",
	tags: INVITE_TAGS,
	body: CREATE_INVITE_BODY,
	responses: { 201: { description: "The pending invite", body: envelope({ invite: INVITE }) } },
	problems: ["validationError", ...AUTH_PROBLEMS, "conflict", ...IDEMPOTENCY_PROBLEMS],
	security: [{ apiKey: ["invites:write"] }],
});

const INVITE_DESTROY = defineOperation("inviteDestroy", routes.api.v1.invites.destroy, {
	summary: "Revoke a pending invite",
	tags: INVITE_TAGS,
	params: INVITE_ID_PARAMS,
	responses: {
		200: { description: "The invite is revoked", body: envelope({ deleted: s.literal(true) }) },
	},
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound", "conflict"],
	security: [{ apiKey: ["invites:write"] }],
});

/** Every operation in this module, in the order the reference lists them. */
export const OPERATIONS = [
	TEAM_SHOW,
	TEAM_UPDATE,
	MEMBERSHIPS_INDEX,
	TEAM_DOMAINS_INDEX,
	TEAM_DOMAINS_CREATE,
	TEAM_DOMAINS_DESTROY,
	INVITES_INDEX,
	INVITES_CREATE,
	INVITE_DESTROY,
];
