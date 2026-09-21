/**
 * Encrypts an assertion the way an identity provider does, including the CBC
 * padding XML Encryption specifies and Web Crypto will not produce on its own,
 * so the decryption tests exercise the path a real provider's document takes
 * rather than the one the platform happens to make easy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { XML } from "@sdxc/xml";

import { Base64, randomBytes } from "@sdxc/crypto";

/** XML Encryption 1.1, where the GCM algorithms are named. */
const ENCRYPTION11_NS = "http://www.w3.org/2009/xmlenc11#";

/** XML Encryption 1.0, where the CBC and key transport algorithms are named. */
const ENCRYPTION_NS = "http://www.w3.org/2001/04/xmlenc#";

/** XML Signature, whose key info element carries the transported key. */
const SIGNATURE_NS = "http://www.w3.org/2000/09/xmldsig#";

/** The AES block size, which a CBC payload is a whole number of. */
const AES_BLOCK_LENGTH = 16;

/** How many bytes of nonce a GCM payload leads with. */
const GCM_NONCE_LENGTH = 12;

/** How one fixture assertion is encrypted. */
export interface EncryptOptions {
	/** The assertion XML to encrypt. */
	plaintext: string;

	/** The service provider's public key, which the session key is transported to. */
	publicKey: CryptoKey;

	/** Which content algorithm the provider used. */
	mode: "GCM" | "CBC";

	/** How many bits the session key carries. */
	bits: 128 | 256;
}

/**
 * Encrypts an assertion into the `EncryptedAssertion` element a response
 * carries it in.
 *
 * @param options - The assertion, the key to transport to, and the algorithms
 * @returns The element, as plain XML data
 */
export async function encryptAssertion(options: EncryptOptions): Promise<XML.Element> {
	let session = await crypto.subtle.generateKey(
		{ name: `AES-${options.mode}`, length: options.bits },
		true,
		["encrypt", "decrypt"],
	);

	let raw = new Uint8Array(await crypto.subtle.exportKey("raw", session));
	let wrapped = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, options.publicKey, raw);

	let payload =
		options.mode === "GCM"
			? await encryptGcm(session, options.plaintext)
			: await encryptCbc(session, options.plaintext);

	let contentAlgorithm =
		options.mode === "GCM"
			? `${ENCRYPTION11_NS}aes${options.bits}-gcm`
			: `${ENCRYPTION_NS}aes${options.bits}-cbc`;

	return {
		name: "saml:EncryptedAssertion",
		attributes: {},
		children: [
			{
				name: "xenc:EncryptedData",
				attributes: { "xmlns:xenc": ENCRYPTION_NS, Type: `${ENCRYPTION_NS}Element` },
				children: [
					{
						name: "xenc:EncryptionMethod",
						attributes: { Algorithm: contentAlgorithm },
						children: [],
					},
					{
						name: "ds:KeyInfo",
						attributes: { "xmlns:ds": SIGNATURE_NS },
						children: [
							{
								name: "xenc:EncryptedKey",
								attributes: {},
								children: [
									{
										name: "xenc:EncryptionMethod",
										attributes: { Algorithm: `${ENCRYPTION_NS}rsa-oaep-mgf1p` },
										children: [],
									},
									cipherData(new Uint8Array(wrapped)),
								],
							},
						],
					},
					cipherData(payload),
				],
			},
		],
	};
}

/** Wraps a payload in the cipher data element that carries it. */
function cipherData(bytes: Uint8Array): XML.Element {
	return {
		name: "xenc:CipherData",
		attributes: {},
		children: [{ name: "xenc:CipherValue", attributes: {}, children: [Base64.encode(bytes)] }],
	};
}

/** Encrypts in GCM, with the nonce leading the ciphertext as the standard lays it out. */
async function encryptGcm(key: CryptoKey, plaintext: string): Promise<Uint8Array<ArrayBuffer>> {
	let iv = randomBytes(GCM_NONCE_LENGTH);
	let ciphertext = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv, tagLength: 128 },
		key,
		new TextEncoder().encode(plaintext),
	);

	return concat(iv, new Uint8Array(ciphertext));
}

/**
 * Encrypts in CBC with the random padding XML Encryption specifies, which the
 * platform cannot emit: the plaintext is padded by hand to a whole number of
 * blocks, and the extra block the platform then adds is dropped, leaving the
 * encryption of exactly the hand-padded bytes.
 */
async function encryptCbc(key: CryptoKey, plaintext: string): Promise<Uint8Array<ArrayBuffer>> {
	let iv = randomBytes(AES_BLOCK_LENGTH);
	let body = new TextEncoder().encode(plaintext);

	let length = AES_BLOCK_LENGTH - (body.byteLength % AES_BLOCK_LENGTH);
	let padded = concat(concat(body, randomBytes(length - 1)), Uint8Array.of(length));

	let encrypted = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, key, padded);
	let blocks = new Uint8Array(encrypted).subarray(0, padded.byteLength);

	return concat(iv, blocks);
}

/** Joins two byte runs, which building a framed payload does at every step. */
function concat(left: Uint8Array, right: Uint8Array): Uint8Array<ArrayBuffer> {
	let joined = new Uint8Array(new ArrayBuffer(left.byteLength + right.byteLength));
	joined.set(left);
	joined.set(right, left.byteLength);
	return joined;
}
