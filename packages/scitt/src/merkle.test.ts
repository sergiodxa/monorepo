/**
 * Tests for RFC 9162 inclusion proof verification against the Certificate Transparency
 * reference tree: its eight leaf inputs, root hashes for every size, and the node hashes
 * the size-8 tree's proofs are made of.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Hex } from "@sdxc/crypto";
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { leafHash, rootFromInclusionProof } from "./merkle.js";
import { inclusionPath } from "./test/tree.js";

/** Bytes from hex. */
function hex(text: string): Uint8Array<ArrayBuffer> {
	return unwrap(Hex.decode(text));
}

/** The reference tree's leaf inputs, in order. */
const LEAVES = [
	"",
	"00",
	"10",
	"2021",
	"3031",
	"40414243",
	"5051525354555657",
	"606162636465666768696a6b6c6d6e6f",
].map(hex);

/** The reference root hash for each tree size from 1 to 8. */
const ROOTS = [
	"6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d",
	"fac54203e7cc696cf0dfcb42c92a1d9dbaf70ad9e621f4bd8d98662f00e3c125",
	"aeb6bcfe274b70a14fb067a5e5578264db0fa9b51af5e0ba159158f329e06e77",
	"d37ee418976dd95753c1c73862b9398fa2a2cf9b4ff0fdfe8b30cd95209614b7",
	"4e3bbb1f7b478dcfe71fb631631519a3bca12c9aefca1612bfce4c13a86264d4",
	"76e67dadbcdf1e10e1b74ddc608abd2f98dfb16fbce75277b5232a127f2087ef",
	"ddb89be403809e325750d3d263cd78929c2942b7942a34b77e122c9594a74c8c",
	"5dc9da79a70659a9ad559cb701ded9a2ab9d823aad2f4960cfe370eff4604328",
];

/** The size-8 tree's node hashes, level by level from the leaves up. */
const NODES = [
	[
		"6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d",
		"96a296d224f285c67bee93c30f8a309157f0daa35dc5b87e410b78630a09cfc7",
		"0298d122906dcfc10892cb53a73992fc5b9f493ea4c9badb27b791b4127a7fe7",
		"07506a85fd9dd2f120eb694f86011e5bb4662e5c415a62917033d4a9624487e7",
		"bc1a0643b12e4d2d7c77918f44e0f4f79a838b6cf9ec5b5c283e1f4d88599e6b",
		"4271a26be0d8a84f0bd54c8c302e7cb3a3b5d1fa6780a40bcce2873477dab658",
		"b08693ec2e721597130641e8211e7eedccb4c26413963eee6c1e2ed16ffb1a5f",
		"46f6ffadd3d06a09ff3c5860d2755c8b9819db7df44251788c7d8e3180de8eb1",
	],
	[
		"fac54203e7cc696cf0dfcb42c92a1d9dbaf70ad9e621f4bd8d98662f00e3c125",
		"5f083f0a1a33ca076a95279832580db3e0ef4584bdff1f54c8a360f50de3031e",
		"0ebc5d3437fbe2db158b9f126a1d118e308181031d0a949f8dededebc558ef6a",
		"ca854ea128ed050b41b35ffc1b87b8eb2bde461e9e3b5596ece6b9d5975a0ae0",
	],
	[
		"d37ee418976dd95753c1c73862b9398fa2a2cf9b4ff0fdfe8b30cd95209614b7",
		"6b47aaf29ee3c2af9af889bc1fb9254dabd31177f16232dd6aab035ca39bf6e4",
	],
];

describe("leafHash", () => {
	test("hashes each reference leaf input to its level-0 node", async () => {
		for (let [index, leaf] of LEAVES.entries()) {
			expect(Hex.encode(await leafHash(leaf))).toBe(NODES[0]?.[index]);
		}
	});
});

describe("rootFromInclusionProof", () => {
	test("reaches the size-8 root from every leaf with the reference node hashes", async () => {
		for (let index = 0; index < 8; index++) {
			let path = [0, 1, 2].map((level) => hex(NODES[level]?.[(index >> level) ^ 1] as string));
			let root = await rootFromInclusionProof(await leafHash(LEAVES[index] as Uint8Array), {
				treeSize: 8,
				leafIndex: index,
				path,
			});
			expect(Hex.encode(unwrap(root))).toBe(ROOTS[7]);
		}
	});

	test("reaches every reference root from every leaf of every tree size", async () => {
		for (let size = 1; size <= 8; size++) {
			let leaves = LEAVES.slice(0, size);
			for (let index = 0; index < size; index++) {
				let path = await inclusionPath(index, leaves);
				let root = await rootFromInclusionProof(await leafHash(leaves[index] as Uint8Array), {
					treeSize: size,
					leafIndex: index,
					path,
				});
				expect(Hex.encode(unwrap(root))).toBe(ROOTS[size - 1]);
			}
		}
	});

	test("refuses a leaf index outside the tree and a path of the wrong length", async () => {
		let leaf = await leafHash(LEAVES[0] as Uint8Array);
		let path = [hex(NODES[0]?.[1] as string)];
		let outside = await rootFromInclusionProof(leaf, { treeSize: 2, leafIndex: 2, path });
		expect(isFailure(outside) && outside.error.code).toBe("invalid-proof");
		let short = await rootFromInclusionProof(leaf, { treeSize: 4, leafIndex: 0, path });
		expect(isFailure(short) && short.error.code).toBe("invalid-proof");
		let long = await rootFromInclusionProof(leaf, { treeSize: 1, leafIndex: 0, path });
		expect(isFailure(long) && long.error.code).toBe("invalid-proof");
		let truncated = await rootFromInclusionProof(leaf, {
			treeSize: 2,
			leafIndex: 0,
			path: [Uint8Array.of(1)],
		});
		expect(isFailure(truncated) && truncated.error.code).toBe("invalid-proof");
	});

	test("leads a sibling's proof to a different root, so a wrong leaf never verifies", async () => {
		let path = [0, 1, 2].map((level) => hex(NODES[level]?.[(3 >> level) ^ 1] as string));
		let root = await rootFromInclusionProof(await leafHash(LEAVES[2] as Uint8Array), {
			treeSize: 8,
			leafIndex: 3,
			path,
		});
		expect(Hex.encode(unwrap(root))).not.toBe(ROOTS[7]);
	});
});
