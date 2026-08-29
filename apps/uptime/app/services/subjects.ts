/**
 * Resolves other users' profiles (name, avatar, email) from the auth server, for the callers
 * that need more than the signed-in viewer's own identity — the team settings member list, the
 * account page's team list, and the digest job, which has no viewer at all and needs an address
 * for every member of every team. The session only ever carries the current viewer's own
 * profile, so member profiles are fetched server-to-server via `@pkg/auth-sdk`'s
 * client-credentials flow.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AuthSDK, Subject } from "@pkg/auth-sdk";

import { isFailure } from "@pkg/result";

import { mapWithConcurrency } from "~/app/lib/concurrency";

/**
 * Resolves every listed subject id to its auth-server profile, best-effort.
 * Runs in bounded-concurrency batches to stay under the Workers subrequest
 * ceiling (ADR-008); an unresolved id is simply absent from the result.
 *
 * @param sdk - Auth SDK to resolve through.
 * @param subjectIds - Subjects to look up, duplicates allowed.
 * @returns The profiles that resolved, keyed by subject id.
 */
export async function resolveSubjects(
	sdk: AuthSDK,
	subjectIds: string[],
): Promise<Map<string, Subject>> {
	let map = new Map<string, Subject>();
	if (subjectIds.length === 0) return map;

	let tokenResult = await sdk.authenticate();
	if (isFailure(tokenResult)) return map;
	let token = tokenResult.data;

	let settled = await mapWithConcurrency([...new Set(subjectIds)], async (subjectId) => {
		let result = await sdk.fetchSubjectById(subjectId, token);
		if (isFailure(result)) throw result.error;
		return result.data;
	});

	for (let outcome of settled) if (outcome.ok) map.set(outcome.item, outcome.value);

	return map;
}
