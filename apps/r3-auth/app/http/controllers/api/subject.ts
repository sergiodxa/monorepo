/**
 * The subject-lookup endpoint (`GET /api/subjects/:subjectId`). Answers an authenticated
 * client with the profile of a subject who authorized it, reading a per-client cache before
 * the database. Exists so a relying party's server can resolve the people who signed in to
 * it by id without holding a copy of this server's database.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound, ok } from "@sdxc/http/response/json";
import { env, waitUntil } from "cloudflare:workers";
import { createAction } from "remix/router";

import { requireApiClient } from "~/app/http/middleware/require-api-client";
import { parseCachedSubject, toApiSubject } from "~/app/http/view-models/api-subject";
import routes from "~/routes/web";

/** How long a subject payload stays cached for the client that asked for it. */
const SUBJECT_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * Frozen KV key for one client's copy of one subject: a second deployed worker reads and
 * writes these same entries, so the key shape and the stored JSON stay interchangeable.
 * Scoping per client guarantees an entry only ever answers the client it was written for.
 */
function subjectCacheKey(clientId: string, subjectId: string): string {
	return `clients:${clientId}:subjects:${subjectId}`;
}

/**
 * GET /api/subjects/:subjectId — returns `{ subject }` for a client-credentials caller the
 * subject has authorized, checked ahead of the cache so withdrawn consent applies at once.
 * The envelope is a frozen contract; a missing or unauthorized subject is `404 { error }`.
 */
export default createAction(routes.api.subject, {
	middleware: [requireApiClient()],
	handler: async (ctx) => {
		let collector = ctx.timing;
		let subjectId = ctx.params.subjectId!;
		let cacheKey = subjectCacheKey(ctx.apiClient.id, subjectId);

		ctx.log.set({ subject: { id: subjectId } });

		let authorized = await collector.measure("db", "findGrant", async () => {
			return await ctx.models.grants.hasConsented(subjectId, ctx.apiClient.id);
		});

		if (!authorized) {
			ctx.log.note("api.subject.not_authorized");
			return notFound({ error: "Subject not found" });
		}

		let cached = await collector.measure("cache", "cacheLookup", async () => {
			return parseCachedSubject(await env.KV.get(cacheKey, "json"));
		});

		if (cached) {
			ctx.log.inc("cache.hit");
			return ok({ subject: cached });
		}

		ctx.log.inc("cache.miss");

		let subject = await collector.measure("db", "findSubjectById", async () => {
			return await ctx.models.subjects.find(subjectId);
		});

		if (!subject) {
			ctx.log.note("api.subject.not_found");
			return notFound({ error: "Subject not found" });
		}

		let payload = toApiSubject(subject);

		waitUntil(
			env.KV.put(cacheKey, JSON.stringify(payload), {
				expirationTtl: SUBJECT_CACHE_TTL_SECONDS,
			}),
		);

		return ok({ subject: payload });
	},
});
