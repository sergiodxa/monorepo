/**
 * The subject-lookup endpoint (`GET /api/subjects/:subjectId`). Answers an authenticated
 * client with one subject's profile, reading a per-client cache first and falling back to
 * the database while repopulating it. Exists so a relying party's server can resolve the
 * people it already knows by id without holding a copy of this server's database.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound, ok } from "@pkg/http/response/json";
import { inject } from "@pkg/service-container";
import { env, waitUntil } from "cloudflare:workers";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import Subject from "~/app/data/subject";
import { requireApiClient } from "~/app/http/middleware/require-api-client";
import { parseCachedSubject, toApiSubject } from "~/app/http/view-models/api-subject";
import routes from "~/routes/web";

/** How long a subject payload stays cached for the client that asked for it. */
const SUBJECT_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * KV key one client's copy of one subject is cached under.
 *
 * **Frozen and shared at runtime** with the other worker serving this same API: the key
 * shape and the stored JSON must stay interchangeable, or one worker starts serving a
 * payload the other wrote and cannot read. The cache is per client rather than global so
 * that widening what a client is allowed to see can never be answered from an entry
 * written for a different one.
 */
function subjectCacheKey(clientId: string, subjectId: string): string {
	return `clients:${clientId}:subjects:${subjectId}`;
}

/**
 * GET /api/subjects/:subjectId — returns `{ subject }` for a client-credentials caller.
 *
 * The response envelope, the payload's field names and its ISO-8601 timestamps are a
 * frozen contract: clients parse them directly. A missing subject is a `404` with an
 * `{ error }` envelope, and an unauthenticated request never reaches this handler — the
 * guard answers it.
 */
export default createAction(routes.api.subject, {
	middleware: [requireApiClient()],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let collector = ctx.timing;
		let subjectId = ctx.params.subjectId!;
		let cacheKey = subjectCacheKey(ctx.apiClient.id, subjectId);

		let cached = await collector.measure("cache", "cacheLookup", async () => {
			return parseCachedSubject(await env.KV.get(cacheKey, "json"));
		});

		if (cached) {
			ctx.logger.info("api_subject_cache_hit", { clientId: ctx.apiClient.id, subjectId });
			return ok({ subject: cached });
		}

		let subject = await collector.measure("db", "findSubjectById", async () => {
			return await Subject.findById(db, subjectId);
		});

		if (!subject) {
			ctx.logger.info("api_subject_not_found", { clientId: ctx.apiClient.id, subjectId });
			return notFound({ error: "Subject not found" });
		}

		let payload = toApiSubject(subject);

		waitUntil(
			env.KV.put(cacheKey, JSON.stringify(payload), {
				expirationTtl: SUBJECT_CACHE_TTL_SECONDS,
			}),
		);

		ctx.logger.info("api_subject_served", { clientId: ctx.apiClient.id, subjectId });

		return ok({ subject: payload });
	}),
});
