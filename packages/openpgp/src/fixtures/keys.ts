/**
 * Builds version 4 ECDSA P-256 and RSA private keys from Web Crypto key pairs, so the
 * tests cover the algorithms this package signs with but does not generate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Base64Url, concatBytes } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";

import type { PublicMaterial, SecretKeyPacket } from "../key-packet.js";

import {
	HASHES,
	KEY_FLAG,
	PUBLIC_KEY_ALGORITHM,
	SIGNATURE_TYPE,
	SUBPACKET,
} from "../algorithms.js";
import { publicFields, publicKeyBody, readPublicKeyPacket } from "../key-packet.js";
import { PrivateKey } from "../keys.js";
import { fromBigInt, mpi, toBigInt, utf8 } from "../lib/bytes.js";
import { createSignature, keyHashInput, subpacket, userIdHashInput } from "../signature-engine.js";
import { readSignaturePacket } from "../signature-packet.js";

/**
 * Bytes from a JWK member.
 *
 * @param value - The base64url member.
 */
function member(value: string | undefined): Uint8Array<ArrayBuffer> {
	return unwrap(Base64Url.decode(value ?? ""));
}

/**
 * The public material and secret octets of a fresh Web Crypto key pair.
 *
 * @param kind - The algorithm.
 */
async function materialOf(
	kind: "ecdsa-p256" | "rsa",
): Promise<{ material: PublicMaterial; secret: Uint8Array<ArrayBuffer> }> {
	if (kind === "ecdsa-p256") {
		let pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
			"sign",
		])) as CryptoKeyPair;
		let jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
		let point = concatBytes(Uint8Array.of(4), member(jwk.x), member(jwk.y));
		return {
			material: { kind: "ecdsa", curve: "P-256", size: 32, point },
			secret: mpi(member(jwk.d)),
		};
	}
	let pair = (await crypto.subtle.generateKey(
		{
			name: "RSASSA-PKCS1-v1_5",
			modulusLength: 2048,
			publicExponent: Uint8Array.of(1, 0, 1),
			hash: "SHA-256",
		},
		true,
		["sign"],
	)) as CryptoKeyPair;
	let jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
	let [first, second] = [toBigInt(member(jwk.p)), toBigInt(member(jwk.q))];
	let [p, q] = first < second ? [first, second] : [second, first];
	let u = 1n;
	for (
		let base = p % q, exponent = q - 2n;
		exponent > 0n;
		exponent >>= 1n, base = (base * base) % q
	) {
		if (exponent & 1n) u = (u * base) % q;
	}
	let secret = concatBytes(
		mpi(member(jwk.d)),
		mpi(fromBigInt(p)),
		mpi(fromBigInt(q)),
		mpi(fromBigInt(u)),
	);
	return { material: { kind: "rsa", n: member(jwk.n), e: member(jwk.e) }, secret };
}

/**
 * A version 4 private key over a fresh Web Crypto key pair, with a certified User ID that
 * allows certifying and signing.
 *
 * @param kind - The algorithm.
 * @param userId - The User ID to certify.
 */
export async function webCryptoKey(
	kind: "ecdsa-p256" | "rsa",
	userId = "Test <test@example.com>",
): Promise<PrivateKey> {
	let { material, secret } = await materialOf(kind);
	let algorithm = kind === "rsa" ? PUBLIC_KEY_ALGORITHM.rsa : PUBLIC_KEY_ALGORITHM.ecdsa;
	let created = new Date(Math.floor(Date.now() / 1000) * 1000);
	let packet = unwrap(
		await readPublicKeyPacket(publicKeyBody(4, created, algorithm, publicFields(material))),
	);
	let primary: SecretKeyPacket = { ...packet, secret, protection: null };
	let userBody = utf8(userId);
	let certification = unwrap(
		await createSignature(
			{ key: primary, secret },
			SIGNATURE_TYPE.positiveCertification,
			concatBytes(keyHashInput(primary), userIdHashInput(userBody)),
			{
				hash: HASHES["SHA-256"],
				created,
				subpackets: [
					subpacket(SUBPACKET.keyFlags, Uint8Array.of(KEY_FLAG.certify | KEY_FLAG.sign), true),
				],
			},
		),
	);
	let signature = unwrap(readSignaturePacket(certification));
	return new PrivateKey({
		primary,
		directSignatures: [],
		users: [{ userId, body: userBody, signatures: [signature] }],
		attributes: [],
		subkeys: [],
	});
}
