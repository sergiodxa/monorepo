/**
 * The signing and encryption certificates a connection trusts, read from the
 * PEM a tenant pastes or the base64 a metadata document carries. A connection
 * tracks a set rather than one, so this carries the validity window and
 * fingerprint that make a rotation something an operator can see coming.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { Base64, Hex, randomBytes, sha256 } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

import type { PublicKeyAlgorithm } from "./lib/der.js";

import { CertificateError } from "./errors.js";
import { toBufferSource } from "./lib/bytes.js";
import { buildCertificate, buildTbsCertificate, readCertificate } from "./lib/der.js";

/** How many bytes of randomness a generated certificate's serial number carries. */
const SERIAL_LENGTH = 16;

/** How many base64 characters a PEM body carries per line. */
const PEM_LINE_LENGTH = 64;

/** Everything that is not base64, stripped before a pasted certificate is decoded. */
const NON_BASE64_PATTERN = /[^A-Za-z0-9+/=]/g;

/**
 * Groups the types a caller names when it works with certificates.
 */
export namespace Certificate {
	/**
	 * What a self-signed service-provider certificate is generated from. The key
	 * pair is the service provider's own, kept where it was generated, and only
	 * the public half reaches the document an identity provider is handed.
	 */
	export interface SelfSignedOptions {
		keys: CryptoKeyPair;
		commonName: string;
		notBefore: Date;
		notAfter: Date;
	}
}

/**
 * One X.509 certificate, read for the key it carries and the window it carries
 * it for.
 *
 * @example
 * let result = await Certificate.parse(pem);
 * if (isSuccess(result)) console.log(result.data.notAfter);
 */
export class Certificate {
	/** The certificate's own bytes, which is what a fingerprint is taken over. */
	readonly der: Bytes;

	/** Lowercase hex SHA-256 over the certificate, the value a rotation is tracked by. */
	readonly fingerprint: string;

	/** The subject's common name, empty where the certificate carries none. */
	readonly subject: string;

	/** The issuer's common name, equal to the subject for a self-signed certificate. */
	readonly issuer: string;

	/** Uppercase hex serial number, which an issuer names a revocation by. */
	readonly serial: string;

	/** When the certificate starts being valid. */
	readonly notBefore: Date;

	/** When the certificate stops being valid, and a connection stops verifying. */
	readonly notAfter: Date;

	/** The key the certificate carries, named as Web Crypto imports it. */
	readonly algorithm: PublicKeyAlgorithm;

	/** The whole `SubjectPublicKeyInfo`, ready to import as an `spki` key. */
	readonly spki: Bytes;

	/**
	 * @param fields Values already read out of the certificate's DER.
	 */
	private constructor(fields: {
		der: Bytes;
		fingerprint: string;
		subject: string;
		issuer: string;
		serial: string;
		notBefore: Date;
		notAfter: Date;
		algorithm: PublicKeyAlgorithm;
		spki: Bytes;
	}) {
		this.der = fields.der;
		this.fingerprint = fields.fingerprint;
		this.subject = fields.subject;
		this.issuer = fields.issuer;
		this.serial = fields.serial;
		this.notBefore = fields.notBefore;
		this.notAfter = fields.notAfter;
		this.algorithm = fields.algorithm;
		this.spki = fields.spki;
	}

	/**
	 * Reads a certificate from PEM, or from the bare base64 a metadata document
	 * writes inside an `X509Certificate` element. Line wrapping, headers and
	 * surrounding whitespace are all stripped, so what a tenant pastes and what
	 * a document carries reach the same reader.
	 *
	 * @param source - PEM text or bare base64
	 * @returns The certificate, or the reason it could not be read
	 */
	static async parse(source: string): Promise<Result<Certificate, CertificateError>> {
		let body = source.replaceAll(/-----(?:BEGIN|END) CERTIFICATE-----/g, "");
		let decoded = Base64.decode(body.replaceAll(NON_BASE64_PATTERN, ""));
		if (isFailure(decoded)) return failure(new CertificateError("not base64"));

		return Certificate.#fromDer(decoded.data);
	}

	/**
	 * Generates the certificate a service provider publishes in its metadata,
	 * signed by the key pair it names. An identity provider reads it to encrypt
	 * to the service provider and to check what the service provider signs, and
	 * needs no authority behind it beyond the tenant handing over the document.
	 *
	 * @param options - The key pair, the name to carry, and the window to carry it for
	 * @returns The generated certificate, or the reason it could not be built
	 */
	static async selfSigned(
		options: Certificate.SelfSignedOptions,
	): Promise<Result<Certificate, CertificateError>> {
		let spki = await crypto.subtle.exportKey("spki", options.keys.publicKey).catch(() => null);
		if (!spki) return failure(new CertificateError("public key could not be exported"));

		let tbs = buildTbsCertificate({
			spki: new Uint8Array(spki),
			commonName: options.commonName,
			serial: randomBytes(SERIAL_LENGTH),
			notBefore: options.notBefore,
			notAfter: options.notAfter,
		});
		if (isFailure(tbs)) return failure(new CertificateError(tbs.error.message));

		let signature = await crypto.subtle
			.sign({ name: "RSASSA-PKCS1-v1_5" }, options.keys.privateKey, toBufferSource(tbs.data))
			.catch(() => null);
		if (!signature) return failure(new CertificateError("certificate could not be signed"));

		return Certificate.#fromDer(buildCertificate(tbs.data, new Uint8Array(signature)));
	}

	/**
	 * Builds one certificate from its DER, which is the single place the fields
	 * and the fingerprint are derived, so a parsed and a generated certificate
	 * are the same value.
	 */
	static async #fromDer(der: Bytes): Promise<Result<Certificate, CertificateError>> {
		let fields = readCertificate(der);
		if (isFailure(fields)) return failure(new CertificateError(fields.error.message));

		let digest = await sha256(der);
		if (isFailure(digest)) return failure(new CertificateError("could not be digested"));

		return success(
			new Certificate({
				der,
				fingerprint: Hex.encode(digest.data),
				subject: fields.data.subject,
				issuer: fields.data.issuer,
				serial: fields.data.serial,
				notBefore: fields.data.notBefore,
				notAfter: fields.data.notAfter,
				algorithm: fields.data.algorithm,
				spki: fields.data.spki,
			}),
		);
	}

	/**
	 * Whether the certificate is inside its own validity window at one moment.
	 *
	 * @param when - The moment to test, which a caller takes from its own clock
	 */
	validAt(when: Date): boolean {
		return when >= this.notBefore && when < this.notAfter;
	}

	/**
	 * The certificate as PEM, which is the form a tenant pastes into an identity
	 * provider's own configuration.
	 */
	toPem(): string {
		let body = Base64.encode(this.der);
		let lines: string[] = [];
		for (let index = 0; index < body.length; index += PEM_LINE_LENGTH) {
			lines.push(body.slice(index, index + PEM_LINE_LENGTH));
		}

		return ["-----BEGIN CERTIFICATE-----", ...lines, "-----END CERTIFICATE-----", ""].join("\n");
	}

	/** The base64 body alone, which is what an XML document carries. */
	toBase64(): string {
		return Base64.encode(this.der);
	}
}
