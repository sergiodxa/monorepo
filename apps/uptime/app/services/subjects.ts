/**
 * Resolves other people's profiles (name, avatar, email) from the identity provider, for
 * the callers that need more than the signed-in viewer's own identity. A session carries
 * only its own viewer, so these reads go server-to-server on the app's own credentials.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ManagementClient } from "@sdxc/auth/management-client";

import { SubjectNotFoundError } from "@sdxc/auth/management-client";
import { isFailure } from "@sdxc/result";

import { mapWithConcurrency } from "~/app/lib/concurrency";

/**
 * Resolves every listed subject id to its profile at the identity provider, in
 * bounded-concurrency batches that stay under the Workers subrequest ceiling (ADR-008).
 * An id the provider holds no record under is absent from the result.
 *
 * @param admin - Management client to read through.
 * @param subjectIds - Subjects to look up, duplicates allowed.
 * @returns The profiles that resolved, keyed by subject id.
 * @throws {ManagementError} On a refusal, a throttle, a provider fault or an unreadable
 *   payload — every condition where the provider may still hold the record — so the caller
 *   decides for itself whether a partial list is enough to render.
 */
export async function resolveSubjects(
	admin: ManagementClient,
	subjectIds: string[],
): Promise<Map<string, ManagementClient.Subject>> {
	let map = new Map<string, ManagementClient.Subject>();
	if (subjectIds.length === 0) return map;

	let settled = await mapWithConcurrency([...new Set(subjectIds)], async (subjectId) => {
		let result = await admin.fetchSubjectById(subjectId);
		if (!isFailure(result)) return result.data;
		if (result.error instanceof SubjectNotFoundError) return null;
		throw result.error;
	});

	for (let outcome of settled) {
		/**
		 * The batch runner records a throw as an outcome, so it is raised again here to keep
		 * a failed lookup distinct from a member the provider holds no record for.
		 */
		if (!outcome.ok) throw outcome.error;
		if (outcome.value) map.set(outcome.item, outcome.value);
	}

	return map;
}
