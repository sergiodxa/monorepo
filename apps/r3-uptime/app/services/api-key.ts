/**
 * API key generation and hashing. Keys look like `uptime_<64 hex chars>` — this exact
 * format and hash must stay byte-identical to what already generated and hashed
 * production keys, or every existing key stops verifying at cutover. Only the
 * SHA-256 hash and a 15-character prefix
 * (enough to display, never enough to guess the rest) are ever persisted — the raw
 * key is shown to the user exactly once, at creation time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

const KEY_PREFIX = "uptime_";
const KEY_RANDOM_BYTES = 32;
/** Length of the displayed prefix: `"uptime_"` plus the first 8 hex characters. */
const DISPLAY_PREFIX_LENGTH = KEY_PREFIX.length + 8;

export interface GeneratedApiKey {
	/** The full plaintext key. Shown to the user once; never stored. */
	key: string;
	/** SHA-256 hex digest of `key`, stored and compared against on every request. */
	keyHash: string;
	/** The first 15 characters of `key`, safe to display in a list. */
	keyPrefix: string;
}

/** Generates a new API key and its stored hash/prefix. */
export async function generateApiKey(): Promise<GeneratedApiKey> {
	let bytes = new Uint8Array(KEY_RANDOM_BYTES);
	crypto.getRandomValues(bytes);
	let key = `${KEY_PREFIX}${toHex(bytes)}`;

	return { key, keyHash: await hashApiKey(key), keyPrefix: key.slice(0, DISPLAY_PREFIX_LENGTH) };
}

/** Hashes a plaintext API key for storage/lookup. */
export async function hashApiKey(key: string): Promise<string> {
	let digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
	return toHex(new Uint8Array(digest));
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}
