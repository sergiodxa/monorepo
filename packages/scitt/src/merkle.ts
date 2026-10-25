/**
 * RFC 9162 Merkle tree hashing for the RFC9162_SHA256 Verifiable Data Structure: the leaf
 * hash of an entry and the root an inclusion proof leads to, which a Receipt's signature
 * must cover for the entry to count as included.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { concatBytes } from "@sdxc/crypto";
import { failure, success } from "@sdxc/result";

import { SCITTError } from "./errors.js";

/** An RFC 9162 inclusion proof as RFC 9942 encodes it for RFC9162_SHA256. */
export interface InclusionProof {
	/** Number of leaves in the tree the proof was taken from. */
	treeSize: number;
	/** Zero-based position of the entry's leaf. */
	leafIndex: number;
	/** Sibling hashes from the leaf up to the root, 32 bytes each. */
	path: Uint8Array[];
}

/** Bytes in a SHA-256 node hash. */
const HASH_BYTES = 32;

/** SHA-256 of `parts` joined. */
async function sha256(...parts: Uint8Array[]): Promise<Uint8Array<ArrayBuffer>> {
	return new Uint8Array(await crypto.subtle.digest("SHA-256", concatBytes(...parts)));
}

/**
 * The RFC 9162 leaf hash of an entry: SHA-256 over a zero byte and the entry, so a leaf can
 * never be passed off as an interior node.
 *
 * @example
 * let leaf = await leafHash(entryBytes);
 */
export async function leafHash(entry: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
	return sha256(Uint8Array.of(0), entry);
}

/**
 * The root an inclusion proof leads to from `leaf`, following RFC 9162 Section 2.1.3.2. A
 * leaf index at or past the tree size, a path of the wrong length, or a node that is not 32
 * bytes fails `invalid-proof`.
 *
 * @param leaf The entry's leaf hash.
 * @param proof Tree size, leaf index and path.
 * @returns The root hash the receipt's signature has to cover.
 * @example
 * let root = await rootFromInclusionProof(await leafHash(entry), { treeSize: 8, leafIndex: 7, path });
 */
export async function rootFromInclusionProof(
	leaf: Uint8Array,
	proof: InclusionProof,
): Promise<Result<Uint8Array<ArrayBuffer>, SCITTError>> {
	let { treeSize, leafIndex, path } = proof;
	if (!Number.isSafeInteger(treeSize) || !Number.isSafeInteger(leafIndex) || leafIndex < 0) {
		return failure(new SCITTError("invalid-proof", "tree size and leaf index must be integers"));
	}
	if (leafIndex >= treeSize) {
		return failure(new SCITTError("invalid-proof", "leaf index is not inside the tree"));
	}

	let fn = BigInt(leafIndex);
	let sn = BigInt(treeSize - 1);
	let root = Uint8Array.from(leaf);
	for (let node of path) {
		if (node.length !== HASH_BYTES)
			return failure(new SCITTError("invalid-proof", "path node is not 32 bytes"));
		if (sn === 0n) return failure(new SCITTError("invalid-proof", "inclusion path is too long"));
		if ((fn & 1n) === 1n || fn === sn) {
			root = await sha256(Uint8Array.of(1), node, root);
			while ((fn & 1n) === 0n && fn !== 0n) {
				fn >>= 1n;
				sn >>= 1n;
			}
		} else {
			root = await sha256(Uint8Array.of(1), root, node);
		}
		fn >>= 1n;
		sn >>= 1n;
	}

	if (sn !== 0n) return failure(new SCITTError("invalid-proof", "inclusion path is too short"));
	return success(root);
}
