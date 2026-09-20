/**
 * The remaining-credential predicate every credential removal shares: whether a
 * subject keeps at least one other way to sign in after one more is taken away.
 * Counts verified identifiers, passwords and passkeys — every table that can
 * currently authenticate a subject — which is why this lives above `subjects.ts`,
 * `passwords.ts` and `passkeys.ts` rather than inside any one of them: each of those
 * already imports from `subjects.ts`, so a shared check any of them could import
 * would import itself back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { and, eq, ne, notNull } from "remix/data-table";

import { passkeys } from "./passkeys";
import { passwords } from "./passwords";
import { subjectIdentifiers } from "./subjects";

/** The one credential a removal is asking whether it may take away. */
export type ExcludedCredential =
	| { kind: "identifier"; id: string }
	| { kind: "password" }
	| { kind: "passkey"; credentialId: string };

/**
 * Whether a subject keeps at least one other verified identifier, password or
 * non-suspended passkey after the named one is removed.
 *
 * A password row has no id of its own worth excluding by, because removing a
 * password removes every row a subject holds at once (there is only ever one
 * credential to lose, not one row among several); the exclusion for that case is
 * "count nothing from the passwords table" rather than "count all but one row".
 *
 * @param db - The tenant's database.
 * @param subjectId - The subject a removal is being asked about.
 * @param excluding - The credential the caller is about to remove.
 * @returns Whether at least one other credential would remain.
 */
export async function hasAnotherCredential(
	db: Database,
	subjectId: string,
	excluding: ExcludedCredential,
): Promise<boolean> {
	let identifierCount = await db.count(subjectIdentifiers, {
		where:
			excluding.kind === "identifier"
				? and(eq("subject_id", subjectId), notNull("verified_at"), ne("id", excluding.id))
				: and(eq("subject_id", subjectId), notNull("verified_at")),
	});
	if (identifierCount > 0) return true;

	let passwordCount =
		excluding.kind === "password"
			? 0
			: await db.count(passwords, { where: { subject_id: subjectId } });
	if (passwordCount > 0) return true;

	let passkeyCount = await db.count(passkeys, {
		where:
			excluding.kind === "passkey"
				? and(
						eq("subject_id", subjectId),
						eq("suspended", false),
						ne("credential_id", excluding.credentialId),
					)
				: and(eq("subject_id", subjectId), eq("suspended", false)),
	});

	return passkeyCount > 0;
}
