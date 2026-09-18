/**
 * Ceremony tests driven by a software authenticator built on WebCrypto.
 *
 * The authenticator produces the exact bytes a real one does — CBOR attestation
 * objects, DER signatures, a counter that advances — so the relying party is
 * exercised against real ceremonies rather than against fixtures of itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Bytes } from "@sdxc/crypto";

import { Base64Url, concatBytes, randomBytes, sha256 } from "@sdxc/crypto";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	AttestationError,
	ChallengeMismatchError,
	CounterError,
	CrossOriginError,
	CredentialMismatchError,
	OriginMismatchError,
	RelyingPartyMismatchError,
	SignatureError,
	UnsupportedAlgorithmError,
} from "../errors.js";

import { RelyingParty } from "./relying-party.js";

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
	private clientData(type: string, challenge: string, origin: string, crossOrigin = false): Bytes {
		return new TextEncoder().encode(JSON.stringify({ type, challenge, origin, crossOrigin }));
	}

	/** Builds the attestation statement for one of the shapes under test. */
	private async statement(
		attestation: "none" | "packed" | "packedChain" | "noneWithStatement",
		authData: Bytes,
		clientDataJSON: Bytes,
	): Promise<Map<string, unknown>> {
		if (attestation === "none") return new Map();
		if (attestation === "noneWithStatement") return new Map<string, unknown>([["alg", -7]]);

		let signed = concatBytes(authData, unwrap(await sha256(clientDataJSON)));
		let raw = new Uint8Array(
			await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, this.keys.privateKey, signed),
		);
		let entries: [string, unknown][] = [
			["alg", -7],
			["sig", toDer(raw)],
		];
		if (attestation === "packedChain") entries.push(["x5c", [new Uint8Array(4)]]);
		return new Map(entries);
	}

	/**
	 * Runs a registration ceremony against the options a relying party issued.
	 *
	 * `attestation` picks which statement the authenticator wraps the credential
	 * in, so the refusals a malformed or unverifiable one earns can be exercised.
	 */
	async register(
		options: PublicKeyCredentialCreationOptionsJSON,
		origin = `https://${options.rp.id}`,
		attestation: "none" | "packed" | "packedChain" | "noneWithStatement" = "none",
		crossOrigin = false,
	): Promise<RegistrationResponseJSON> {
		let clientDataJSON = this.clientData("webauthn.create", options.challenge, origin, crossOrigin);
		let authData = await this.authenticatorData(options.rp.id as string, true);
		let attestationObject = cbor(
			new Map<string, unknown>([
				["fmt", attestation.startsWith("packed") ? "packed" : "none"],
				["attStmt", await this.statement(attestation, authData, clientDataJSON)],
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
				userHandle: Base64Url.encode("usr_1"),
			},
		};
	}
}

/** Relying party under test, matching the authenticator's default origin. */
function relyingParty() {
	return new RelyingParty({ id: "example.com", name: "Example" });
}

describe("RelyingParty", () => {
	test("registers a credential and then accepts its assertion", async () => {
		let rp = relyingParty();
		let authenticator = await Authenticator.create();

		let ceremony = rp.register({ user: { id: "usr_1", name: "ana@example.com" } });
		let registered = await rp.verifyRegistration(await authenticator.register(ceremony.options), {
			challenge: ceremony.challenge,
		});

		expect(isSuccess(registered)).toBe(true);
		let passkey = unwrap(registered);
		expect(passkey.algorithm).toBe(-7);
		expect(passkey.transports).toEqual(["internal", "hybrid"]);
		expect(passkey.backedUp).toBe(true);
		expect(passkey.syncable).toBe(true);

		let assertion = rp.authenticate({ allow: [passkey.id] });
		let verified = await rp.verifyAuthentication(
			await authenticator.authenticate(assertion.options),
			{ challenge: assertion.challenge, passkey },
		);

		expect(isSuccess(verified)).toBe(true);
		expect(unwrap(verified).counter).toBe(1);
		expect(unwrap(verified).userHandle).toBe(Base64Url.encode("usr_1"));
	});

	test("refuses a response signed for another challenge", async () => {
		let rp = relyingParty();
		let authenticator = await Authenticator.create();
		let ceremony = rp.register({ user: { id: "usr_1", name: "ana@example.com" } });

		let result = await rp.verifyRegistration(await authenticator.register(ceremony.options), {
			challenge: Base64Url.encode(randomBytes(32)),
		});

		expect(isFailure(result)).toBe(true);
		expect(isFailure(result) && result.error).toBeInstanceOf(ChallengeMismatchError);
	});

	test("refuses a ceremony run on another origin", async () => {
		let rp = relyingParty();
		let authenticator = await Authenticator.create();
		let ceremony = rp.register({ user: { id: "usr_1", name: "ana@example.com" } });

		let result = await rp.verifyRegistration(
			await authenticator.register(ceremony.options, "https://evil.example"),
			{ challenge: ceremony.challenge },
		);

		expect(isFailure(result) && result.error).toBeInstanceOf(OriginMismatchError);
	});

	test("refuses a credential bound to another relying party", async () => {
		let rp = relyingParty();
		let authenticator = await Authenticator.create();
		let ceremony = rp.register({ user: { id: "usr_1", name: "ana@example.com" } });
		let response = await authenticator.register(
			{ ...ceremony.options, rp: { id: "other.example", name: "Other" } },
			"https://example.com",
		);

		let result = await rp.verifyRegistration(response, { challenge: ceremony.challenge });

		expect(isFailure(result) && result.error).toBeInstanceOf(RelyingPartyMismatchError);
	});

	test("refuses an assertion whose signature was altered", async () => {
		let rp = relyingParty();
		let authenticator = await Authenticator.create();
		let registration = rp.register({ user: { id: "usr_1", name: "ana@example.com" } });
		let passkey = unwrap(
			await rp.verifyRegistration(await authenticator.register(registration.options), {
				challenge: registration.challenge,
			}),
		);

		let ceremony = rp.authenticate();
		let response = await authenticator.authenticate(ceremony.options);
		let signature = unwrap(Base64Url.decode(response.response.signature));
		let tampered = Uint8Array.from(signature, (byte, index) =>
			index === signature.length - 1 ? byte ^ 0xff : byte,
		);
		response.response.signature = Base64Url.encode(tampered);

		let result = await rp.verifyAuthentication(response, {
			challenge: ceremony.challenge,
			passkey,
		});

		expect(isFailure(result) && result.error).toBeInstanceOf(SignatureError);
	});

	test("refuses an assertion whose counter did not advance", async () => {
		let rp = relyingParty();
		let authenticator = await Authenticator.create();
		let registration = rp.register({ user: { id: "usr_1", name: "ana@example.com" } });
		let passkey = unwrap(
			await rp.verifyRegistration(await authenticator.register(registration.options), {
				challenge: registration.challenge,
			}),
		);

		let ceremony = rp.authenticate();
		let response = await authenticator.authenticate(ceremony.options);
		let replayed = await rp.verifyAuthentication(response, {
			challenge: ceremony.challenge,
			passkey: { ...passkey, counter: 5 },
		});

		expect(isFailure(replayed) && replayed.error).toBeInstanceOf(CounterError);
	});

	test("refuses an assertion from a credential the account does not hold", async () => {
		let rp = relyingParty();
		let authenticator = await Authenticator.create();
		let registration = rp.register({ user: { id: "usr_1", name: "ana@example.com" } });
		let passkey = unwrap(
			await rp.verifyRegistration(await authenticator.register(registration.options), {
				challenge: registration.challenge,
			}),
		);

		let ceremony = rp.authenticate();
		let response = await authenticator.authenticate(ceremony.options);

		let result = await rp.verifyAuthentication(response, {
			challenge: ceremony.challenge,
			passkey: { ...passkey, id: Base64Url.encode(randomBytes(16)) },
		});

		expect(isFailure(result) && result.error).toBeInstanceOf(CredentialMismatchError);
	});

	test("verifies a packed self-attestation the credential key signed", async () => {
		let rp = relyingParty();
		let authenticator = await Authenticator.create();
		let ceremony = rp.register({ user: { id: "usr_1", name: "ana@example.com" } });

		let result = await rp.verifyRegistration(
			await authenticator.register(ceremony.options, undefined, "packed"),
			{ challenge: ceremony.challenge },
		);

		expect(isSuccess(result)).toBe(true);
		expect(unwrap(result).attestation).toBe("packed");
	});

	test("refuses a statement whose chain it cannot anchor", async () => {
		let rp = relyingParty();
		let authenticator = await Authenticator.create();
		let ceremony = rp.register({ user: { id: "usr_1", name: "ana@example.com" } });

		let result = await rp.verifyRegistration(
			await authenticator.register(ceremony.options, undefined, "packedChain"),
			{ challenge: ceremony.challenge },
		);

		expect(isFailure(result) && result.error).toBeInstanceOf(AttestationError);
	});

	test("refuses a none attestation that smuggles a statement", async () => {
		let rp = relyingParty();
		let authenticator = await Authenticator.create();
		let ceremony = rp.register({ user: { id: "usr_1", name: "ana@example.com" } });

		let result = await rp.verifyRegistration(
			await authenticator.register(ceremony.options, undefined, "noneWithStatement"),
			{ challenge: ceremony.challenge },
		);

		expect(isFailure(result) && result.error).toBeInstanceOf(AttestationError);
	});

	test("refuses a ceremony run inside a cross-origin frame", async () => {
		let rp = relyingParty();
		let authenticator = await Authenticator.create();
		let ceremony = rp.register({ user: { id: "usr_1", name: "ana@example.com" } });

		let result = await rp.verifyRegistration(
			await authenticator.register(ceremony.options, undefined, "none", true),
			{ challenge: ceremony.challenge },
		);

		expect(isFailure(result) && result.error).toBeInstanceOf(CrossOriginError);
	});

	test("accepts a framed ceremony once the relying party opts in", async () => {
		let rp = new RelyingParty({ id: "example.com", name: "Example", allowFramed: true });
		let authenticator = await Authenticator.create();
		let ceremony = rp.register({ user: { id: "usr_1", name: "ana@example.com" } });

		let result = await rp.verifyRegistration(
			await authenticator.register(ceremony.options, undefined, "none", true),
			{ challenge: ceremony.challenge },
		);

		expect(isSuccess(result)).toBe(true);
	});

	test("refuses a credential using an algorithm it never offered", async () => {
		let rp = new RelyingParty({ id: "example.com", name: "Example", algorithms: [-257] });
		let authenticator = await Authenticator.create();
		let ceremony = rp.register({ user: { id: "usr_1", name: "ana@example.com" } });

		let result = await rp.verifyRegistration(await authenticator.register(ceremony.options), {
			challenge: ceremony.challenge,
		});

		expect(isFailure(result) && result.error).toBeInstanceOf(UnsupportedAlgorithmError);
	});

	test("rejects a user id that overflows the user handle", () => {
		let rp = relyingParty();
		expect(() => rp.register({ user: { id: "x".repeat(65), name: "ana@example.com" } })).toThrow(
			RangeError,
		);
	});
});
