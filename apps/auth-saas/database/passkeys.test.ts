/**
 * Drives `passkeys.ts` directly against a `Database` over a real SQLite-backed
 * `SqlStorage`, the way `subjects.test.ts` drives the tenant object's subject
 * methods, but without going through the Durable Object class: nothing here can wire
 * a new RPC method onto it, so the functions are exercised the same way the object
 * will eventually call them.
 *
 * A software authenticator built on WebCrypto produces the exact bytes a real one
 * does — CBOR attestation, a DER signature, an advancing counter — mirroring the
 * fixture `@sdxc/passkey`'s own relying-party tests use, so `RelyingParty` is
 * exercised through real ceremonies rather than through fixtures of itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Bytes } from "@sdxc/crypto";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { Base64Url, concatBytes, randomBytes, sha256 } from "@sdxc/crypto";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { unwrap } from "@sdxc/result";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import { readAuditPage } from "./audit-events";
import { createDauCache } from "./metering";
import {
	beginPasskeyAuthentication,
	beginPasskeyRegistration,
	enrolPasskey,
	passkeyChallenges,
	passkeys,
	renamePasskey,
	revokePasskey,
	signInWithPasskey,
	sweepExpiredPasskeyChallenges,
} from "./passkeys";
import { addIdentifier, createSubject, verifyIdentifier } from "./subjects";
import { runMigrations } from "./tenant-migrations";
import passkeysMigration from "./tenant-migrations/0004-passkeys.sql?raw";

const RELYING_PARTY_ID = "tenant.example.com";
const ORIGINS = [`https://${RELYING_PARTY_ID}`];

let db: Database;

beforeEach(async () => {
	let state = createDurableObjectState();
	let driver = createSQLStorageDatabaseAdapter(state.storage.sql);
	await runMigrations(driver);
	await driver.executeScript(passkeysMigration);
	db = new Database(driver);
});

/** Writes the CBOR header naming a major type and its argument. */
function header(major: number, argument: number): Bytes {
	if (argument < 24) return Uint8Array.of((major << 5) | argument);
	if (argument < 0x100) return Uint8Array.of((major << 5) | 24, argument);
	if (argument < 0x10000) {
		return Uint8Array.of((major << 5) | 25, argument >> 8, argument & 0xff);
	}
	let bytes = new Uint8Array(5);
	bytes[0] = (major << 5) | 26;
	new DataView(bytes.buffer).setUint32(1, argument);
	return bytes;
}

/** Encodes the CBOR subset the WebAuthn structures in these tests need. */
function cbor(value: unknown): Bytes {
	if (typeof value === "number") {
		return value < 0 ? header(1, -1 - value) : header(0, value);
	}
	if (typeof value === "string") {
		let text = new TextEncoder().encode(value);
		return concatBytes(header(3, text.length), text);
	}
	if (value instanceof Uint8Array) return concatBytes(header(2, value.length), value);
	if (Array.isArray(value)) {
		return concatBytes(header(4, value.length), ...value.map((item) => cbor(item)));
	}
	if (value instanceof Map) {
		let parts = [header(5, value.size)];
		for (let [key, item] of value) parts.push(cbor(key), cbor(item));
		return concatBytes(...parts);
	}
	throw new TypeError("unsupported CBOR value");
}

/** Rewrites a raw `r || s` signature as the DER form authenticators emit. */
function toDer(raw: Bytes): Bytes {
	let integer = (half: Bytes) => {
		let value = half;
		while (value.length > 1 && value[0] === 0) value = value.subarray(1);
		let padded = (value[0] as number) & 0x80 ? concatBytes(Uint8Array.of(0), value) : value;
		return concatBytes(Uint8Array.of(0x02, padded.length), padded);
	};
	let body = concatBytes(integer(raw.subarray(0, 32)), integer(raw.subarray(32)));
	return concatBytes(Uint8Array.of(0x30, body.length), body);
}

/** Flag bits an authenticator sets on the data it signs. */
const FLAGS = {
	present: 0x01,
	verified: 0x04,
	backupEligible: 0x08,
	backedUp: 0x10,
	attested: 0x40,
};

/** A software authenticator holding one credential, as a platform one would. */
class Authenticator {
	counter = 0;

	/** User handle the assertion reports, set once a registration names one. */
	userHandle: string | undefined;

	private constructor(
		private keys: CryptoKeyPair,
		private cose: Bytes,
		readonly credentialId: Bytes,
	) {}

	/** Mints a fresh P-256 credential, the shape every passkey platform uses. */
	static async create(): Promise<Authenticator> {
		let keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
			"sign",
			"verify",
		]);
		let jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
		let cose = cbor(
			new Map<number, unknown>([
				[1, 2],
				[3, -7],
				[-1, 1],
				[-2, unwrap(Base64Url.decode(jwk.x as string))],
				[-3, unwrap(Base64Url.decode(jwk.y as string))],
			]),
		);
		return new Authenticator(keys, cose, randomBytes(16));
	}

	/** Builds the authenticator data both ceremonies sign. */
	private async authenticatorData(rpId: string, attested: boolean): Promise<Bytes> {
		let rpIdHash = unwrap(await sha256(rpId));
		let flags =
			FLAGS.present |
			FLAGS.verified |
			FLAGS.backupEligible |
			FLAGS.backedUp |
			(attested ? FLAGS.attested : 0);
		let prefix = new Uint8Array(5);
		prefix[0] = flags;
		new DataView(prefix.buffer).setUint32(1, this.counter);
		if (!attested) return concatBytes(rpIdHash, prefix);

		let idLength = new Uint8Array(2);
		new DataView(idLength.buffer).setUint16(0, this.credentialId.length);
		return concatBytes(
			rpIdHash,
			prefix,
			new Uint8Array(16),
			idLength,
			this.credentialId,
			this.cose,
		);
	}

	/** Serializes the client data the browser signs alongside the authenticator. */
	private clientData(type: string, challenge: string, origin: string): Bytes {
		return new TextEncoder().encode(
			JSON.stringify({ type, challenge, origin, crossOrigin: false }),
		);
	}

	/** Runs a registration ceremony against the options a relying party issued. */
	async register(
		options: PublicKeyCredentialCreationOptionsJSON,
		origin = `https://${options.rp.id}`,
	): Promise<RegistrationResponseJSON> {
		let clientDataJSON = this.clientData("webauthn.create", options.challenge, origin);
		let authData = await this.authenticatorData(options.rp.id as string, true);
		let attestationObject = cbor(
			new Map<string, unknown>([
				["fmt", "none"],
				["attStmt", new Map()],
				["authData", authData],
			]),
		);

		return {
			id: Base64Url.encode(this.credentialId),
			rawId: Base64Url.encode(this.credentialId),
			type: "public-key",
			clientExtensionResults: {},
			response: {
				clientDataJSON: Base64Url.encode(clientDataJSON),
				attestationObject: Base64Url.encode(attestationObject),
				authenticatorData: Base64Url.encode(authData),
				publicKeyAlgorithm: -7,
				transports: ["internal", "hybrid"],
			},
		};
	}

	/** Runs an assertion ceremony, advancing the signature counter as a key does. */
	async authenticate(
		options: PublicKeyCredentialRequestOptionsJSON,
		origin = `https://${options.rpId}`,
	): Promise<AuthenticationResponseJSON> {
		this.counter += 1;
		let clientDataJSON = this.clientData("webauthn.get", options.challenge, origin);
		let authData = await this.authenticatorData(options.rpId as string, false);
		let signed = concatBytes(authData, unwrap(await sha256(clientDataJSON)));
		let raw = new Uint8Array(
			await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, this.keys.privateKey, signed),
		);

		return {
			id: Base64Url.encode(this.credentialId),
			rawId: Base64Url.encode(this.credentialId),
			type: "public-key",
			clientExtensionResults: {},
			response: {
				clientDataJSON: Base64Url.encode(clientDataJSON),
				authenticatorData: Base64Url.encode(authData),
				signature: Base64Url.encode(toDer(raw)),
				userHandle: Base64Url.encode(this.userHandle ?? ""),
			},
		};
	}
}

/** Creates a subject with one verified email, the shape most tests enroll a passkey for. */
async function createTestSubject(email = "ana@example.com"): Promise<string> {
	let created = await createSubject(db, { identifiers: [{ kind: "email", value: email }] });
	if (!created.ok) throw new Error("unreachable");
	return created.subjectId;
}

/** Runs a full registration ceremony for a subject and returns the stored credential. */
async function enrolTestPasskey(subjectId: string, authenticator: Authenticator) {
	let begun = await beginPasskeyRegistration(db, {
		subjectId,
		relyingPartyId: RELYING_PARTY_ID,
		origins: ORIGINS,
	});
	if (!begun.ok) throw new Error("unreachable");

	authenticator.userHandle = new TextDecoder().decode(
		unwrap(Base64Url.decode(begun.options.user.id)),
	);

	let response = await authenticator.register(begun.options);
	let enrolled = await enrolPasskey(db, {
		ceremonyId: begun.ceremonyId,
		response,
		relyingPartyId: RELYING_PARTY_ID,
		origins: ORIGINS,
	});
	if (!enrolled.ok) throw new Error(`unreachable: ${JSON.stringify(enrolled)}`);
	return enrolled.passkey;
}

describe("beginPasskeyRegistration", () => {
	test("refuses an unknown subject", async () => {
		let result = await beginPasskeyRegistration(db, {
			subjectId: "sub_missing",
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
		});

		expect(result).toEqual({ ok: false, reason: "not-found" });
	});

	test("excludes the subject's existing credentials", async () => {
		let subjectId = await createTestSubject();
		let authenticator = await Authenticator.create();
		let first = await enrolTestPasskey(subjectId, authenticator);

		let second = await beginPasskeyRegistration(db, {
			subjectId,
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
		});
		if (!second.ok) throw new Error("unreachable");

		expect(second.options.excludeCredentials?.map((entry) => entry.id)).toEqual([
			first.credentialId,
		]);
	});
});

describe("registration and enrollment", () => {
	test("registers a credential end-to-end", async () => {
		let subjectId = await createTestSubject();
		let authenticator = await Authenticator.create();

		let passkey = await enrolTestPasskey(subjectId, authenticator);

		expect(passkey.label).toBe("Passkey");
		expect(passkey.transports).toEqual(["internal", "hybrid"]);
		expect(passkey.syncable).toBe(true);
		expect(passkey.backedUp).toBe(true);

		let row = await db.find(passkeys, { credential_id: passkey.credentialId });
		expect(row?.subject_id).toBe(subjectId);
		expect(row?.suspended).toBe(false);
	});

	test("labels the credential from the enrolling User-Agent when no label is given", async () => {
		let subjectId = await createTestSubject();
		let authenticator = await Authenticator.create();

		let begun = await beginPasskeyRegistration(db, {
			subjectId,
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
		});
		if (!begun.ok) throw new Error("unreachable");

		let response = await authenticator.register(begun.options);
		let enrolled = await enrolPasskey(db, {
			ceremonyId: begun.ceremonyId,
			response,
			userAgent:
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36",
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
		});

		expect(enrolled).toMatchObject({ ok: true, passkey: { label: "Chrome on Windows" } });
	});

	test("the challenge is single-use", async () => {
		let subjectId = await createTestSubject();
		let authenticator = await Authenticator.create();

		let begun = await beginPasskeyRegistration(db, {
			subjectId,
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
		});
		if (!begun.ok) throw new Error("unreachable");

		let response = await authenticator.register(begun.options);

		let first = await enrolPasskey(db, {
			ceremonyId: begun.ceremonyId,
			response,
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
		});
		expect(first.ok).toBe(true);

		let replay = await enrolPasskey(db, {
			ceremonyId: begun.ceremonyId,
			response,
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
		});
		expect(replay).toEqual({ ok: false, reason: "invalid-ceremony" });
	});

	test("refuses an expired ceremony", async () => {
		let subjectId = await createTestSubject();
		let authenticator = await Authenticator.create();

		let begun = await beginPasskeyRegistration(db, {
			subjectId,
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
		});
		if (!begun.ok) throw new Error("unreachable");

		await db.update(
			passkeyChallenges,
			{ ceremony_id: begun.ceremonyId },
			{ expires_at: Date.now() - 1 },
		);

		let response = await authenticator.register(begun.options);
		let result = await enrolPasskey(db, {
			ceremonyId: begun.ceremonyId,
			response,
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
		});

		expect(result).toEqual({ ok: false, reason: "expired-ceremony" });
	});
});

describe("signInWithPasskey", () => {
	test("authenticates end-to-end", async () => {
		let subjectId = await createTestSubject();
		let authenticator = await Authenticator.create();
		await enrolTestPasskey(subjectId, authenticator);

		let begun = await beginPasskeyAuthentication(db, {
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
		});

		let response = await authenticator.authenticate(begun.options);
		let result = await signInWithPasskey(db, {
			ceremonyId: begun.ceremonyId,
			response,
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
			remembered: false,
		});

		expect(result).toMatchObject({ ok: true, subjectId, userVerified: true });

		let row = await db.find(passkeys, { credential_id: response.id });
		expect(row?.counter).toBe(1);
		expect(row?.last_used_at).toEqual(expect.any(Number));
	});

	test("the challenge is single-use", async () => {
		let subjectId = await createTestSubject();
		let authenticator = await Authenticator.create();
		await enrolTestPasskey(subjectId, authenticator);

		let begun = await beginPasskeyAuthentication(db, {
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
		});
		let response = await authenticator.authenticate(begun.options);

		let first = await signInWithPasskey(db, {
			ceremonyId: begun.ceremonyId,
			response,
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
			remembered: false,
		});
		expect(first.ok).toBe(true);

		let replay = await signInWithPasskey(db, {
			ceremonyId: begun.ceremonyId,
			response,
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
			remembered: false,
		});
		expect(replay).toEqual({ ok: false, reason: "invalid-ceremony" });
	});

	test("refuses a tampered assertion distinctly from a counter regression", async () => {
		let subjectId = await createTestSubject();
		let authenticator = await Authenticator.create();
		await enrolTestPasskey(subjectId, authenticator);

		let begun = await beginPasskeyAuthentication(db, {
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
		});
		let response = await authenticator.authenticate(begun.options);
		let signature = unwrap(Base64Url.decode(response.response.signature));
		let tampered = Uint8Array.from(signature, (byte, index) =>
			index === signature.length - 1 ? byte ^ 0xff : byte,
		);
		response.response.signature = Base64Url.encode(tampered);

		let result = await signInWithPasskey(db, {
			ceremonyId: begun.ceremonyId,
			response,
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
			remembered: false,
		});

		expect(result).toEqual({
			ok: false,
			reason: "verification-failed",
			error: "SignatureError",
		});
	});

	test("suspends the credential on a counter regression, distinctly from a plain failure", async () => {
		let subjectId = await createTestSubject();
		let authenticator = await Authenticator.create();
		let passkey = await enrolTestPasskey(subjectId, authenticator);

		// Forces the next assertion's counter, which the authenticator advances from 0
		// to 1, to land at or below what is stored — the one signal WebAuthn gives that
		// a credential was cloned.
		await db.update(passkeys, { credential_id: passkey.credentialId }, { counter: 100 });

		let begun = await beginPasskeyAuthentication(db, {
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
		});
		let response = await authenticator.authenticate(begun.options);

		let result = await signInWithPasskey(db, {
			ceremonyId: begun.ceremonyId,
			response,
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
			remembered: false,
		});

		expect(result).toEqual({ ok: false, reason: "counter-regression" });

		let row = await db.find(passkeys, { credential_id: passkey.credentialId });
		expect(row?.suspended).toBe(true);

		let retryBegun = await beginPasskeyAuthentication(db, {
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
		});
		let retryResponse = await authenticator.authenticate(retryBegun.options);
		let retry = await signInWithPasskey(db, {
			ceremonyId: retryBegun.ceremonyId,
			response: retryResponse,
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
			remembered: false,
		});

		expect(retry).toEqual({ ok: false, reason: "credential-suspended" });
	});

	describe("metering", () => {
		test("a sign-in under cap succeeds and carries the day's metering report", async () => {
			let subjectId = await createTestSubject();
			let authenticator = await Authenticator.create();
			await enrolTestPasskey(subjectId, authenticator);
			let cache = createDauCache();

			let begun = await beginPasskeyAuthentication(db, {
				relyingPartyId: RELYING_PARTY_ID,
				origins: ORIGINS,
			});
			let response = await authenticator.authenticate(begun.options);

			let result = await signInWithPasskey(
				db,
				{
					ceremonyId: begun.ceremonyId,
					response,
					relyingPartyId: RELYING_PARTY_ID,
					origins: ORIGINS,
					remembered: false,
				},
				{ cache, cap: 100, hard: true },
			);

			expect(result).toMatchObject({
				ok: true,
				subjectId,
				metering: { subjects: 1, cap: 100, notice: "none" },
			});
		});

		test("refuses a genuinely new subject once a hard cap is reached", async () => {
			let counted = await createTestSubject("ana@example.com");
			let countedAuthenticator = await Authenticator.create();
			await enrolTestPasskey(counted, countedAuthenticator);

			let refused = await createTestSubject("bo@example.com");
			let refusedAuthenticator = await Authenticator.create();
			await enrolTestPasskey(refused, refusedAuthenticator);

			let cache = createDauCache();

			let countedBegun = await beginPasskeyAuthentication(db, {
				relyingPartyId: RELYING_PARTY_ID,
				origins: ORIGINS,
			});
			let countedResponse = await countedAuthenticator.authenticate(countedBegun.options);
			await signInWithPasskey(
				db,
				{
					ceremonyId: countedBegun.ceremonyId,
					response: countedResponse,
					relyingPartyId: RELYING_PARTY_ID,
					origins: ORIGINS,
					remembered: false,
				},
				{ cache, cap: 1, hard: true },
			);

			let refusedBegun = await beginPasskeyAuthentication(db, {
				relyingPartyId: RELYING_PARTY_ID,
				origins: ORIGINS,
			});
			let refusedResponse = await refusedAuthenticator.authenticate(refusedBegun.options);
			let result = await signInWithPasskey(
				db,
				{
					ceremonyId: refusedBegun.ceremonyId,
					response: refusedResponse,
					relyingPartyId: RELYING_PARTY_ID,
					origins: ORIGINS,
					remembered: false,
				},
				{ cache, cap: 1, hard: true },
			);

			expect(result).toEqual({ ok: false, reason: "dau_cap_reached" });
		});

		test("never refuses a subject already counted today, even past the cap", async () => {
			let subjectId = await createTestSubject();
			let authenticator = await Authenticator.create();
			await enrolTestPasskey(subjectId, authenticator);
			let cache = createDauCache();

			let firstBegun = await beginPasskeyAuthentication(db, {
				relyingPartyId: RELYING_PARTY_ID,
				origins: ORIGINS,
			});
			let firstResponse = await authenticator.authenticate(firstBegun.options);
			await signInWithPasskey(
				db,
				{
					ceremonyId: firstBegun.ceremonyId,
					response: firstResponse,
					relyingPartyId: RELYING_PARTY_ID,
					origins: ORIGINS,
					remembered: false,
				},
				{ cache, cap: 1, hard: true },
			);

			let secondBegun = await beginPasskeyAuthentication(db, {
				relyingPartyId: RELYING_PARTY_ID,
				origins: ORIGINS,
			});
			let secondResponse = await authenticator.authenticate(secondBegun.options);
			let second = await signInWithPasskey(
				db,
				{
					ceremonyId: secondBegun.ceremonyId,
					response: secondResponse,
					relyingPartyId: RELYING_PARTY_ID,
					origins: ORIGINS,
					remembered: false,
				},
				{ cache, cap: 1, hard: true },
			);

			expect(second).toMatchObject({ ok: true, subjectId });
		});
	});
});

describe("renamePasskey", () => {
	test("renames a credential owned by the subject", async () => {
		let subjectId = await createTestSubject();
		let authenticator = await Authenticator.create();
		let passkey = await enrolTestPasskey(subjectId, authenticator);

		let result = await renamePasskey(db, {
			subjectId,
			credentialId: passkey.credentialId,
			label: "Work laptop",
		});

		expect(result).toEqual({ ok: true });

		let row = await db.find(passkeys, { credential_id: passkey.credentialId });
		expect(row?.label).toBe("Work laptop");
	});

	test("refuses a credential belonging to another subject", async () => {
		let owner = await createTestSubject("owner@example.com");
		let stranger = await createTestSubject("stranger@example.com");
		let authenticator = await Authenticator.create();
		let passkey = await enrolTestPasskey(owner, authenticator);

		let result = await renamePasskey(db, {
			subjectId: stranger,
			credentialId: passkey.credentialId,
			label: "Not mine",
		});

		expect(result).toEqual({ ok: false, reason: "not-found" });

		let row = await db.find(passkeys, { credential_id: passkey.credentialId });
		expect(row?.label).not.toBe("Not mine");
	});
});

describe("revokePasskey", () => {
	test("refuses to remove a subject's last remaining credential", async () => {
		let subjectId = await createTestSubject();
		let authenticator = await Authenticator.create();
		let passkey = await enrolTestPasskey(subjectId, authenticator);

		let result = await revokePasskey(db, { subjectId, credentialId: passkey.credentialId });

		expect(result).toEqual({ ok: false, reason: "last-credential" });

		let row = await db.find(passkeys, { credential_id: passkey.credentialId });
		expect(row).not.toBeNull();
	});

	test("removes a passkey once another passkey remains", async () => {
		let subjectId = await createTestSubject();
		let first = await enrolTestPasskey(subjectId, await Authenticator.create());
		let second = await enrolTestPasskey(subjectId, await Authenticator.create());

		let result = await revokePasskey(db, { subjectId, credentialId: first.credentialId });

		expect(result).toEqual({ ok: true });
		expect(await db.find(passkeys, { credential_id: first.credentialId })).toBeNull();
		expect(await db.find(passkeys, { credential_id: second.credentialId })).not.toBeNull();
	});

	test("removes a subject's only passkey once a verified identifier remains", async () => {
		let subjectId = await createTestSubject();
		let passkey = await enrolTestPasskey(subjectId, await Authenticator.create());

		// `createTestSubject` claims its email unverified; proving it is what makes it
		// count as a remaining way to sign in, through `subjects.ts`'s own view of the
		// subject's identifiers.
		let added = await addIdentifier(db, {
			subjectId,
			kind: "email",
			value: "verified@example.com",
			actor: { kind: "admin" },
		});
		if (!added.ok || added.kind !== "email") throw new Error("unreachable");
		await verifyIdentifier(db, { ticket: added.ticket });

		let result = await revokePasskey(db, { subjectId, credentialId: passkey.credentialId });

		expect(result).toEqual({ ok: true });
	});
});

describe("sweepExpiredPasskeyChallenges", () => {
	test("clears expired challenges and leaves live ones", async () => {
		let subjectId = await createTestSubject();

		let live = await beginPasskeyRegistration(db, {
			subjectId,
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
		});
		if (!live.ok) throw new Error("unreachable");

		let expiring = await beginPasskeyAuthentication(db, {
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
		});
		await db.update(
			passkeyChallenges,
			{ ceremony_id: expiring.ceremonyId },
			{ expires_at: Date.now() - 1 },
		);

		let swept = await sweepExpiredPasskeyChallenges(db);

		expect(swept).toEqual({ swept: 1 });
		expect(await db.find(passkeyChallenges, { ceremony_id: expiring.ceremonyId })).toBeNull();
		expect(await db.find(passkeyChallenges, { ceremony_id: live.ceremonyId })).not.toBeNull();
	});
});

describe("audit", () => {
	async function auditRowsFor(action: string) {
		let page = await readAuditPage(db, { from: 0, to: Date.now() + 60_000, action });
		if (!page.ok) throw new Error("unreachable");
		return page.events;
	}

	test("passkey.enrolled lands when a credential is registered", async () => {
		let subjectId = await createTestSubject();
		let passkey = await enrolTestPasskey(subjectId, await Authenticator.create());

		let rows = await auditRowsFor("passkey.enrolled");
		expect(rows).toMatchObject([
			{
				actorType: "subject",
				actorId: subjectId,
				outcome: "succeeded",
				detail: { credentialId: passkey.credentialId },
			},
		]);
	});

	test("passkey.renamed lands when a label is changed", async () => {
		let subjectId = await createTestSubject();
		let passkey = await enrolTestPasskey(subjectId, await Authenticator.create());

		await renamePasskey(db, {
			subjectId,
			credentialId: passkey.credentialId,
			label: "Work laptop",
		});

		let rows = await auditRowsFor("passkey.renamed");
		expect(rows).toMatchObject([{ targetId: subjectId, detail: { label: "Work laptop" } }]);
	});

	test("passkey.revoked lands when a credential is removed", async () => {
		let subjectId = await createTestSubject();
		let first = await enrolTestPasskey(subjectId, await Authenticator.create());
		await enrolTestPasskey(subjectId, await Authenticator.create());

		await revokePasskey(db, { subjectId, credentialId: first.credentialId });

		let rows = await auditRowsFor("passkey.revoked");
		expect(rows).toMatchObject([
			{ targetId: subjectId, detail: { credentialId: first.credentialId } },
		]);
	});

	test("authentication.succeeded lands on a verified assertion", async () => {
		let subjectId = await createTestSubject();
		let authenticator = await Authenticator.create();
		await enrolTestPasskey(subjectId, authenticator);

		let begun = await beginPasskeyAuthentication(db, {
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
		});
		let response = await authenticator.authenticate(begun.options);
		await signInWithPasskey(db, {
			ceremonyId: begun.ceremonyId,
			response,
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
			remembered: false,
		});

		let rows = await auditRowsFor("authentication.succeeded");
		expect(rows).toMatchObject([{ actorId: subjectId, outcome: "succeeded" }]);
	});

	test("authentication.denied lands when a suspended credential is presented again", async () => {
		let subjectId = await createTestSubject();
		let authenticator = await Authenticator.create();
		let passkey = await enrolTestPasskey(subjectId, authenticator);

		await db.update(passkeys, { credential_id: passkey.credentialId }, { counter: 100 });

		let begun = await beginPasskeyAuthentication(db, {
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
		});
		let response = await authenticator.authenticate(begun.options);
		await signInWithPasskey(db, {
			ceremonyId: begun.ceremonyId,
			response,
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
			remembered: false,
		});

		let retryBegun = await beginPasskeyAuthentication(db, {
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
		});
		let retryResponse = await authenticator.authenticate(retryBegun.options);
		await signInWithPasskey(db, {
			ceremonyId: retryBegun.ceremonyId,
			response: retryResponse,
			relyingPartyId: RELYING_PARTY_ID,
			origins: ORIGINS,
			remembered: false,
		});

		let rows = await auditRowsFor("authentication.denied");
		expect(rows).toMatchObject([
			{ actorId: subjectId, outcome: "denied" },
			{ actorId: subjectId, outcome: "denied" },
		]);
	});
});
