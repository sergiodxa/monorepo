/**
 * Resolves other people's profiles (name, avatar, email) from the identity provider, for
 * the callers that need more than the signed-in viewer's own identity — the team settings
 * member list, the account page's team list, and the digest job, which has no viewer at all
 * and needs an address for every member of every team. The session only ever carries the
 * current viewer's own profile, so member profiles are read server-to-server with the app's
 * own credentials.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ManagementClient } from "@pkg/auth/management-client";

import { SubjectNotFoundError } from "@pkg/auth/management-client";
import { isFailure } from "@pkg/result";

import { mapWithConcurrency } from "~/app/lib/concurrency";

/**
 * Resolves every listed subject id to its profile at the identity provider.
 *
 * Runs in bounded-concurrency batches to stay under the Workers subrequest ceiling
 * (ADR-008). An id the provider holds no record under is simply absent from the
 * result, since a member whose account is gone is an answer the callers render around.
 * Every other condition — a refusal, a throttle, a provider fault, an unreadable
 * payload — is raised, so a caller decides for itself whether to proceed on a partial
 * list rather than being handed one that looks complete.
 *
 * @param admin - Management client to read through.
 * @param subjectIds - Subjects to look up, duplicates allowed.
 * @returns The profiles that resolved, keyed by subject id.
 * @throws {ManagementError} When the provider produced no answer for an id it may hold
 *   a record under.
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
		 * Re-raised here rather than at the lookup, because the batch runner turns every
		 * throw into a recorded outcome; without this the condition would read as a
		 * member who simply has no account.
		 */
		if (!outcome.ok) throw outcome.error;
		if (outcome.value) map.set(outcome.item, outcome.value);
	}

	return map;
}
