/**
 * The RFC 9580 §9 registries this package reads and writes: public-key, hash, symmetric
 * and AEAD algorithm IDs and the curve OIDs, each mapped to the Web Crypto parameters
 * that run it, so every other module asks one table what an ID means.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Public-key algorithm IDs (RFC 9580 §9.1). */
export const PUBLIC_KEY_ALGORITHM = {
	rsa: 1,
	rsaEncryptOnly: 2,
	rsaSignOnly: 3,
	elgamal: 16,
	dsa: 17,
	ecdh: 18,
	ecdsa: 19,
	eddsaLegacy: 22,
	x25519: 25,
	x448: 26,
	ed25519: 27,
	ed448: 28,
} as const;

/**
 * The algorithm names this package reports and accepts: `ed25519` is the v6 algorithm
 * (ID 27), `ed25519-legacy` the deprecated v4 EdDSALegacy form older tools still need.
 */
export type SigningAlgorithm = "ed25519" | "ed25519-legacy" | "ecdsa-p256" | "rsa";

/** Hash algorithm names a signature can be made with. */
export type HashName = "SHA-256" | "SHA-384" | "SHA-512";

/** What a hash ID means to Web Crypto and to a v6 signature. */
export interface HashInfo {
	id: number;
	name: HashName;
	/** The name the cleartext `Hash` armor header uses. */
	textName: string;
	/** Digest length in octets. */
	size: number;
	/** The salt a v6 signature carries with this hash (RFC 9580 Table 23). */
	saltSize: number;
}

/** The hashes this package signs and verifies with, by name. */
export const HASHES: Record<HashName, HashInfo> = {
	"SHA-256": { id: 8, name: "SHA-256", textName: "SHA256", size: 32, saltSize: 16 },
	"SHA-384": { id: 9, name: "SHA-384", textName: "SHA384", size: 48, saltSize: 24 },
	"SHA-512": { id: 10, name: "SHA-512", textName: "SHA512", size: 64, saltSize: 32 },
};

/** Every hash `Hash` armor headers may name, conformant or not usable here. */
export const HASH_TEXT_NAMES = new Set([
	"MD5",
	"SHA1",
	"RIPEMD160",
	"SHA256",
	"SHA384",
	"SHA512",
	"SHA224",
	"SHA3-256",
	"SHA3-512",
]);

/**
 * The hash a signature ID names, or `undefined` for one RFC 9580 forbids for signatures
 * (MD5, SHA-1, RIPEMD-160) or Web Crypto cannot compute (SHA-224, SHA-3).
 *
 * @param id - The hash algorithm ID.
 */
export function hashById(id: number): HashInfo | undefined {
	return Object.values(HASHES).find((hash) => hash.id === id);
}

/** Hash IDs an S2K specifier may use when reading a version 4 key: SHA-1 included. */
export const S2K_HASHES: Record<number, string> = {
	2: "SHA-1",
	8: "SHA-256",
	9: "SHA-384",
	10: "SHA-512",
};

/** A symmetric cipher's AES key length in octets, by algorithm ID (RFC 9580 §9.3). */
export const AES_KEY_SIZES: Record<number, number> = { 7: 16, 8: 24, 9: 32 };

/** The AES ID this package protects new secret keys with. */
export const AES_256 = 9;

/** AEAD mode IDs (RFC 9580 §9.6); Web Crypto runs only GCM. */
export const AEAD_GCM = 3;

/** GCM's nonce length in octets. */
export const GCM_NONCE_SIZE = 12;

/** NIST P-256's curve OID, as a key packet writes it (RFC 9580 Table 19). */
export const P256_OID = Uint8Array.of(0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07);

/** Ed25519Legacy's curve OID, only valid in version 4 keys. */
export const ED25519_LEGACY_OID = Uint8Array.of(
	0x2b,
	0x06,
	0x01,
	0x04,
	0x01,
	0xda,
	0x47,
	0x0f,
	0x01,
);

/** The NIST curves Web Crypto signs on, by OID hex, with their field size in octets. */
export const NIST_CURVES: Record<string, { name: "P-256" | "P-384" | "P-521"; size: number }> = {
	"2a8648ce3d030107": { name: "P-256", size: 32 },
	"2b81040022": { name: "P-384", size: 48 },
	"2b81040023": { name: "P-521", size: 66 },
};

/** Signature type IDs (RFC 9580 §5.2.1) this package creates or checks. */
export const SIGNATURE_TYPE = {
	binary: 0x00,
	text: 0x01,
	positiveCertification: 0x13,
	subkeyBinding: 0x18,
	primaryKeyBinding: 0x19,
	directKey: 0x1f,
	keyRevocation: 0x20,
	subkeyRevocation: 0x28,
	certificationRevocation: 0x30,
} as const;

/** Signature subpacket type IDs (RFC 9580 §5.2.3.7) this package writes or reads. */
export const SUBPACKET = {
	creationTime: 2,
	expirationTime: 3,
	keyExpirationTime: 9,
	preferredSymmetric: 11,
	issuerKeyId: 16,
	preferredHash: 21,
	preferredCompression: 22,
	primaryUserId: 25,
	keyFlags: 27,
	features: 30,
	embeddedSignature: 32,
	issuerFingerprint: 33,
} as const;

/** Key flag bits (RFC 9580 §5.2.3.29) in the first octet. */
export const KEY_FLAG = { certify: 0x01, sign: 0x02 } as const;

/** Packet type IDs (RFC 9580 §5) this package frames. */
export const PACKET_TYPE = {
	signature: 2,
	secretKey: 5,
	publicKey: 6,
	secretSubkey: 7,
	marker: 10,
	trust: 12,
	userId: 13,
	publicSubkey: 14,
	userAttribute: 17,
	padding: 21,
} as const;
