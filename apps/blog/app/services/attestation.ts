/**
 * Remembers in the visitor's session that their device redeemed a Privacy Pass token, so the
 * contact forms can count it as evidence of a person. The token proves the issuer vouched for
 * the device and nothing more, so the attestation expires after {@link ATTESTATION_TTL_MS}.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Session } from "remix/session";

/** The session key holding when the device last redeemed a token, in epoch milliseconds. */
const ATTESTED_AT_KEY = "privacyPassAttestedAt";

/** How long a redemption vouches for the session: long enough to write a message. */
export const ATTESTATION_TTL_MS = 60 * 60 * 1000;

/**
 * Records a redemption made now.
 *
 * @param session The visitor's session.
 * @param now The redemption time.
 */
export function recordAttestation(session: Session, now: Date = new Date()): void {
	session.set(ATTESTED_AT_KEY, now.getTime());
}

/**
 * Reports whether the session redeemed a token within {@link ATTESTATION_TTL_MS}.
 *
 * @param session The visitor's session.
 * @param now The time to measure the attestation's age against.
 * @returns `true` while the attestation is fresh.
 */
export function isAttested(session: Session, now: Date = new Date()): boolean {
	let attestedAt = session.get(ATTESTED_AT_KEY);
	if (typeof attestedAt !== "number") return false;
	let age = now.getTime() - attestedAt;
	return age >= 0 && age < ATTESTATION_TTL_MS;
}
