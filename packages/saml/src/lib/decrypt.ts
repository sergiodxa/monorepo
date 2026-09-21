/**
 * Opens an `EncryptedAssertion`: the session key out of the RSA-OAEP transport
 * block, then the assertion out of AES. Every outcome past the first key
 * operation is one value, so nothing a caller does with a rejection answers a
 * question on the cipher's behalf.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { SAMLError } from "../errors.js";

import {
	DecryptionFailedError,
	MalformedDocumentError,
	UnsupportedFeatureError,
} from "../errors.js";

import type { Element } from "./tree.js";

import { decodeBase64Text, toBufferSource } from "./bytes.js";
import { ENCRYPTION_NS, SIGNATURE_NS } from "./namespaces.js";
import { attribute, child, text, walk } from "./tree.js";

/** XML Encryption 1.1, where the GCM content algorithms are named. */
const ENCRYPTION11_NS = "http://www.w3.org/2009/xmlenc11#";

/** How many bytes of a GCM payload are the nonce, ahead of the ciphertext. */
const GCM_NONCE_LENGTH = 12;

/** How many bytes of a CBC payload are the initialization vector. */
const CBC_IV_LENGTH = 16;

/** The AES block size, which a CBC payload is a whole number of. */
const AES_BLOCK_LENGTH = 16;

/**
 * Content encryption algorithms accepted in an `EncryptedData`, mapped to the
 * mode they run in. Every entry is AES; the sizes are the ones providers emit.
 */
const CONTENT_ALGORITHMS: Record<string, "GCM" | "CBC"> = {
	[`${ENCRYPTION_NS}aes128-cbc`]: "CBC",
	[`${ENCRYPTION_NS}aes256-cbc`]: "CBC",
	[`${ENCRYPTION11_NS}aes128-gcm`]: "GCM",
	[`${ENCRYPTION11_NS}aes256-gcm`]: "GCM",
};

/** Key transport algorithms accepted in an `EncryptedKey`, both RSA-OAEP. */
const TRANSPORT_ALGORITHMS = new Set([
	`${ENCRYPTION_NS}rsa-oaep-mgf1p`,
	`${ENCRYPTION11_NS}rsa-oaep`,
]);

/**
 * Decrypts an `EncryptedAssertion` into the XML it stands for.
 *
 * Each key is tried in turn, which is what lets a service provider accept an
 * assertion encrypted to either half of a key rotation, and what lets one
 * private key be presented under both OAEP digests providers emit.
 *
 * @param encrypted - The `saml:EncryptedAssertion` element
 * @param keys - Private keys the service provider holds
 * @returns The decrypted assertion as XML text, or the one decryption failure
 */
export async function decryptAssertion(
	encrypted: Element,
	keys: readonly CryptoKey[],
): Promise<Result<string, SAMLError>> {
	let data = child(encrypted, ENCRYPTION_NS, "EncryptedData");
	if (!data) {
		return failure(new MalformedDocumentError("EncryptedAssertion carries no EncryptedData"));
	}

	let mode = readContentAlgorithm(data);
	if (mode.status === "failure") return mode;

	let wrapped = readWrappedKey(encrypted, data);
	if (wrapped.status === "failure") return wrapped;

	let payload = readCipherValue(data);
	if (payload.status === "failure") return payload;

	for (let key of keys) {
		let session = await crypto.subtle
			.decrypt({ name: "RSA-OAEP" }, key, toBufferSource(wrapped.data))
			.catch(() => null);
		if (!session) continue;

		let plaintext = await decryptContent(mode.data, new Uint8Array(session), payload.data);
		if (plaintext) return success(plaintext);
	}

	return failure(new DecryptionFailedError());
}

/**
 * Reads the mode the content was encrypted in, refusing anything that is not
 * AES in GCM or CBC, so a tenant reads which algorithm to change rather than
 * meeting the single decryption failure every later step answers with.
 */
function readContentAlgorithm(data: Element): Result<"GCM" | "CBC", SAMLError> {
	let method = child(data, ENCRYPTION_NS, "EncryptionMethod");
	if (!method) {
		return failure(new MalformedDocumentError("EncryptedData carries no EncryptionMethod"));
	}

	let mode = CONTENT_ALGORITHMS[attribute(method, "Algorithm") ?? ""];
	if (!mode) {
		return failure(
			new UnsupportedFeatureError(
				"content encryption",
				"only AES-128 and AES-256 in GCM or CBC are decrypted",
			),
		);
	}

	return success(mode);
}

/**
 * Reads the transported session key, which providers place either inside the
 * encrypted data's own key info or beside it under the encrypted assertion.
 */
function readWrappedKey(encrypted: Element, data: Element): Result<Uint8Array, SAMLError> {
	let transport: Element | undefined;
	for (let candidate of walk(encrypted)) {
		if (candidate.uri === ENCRYPTION_NS && candidate.local === "EncryptedKey") {
			transport = candidate;
			break;
		}
	}

	if (!transport) {
		let keyInfo = child(data, SIGNATURE_NS, "KeyInfo");
		transport = keyInfo ? child(keyInfo, ENCRYPTION_NS, "EncryptedKey") : undefined;
	}

	if (!transport) {
		return failure(new MalformedDocumentError("EncryptedAssertion carries no EncryptedKey"));
	}

	let method = child(transport, ENCRYPTION_NS, "EncryptionMethod");
	if (!method || !TRANSPORT_ALGORITHMS.has(attribute(method, "Algorithm") ?? "")) {
		return failure(
			new UnsupportedFeatureError("key transport", "only RSA-OAEP key transport is decrypted"),
		);
	}

	return readCipherValue(transport);
}

/**
 * Reads the base64 payload out of an element's cipher data.
 */
function readCipherValue(element: Element): Result<Uint8Array, SAMLError> {
	let cipherData = child(element, ENCRYPTION_NS, "CipherData");
	let cipherValue = cipherData ? child(cipherData, ENCRYPTION_NS, "CipherValue") : undefined;
	if (!cipherValue)
		return failure(new MalformedDocumentError("cipher data carries no CipherValue"));

	return decodeBase64Text(text(cipherValue), "CipherValue");
}

/**
 * Decrypts the content under a session key, answering `null` for every failure
 * so the caller has one outcome to report whatever went wrong.
 */
async function decryptContent(
	mode: "GCM" | "CBC",
	session: Uint8Array,
	payload: Uint8Array,
): Promise<string | null> {
	let usages: KeyUsage[] = mode === "CBC" ? ["encrypt", "decrypt"] : ["decrypt"];
	let key = await crypto.subtle
		.importKey("raw", toBufferSource(session), { name: `AES-${mode}` }, false, usages)
		.catch(() => null);
	if (!key) return null;

	let plaintext = mode === "GCM" ? await decryptGcm(key, payload) : await decryptCbc(key, payload);
	if (!plaintext) return null;

	return new TextDecoder().decode(plaintext);
}

/**
 * Decrypts a GCM payload, whose nonce leads and whose tag trails the ciphertext
 * in exactly the layout Web Crypto expects to be handed.
 */
async function decryptGcm(key: CryptoKey, payload: Uint8Array): Promise<Uint8Array | null> {
	if (payload.byteLength <= GCM_NONCE_LENGTH) return null;

	let iv = toBufferSource(payload.subarray(0, GCM_NONCE_LENGTH));
	let ciphertext = toBufferSource(payload.subarray(GCM_NONCE_LENGTH));

	let plaintext = await crypto.subtle
		.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, ciphertext)
		.catch(() => null);

	return plaintext ? new Uint8Array(plaintext) : null;
}

/**
 * Decrypts a CBC payload, whose trailing block XML Encryption pads with random
 * bytes rather than the repeated length Web Crypto insists on. Appending one
 * block that decrypts to a full valid padding lets the platform strip that
 * block instead, leaving the real padding to be measured by its last byte.
 */
async function decryptCbc(key: CryptoKey, payload: Uint8Array): Promise<Uint8Array | null> {
	let ciphertext = payload.subarray(CBC_IV_LENGTH);
	if (ciphertext.byteLength === 0 || ciphertext.byteLength % AES_BLOCK_LENGTH !== 0) return null;

	let iv = toBufferSource(payload.subarray(0, CBC_IV_LENGTH));
	let lastBlock = toBufferSource(ciphertext.subarray(ciphertext.byteLength - AES_BLOCK_LENGTH));
	let fullPad = new Uint8Array(new ArrayBuffer(AES_BLOCK_LENGTH)).fill(AES_BLOCK_LENGTH);

	let encoded = await crypto.subtle
		.encrypt({ name: "AES-CBC", iv: lastBlock }, key, fullPad)
		.catch(() => null);
	if (!encoded) return null;

	let extended = new Uint8Array(new ArrayBuffer(ciphertext.byteLength + AES_BLOCK_LENGTH));
	extended.set(ciphertext);
	extended.set(new Uint8Array(encoded).subarray(0, AES_BLOCK_LENGTH), ciphertext.byteLength);

	let padded = await crypto.subtle
		.decrypt({ name: "AES-CBC", iv }, key, extended)
		.catch(() => null);
	if (!padded) return null;

	return stripPadding(new Uint8Array(padded));
}

/**
 * Removes the trailing padding XML Encryption describes, whose final byte is
 * the only part of it with a fixed meaning.
 */
function stripPadding(plaintext: Uint8Array): Uint8Array | null {
	let length = plaintext[plaintext.byteLength - 1] ?? 0;
	if (length < 1 || length > AES_BLOCK_LENGTH || length > plaintext.byteLength) return null;
	return plaintext.subarray(0, plaintext.byteLength - length);
}
