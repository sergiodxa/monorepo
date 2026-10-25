/**
 * Test helpers that play the Transparency Service: the RFC 9162 tree hash and inclusion path
 * computed recursively as the spec defines them, and a Receipt signed over a log's root, so
 * tests check the verifier against an independent implementation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CBORValue } from "@sdxc/cbor";

import { encode } from "@sdxc/cbor";
import * as COSE from "@sdxc/cbor/cose";
import { concatBytes } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";

import { leafHash } from "../merkle.js";

/** SHA-256 over joined parts. */
async function sha256(...parts: Uint8Array[]): Promise<Uint8Array<ArrayBuffer>> {
	return new Uint8Array(await crypto.subtle.digest("SHA-256", concatBytes(...parts)));
}

/** The largest power of two below `size`, where RFC 9162 splits a tree of `size` leaves. */
function split(size: number): number {
	return 2 ** Math.floor(Math.log2(size - 1));
}

/** RFC 9162 Section 2.1.1 MTH over `leaves`. */
export async function treeHash(leaves: Uint8Array[]): Promise<Uint8Array<ArrayBuffer>> {
	if (leaves.length === 1) return leafHash(leaves[0] as Uint8Array);
	let k = split(leaves.length);
	return sha256(
		Uint8Array.of(1),
		await treeHash(leaves.slice(0, k)),
		await treeHash(leaves.slice(k)),
	);
}

/** RFC 9162 Section 2.1.3.1 PATH for the leaf at `index`. */
export async function inclusionPath(
	index: number,
	leaves: Uint8Array[],
): Promise<Uint8Array<ArrayBuffer>[]> {
	if (leaves.length === 1) return [];
	let k = split(leaves.length);
	if (index < k)
		return [...(await inclusionPath(index, leaves.slice(0, k))), await treeHash(leaves.slice(k))];
	return [...(await inclusionPath(index - k, leaves.slice(k))), await treeHash(leaves.slice(0, k))];
}

/** How `issueReceipt` signs. */
export interface IssueOptions {
	/** The service's private key, imported for ES256. */
	key: CryptoKey;
	/** The `kid` written into the protected header. */
	kid: Uint8Array | string;
	/** The service's issuer claim. */
	issuer: string;
	/** The subject claim. */
	subject: string;
}

/** A Receipt for `entries[index]`, shaped as RFC 9942 Section 5.2.1 lays one out. */
export async function issueReceipt(
	entries: Uint8Array[],
	index: number,
	options: IssueOptions,
): Promise<Uint8Array<ArrayBuffer>> {
	let proof = unwrap(encode([entries.length, index, await inclusionPath(index, entries)]));
	return unwrap(
		await COSE.sign1({
			protected: new Map<CBORValue, CBORValue>([
				[1, COSE.Algorithm.ES256],
				[4, typeof options.kid === "string" ? options.kid : Uint8Array.from(options.kid)],
				[395, 1],
				[
					15,
					new Map([
						[1, options.issuer],
						[2, options.subject],
					]),
				],
			]),
			unprotected: new Map([[396, new Map([[-1, [proof]]])]]),
			payload: await treeHash(entries),
			detached: true,
			key: options.key,
		}),
	);
}
