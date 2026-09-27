/**
 * The status-page operations of the API document: the collection, one page and its
 * attached HTTP monitors and cron jobs. The request schemas here are the ones the
 * controllers validate with, so the published contract and the enforced one are the same.
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

/** The tag grouping every operation in this module. */
const TAGS = ["Status pages"];

/** The problems `requireApiKey` answers with, which every operation here can return. */
const AUTH_PROBLEMS = ["unauthorized", "forbidden"] as const;

/** The problems the idempotency middleware adds to a create. */
const IDEMPOTENCY_PROBLEMS = [
	"idempotencyKeyInvalid",
	"idempotencyKeyInUse",
	"idempotencyKeyReused",
] as const;

/**
 * A slug is part of the public page URL, so it stays lowercase letters, digits and hyphens;
 * the message is the one a rejected request reads.
 */
function slug() {
	return s.string().pipe(checks.minLength(1), {
		...checks.pattern(/^[a-z0-9-]+$/),
		message: "Slug must contain only lowercase letters, numbers, and hyphens",
	});
}

/** A status page's own fields, as `serializeStatusPage` writes them. */
const STATUS_PAGE_FIELDS = {
	id: resourceId("sp"),
	name: s.string(),
	slug: s.string(),
	title: s.string(),
	description: s.nullable(s.string()),
	logoUrl: s.nullable(s.string()),
	customDomain: s.nullable(s.string()),
	isPublic: s.boolean(),
	showOverallStatus: s.boolean(),
	createdAt: epochMs(),
	updatedAt: epochMs(),
};

/** The HTTP-monitor and cron-job ids attached to a page, the only kinds the API exposes. */
const ATTACHMENTS = {
	monitors: s.array(resourceId("mon")),
	cronJobs: s.array(resourceId("cron")),
};

/** A status page without its attachments. */
const STATUS_PAGE = s.object(STATUS_PAGE_FIELDS).meta({ id: "StatusPage" });

/** A status page with the ids of what it shows. */
const STATUS_PAGE_DETAIL = s
	.object({ ...STATUS_PAGE_FIELDS, ...ATTACHMENTS })
	.meta({ id: "StatusPageDetail" });

/** The path params naming one status page. */
export const STATUS_PAGE_ID_PARAMS = s.object({ statusPageId: typedId("sp") });

/** The body `POST /api/v1/status-pages` accepts; `title` defaults to `name`. */
export const CREATE_STATUS_PAGE_BODY = s.object({
	name: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	slug: slug().meta({ description: "Globally unique; lowercase letters, numbers and hyphens" }),
	title: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	description: s.optional(s.string().pipe(checks.maxLength(500))),
	logoUrl: s.optional(s.string().pipe(checks.url())),
	customDomain: s.optional(s.string().pipe(checks.minLength(1))),
	isPublic: s.defaulted(s.boolean(), true),
	showOverallStatus: s.defaulted(s.boolean(), true),
});

/** The body a status-page update accepts; every field is optional and `null` clears one. */
export const UPDATE_STATUS_PAGE_BODY = s.object({
	name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	slug: s.optional(slug()),
	title: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	description: s.optional(s.nullable(s.string().pipe(checks.maxLength(500)))),
	logoUrl: s.optional(s.nullable(s.string().pipe(checks.url()))),
	customDomain: s.optional(s.nullable(s.string().pipe(checks.minLength(1)))),
	isPublic: s.optional(s.boolean()),
	showOverallStatus: s.optional(s.boolean()),
});

/** The body that replaces a page's attachments; an omitted list detaches every item of it. */
export const UPDATE_ATTACHMENTS_BODY = s.object({
	monitorIds: s.defaulted(s.array(typedId("mon")), []),
	cronJobIds: s.defaulted(s.array(typedId("cron")), []),
});

const STATUS_PAGES_INDEX = defineOperation("statusPagesIndex", routes.api.v1.statusPages.index, {
	summary: "List status pages",
	tags: TAGS,
	query: PAGE_QUERY,
	responses: {
		200: pageResponse("A page of the team's status pages", { statusPages: s.array(STATUS_PAGE) }),
	},
	problems: ["badRequest", ...AUTH_PROBLEMS],
	security: [{ apiKey: ["status-pages:read"] }],
});

const STATUS_PAGES_CREATE = defineOperation("statusPagesCreate", routes.api.v1.statusPages.create, {
	summary: "Create a status page",
	tags: TAGS,
	body: CREATE_STATUS_PAGE_BODY,
	responses: {
		201: { description: "The created status page", body: envelope({ statusPage: STATUS_PAGE }) },
	},
	problems: ["validationError", ...AUTH_PROBLEMS, "conflict", ...IDEMPOTENCY_PROBLEMS],
	security: [{ apiKey: ["status-pages:write"] }],
});

const STATUS_PAGE_SHOW = defineOperation("statusPageShow", routes.api.v1.statusPages.show, {
	summary: "Show a status page",
	tags: TAGS,
	params: STATUS_PAGE_ID_PARAMS,
	responses: {
		200: {
			description: "The status page with its attachments",
			body: envelope({ statusPage: STATUS_PAGE_DETAIL }),
		},
	},
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
	security: [{ apiKey: ["status-pages:read"] }],
});

const STATUS_PAGE_UPDATE = defineOperation("statusPageUpdate", routes.api.v1.statusPages.update, {
	summary: "Update a status page",
	tags: TAGS,
	params: STATUS_PAGE_ID_PARAMS,
	body: UPDATE_STATUS_PAGE_BODY,
	responses: {
		200: {
			description: "The updated status page with its attachments",
			body: envelope({ statusPage: STATUS_PAGE_DETAIL }),
		},
	},
	problems: ["validationError", ...AUTH_PROBLEMS, "notFound", "conflict"],
	security: [{ apiKey: ["status-pages:write"] }],
});

const STATUS_PAGE_DESTROY = defineOperation(
	"statusPageDestroy",
	routes.api.v1.statusPages.destroy,
	{
		summary: "Delete a status page",
		tags: TAGS,
		params: STATUS_PAGE_ID_PARAMS,
		responses: {
			200: {
				description: "The status page is deleted",
				body: envelope({ deleted: s.literal(true) }),
			},
		},
		problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
		security: [{ apiKey: ["status-pages:write"] }],
	},
);

const STATUS_PAGE_MONITORS = defineOperation(
	"statusPageMonitors",
	routes.api.v1.statusPages.monitors,
	{
		summary: "Replace a status page's monitors and cron jobs",
		tags: TAGS,
		params: STATUS_PAGE_ID_PARAMS,
		body: UPDATE_ATTACHMENTS_BODY,
		responses: {
			200: {
				description: "The status page and the ids now attached to it, each listed once",
				body: envelope({ statusPage: STATUS_PAGE, ...ATTACHMENTS }),
			},
		},
		problems: ["validationError", ...AUTH_PROBLEMS, "notFound"],
		security: [{ apiKey: ["status-pages:write"] }],
	},
);

/** Every operation in this module, in the order the reference lists them. */
export const OPERATIONS = [
	STATUS_PAGES_INDEX,
	STATUS_PAGES_CREATE,
	STATUS_PAGE_SHOW,
	STATUS_PAGE_UPDATE,
	STATUS_PAGE_DESTROY,
	STATUS_PAGE_MONITORS,
];
