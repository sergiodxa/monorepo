/**
 * The subject-lookup API route (GET /api/subjects/:subjectId). Its loader
 * authenticates the calling client, then returns the requested subject, reading from
 * a per-client KV cache first and falling back to the database while populating the
 * cache for a week; it records Server-Timing metrics and returns 401/404 as needed.
 * Exists so trusted clients can fetch subject profile data by id.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TimingCollector } from "@edgefirst-dev/server-timing";
import { notFound, ok, unauthorized } from "@pkg/http/response/json";
import { env, waitUntil } from "cloudflare:workers";

import type { SelectSubject } from "~/db/schema";

import { authorize } from "~/helpers/api";
import { db } from "~/middleware/drizzle";
import Subject from "~/models/subject";

import type { Route } from "./+types/route";

export async function loader({ request, params }: Route.LoaderArgs) {
	let headers = new Headers();
	let collector = new TimingCollector();

	let client = await collector.measure("auth", "authorize", () => {
		return authorize(db(), collector, request);
	});

	if (!client) {
		collector.toHeaders(headers);
		return unauthorized({ error: "Unauthorized" }, { headers });
	}

	let cacheKey = `clients:${client.id}:subjects:${params.subjectId}`;

	let cached = await collector.measure("cache", "cacheLookup", () => {
		return env.KV.get<SelectSubject>(cacheKey, "json");
	});

	if (cached) {
		collector.toHeaders(headers);
		return ok({ subject: cached }, { headers });
	}

	let subject = await collector.measure("db", "findSubjectById", () => {
		return Subject.findById(db(), params.subjectId);
	});

	if (!subject) {
		collector.toHeaders(headers);
		return notFound({ error: "Subject not found" }, { headers });
	}

	waitUntil(
		env.KV.put(
			cacheKey,
			JSON.stringify(subject),
			{ expirationTtl: 60 * 60 * 24 * 7 }, // Cache for 7 days
		),
	);

	collector.toHeaders(headers);
	return ok({ subject }, { headers });
}
