/**
 * The SAML half of an enterprise connection: the provider's endpoints, the
 * certificate set a rotation moves through, and the service provider's own key
 * pair and certificate. Everything a tenant configures once and a sign-in then
 * reads, kept beside the connection record rather than inside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Certificate } from "@sdxc/saml";
import type { Database, TableRow } from "remix/data-table";

import { Base64 } from "@sdxc/crypto";
import { open, seal } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import * as SAML from "@sdxc/saml";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import * as s from "remix/data-schema";
import { column as c, lt, table } from "remix/data-table";

import type { ConnectionRow, SetConnectionEnabledResult } from "./connections";

import { writeAuditEvent } from "./audit-events";
import { connections, setConnectionEnabled } from "./connections";

/** The audit actor for a call with no operator identity threaded through today. */
const PLATFORM_ACTOR = { type: "platform", id: "system" } as const;

/** Mints a `conn` id for a new connection, matching what a social connection carries. */
const connectionRowId = typeid("conn");

/** How long a generated service-provider certificate is valid for. */
const SP_CERTIFICATE_YEARS = 5;

/** Milliseconds in one year, for drawing the certificate's own window. */
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * How long a certificate the provider stopped publishing stays trusted. A
 * metadata document that failed to list one is as likely a blip at the provider
 * as a deliberate retirement, and a week is long enough to tell them apart.
 */
const RETIREMENT_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/** The RSA parameters a service provider's own key pair is generated with. */
const SP_KEY_PARAMETERS = {
	name: "RSASSA-PKCS1-v1_5",
	modulusLength: 2048,
	publicExponent: Uint8Array.of(0x01, 0x00, 0x01),
	hash: "SHA-256",
} as const;

/**
 * The SAML configuration of one connection whose kind is `saml`. The private key
 * is sealed with the tenant object's own key, so the half that opens an
 * encrypted assertion never leaves the object that generated it.
 */
export const connectionSaml = table({
	name: "connection_saml",
	primaryKey: ["connection_id"],
	columns: {
		connection_id: c.text(),
		idp_entity_id: c.text(),
		sso_redirect_url: c.text().nullable(),
		sso_post_url: c.text().nullable(),
		metadata_url: c.text().nullable(),
		want_assertions_encrypted: c.boolean().default(false),
		allow_idp_initiated: c.boolean().default(false),
		sp_private_key_sealed: c.text(),
		sp_certificate: c.text(),
		sp_certificate_not_after: c.integer(),
		created_at: c.integer(),
		updated_at: c.integer(),
	},
});

/** One certificate a connection trusts, for signing or for encryption. */
export const connectionCertificates = table({
	name: "connection_certificates",
	primaryKey: ["connection_id", "use", "fingerprint"],
	columns: {
		connection_id: c.text(),
		use: c.enum(["signing", "encryption"] as const),
		fingerprint: c.text(),
		certificate: c.text(),
		not_before: c.integer(),
		not_after: c.integer(),
		source: c.enum(["metadata", "manual"] as const),
		retired_at: c.integer().nullable(),
		created_at: c.integer(),
	},
});

/** Every assertion id already accepted, held until its own window closes. */
export const samlAssertionIds = table({
	name: "saml_assertion_ids",
	primaryKey: ["connection_id", "assertion_id"],
	columns: {
		connection_id: c.text(),
		assertion_id: c.text(),
		expires_at: c.integer(),
	},
});

export type ConnectionSamlRow = TableRow<typeof connectionSaml>;
export type ConnectionCertificateRow = TableRow<typeof connectionCertificates>;

/** What a certificate is trusted for. */
export type CertificateUse = "signing" | "encryption";

/**
 * The three URLs a connection is identified by at the identity provider. All of
 * them are built from the tenant's platform subdomain and the connection's own
 * immutable slug, so they are fixed for the connection's life and a provider
 * that registered them once never has to be told again.
 */
export interface SamlServiceProviderUrls {
	entityId: string;
	acsUrl: string;
	metadataUrl: string;
}

/**
 * Builds the identifiers one connection is known by.
 *
 * @param callbackOrigin - The tenant's own platform-subdomain origin
 * @param slug - The connection's immutable slug
 */
export function samlServiceProviderUrls(
	callbackOrigin: string,
	slug: string,
): SamlServiceProviderUrls {
	let entityId = `${callbackOrigin}/u/sso/${slug}`;
	return { entityId, acsUrl: `${entityId}/acs`, metadataUrl: `${entityId}/metadata` };
}

let SaveEnterpriseConnectionSchema = s.object({
	slug: s.string(),
	displayName: s.string(),
	idpEntityId: s.string(),
	ssoRedirectUrl: s.optional(s.nullable(s.string())),
	ssoPostUrl: s.optional(s.nullable(s.string())),
	metadataUrl: s.optional(s.nullable(s.string())),
	wantAssertionsEncrypted: s.optional(s.boolean()),
	allowIdpInitiated: s.optional(s.boolean()),
	onUnknownSubject: s.optional(s.enum_(["create", "refuse"] as const)),
	signingCertificates: s.optional(s.array(s.string())),
	callbackOrigin: s.string(),
});

/** What a tenant configures an enterprise connection with. */
export interface SaveEnterpriseConnectionInput {
	/** Unique per tenant, chosen once, and what every identifier is built from. */
	slug: string;
	displayName: string;
	/** The provider's own entity id, which its assertions name themselves by. */
	idpEntityId: string;
	ssoRedirectUrl?: string | null;
	ssoPostUrl?: string | null;
	/** Where a refresh re-reads the endpoints and certificates from. */
	metadataUrl?: string | null;
	wantAssertionsEncrypted?: boolean;
	/** Whether the provider may start a sign-in with no request of ours behind it. */
	allowIdpInitiated?: boolean;
	onUnknownSubject?: "create" | "refuse";
	/** Certificates pasted by hand, for a provider publishing no metadata. */
	signingCertificates?: string[];
	callbackOrigin: string;
}

/** What a saved enterprise connection answers with, which is what an IdP is configured from. */
export interface SamlServiceProviderDescription extends SamlServiceProviderUrls {
	/** The service provider's own certificate, as PEM, for a provider that wants it pasted. */
	certificate: string;
	/** When that certificate stops being valid, which is when it has to be replaced. */
	certificateNotAfter: number;
}

export type SaveEnterpriseConnectionResult =
	| { ok: true; connectionId: string; serviceProvider: SamlServiceProviderDescription }
	| { ok: false; reason: "duplicate-slug" }
	| { ok: false; reason: "kind-immutable" }
	| { ok: false; reason: "missing-endpoint" }
	| { ok: false; reason: "invalid-certificate"; detail: string };

/**
 * Writes an enterprise connection's whole configuration, generating the service
 * provider's key pair and certificate the first time and keeping them on every
 * save afterwards, so the identifiers an identity provider was configured with
 * survive a tenant editing anything else about the connection.
 *
 * @param db - The tenant's database.
 * @param sealKey - The tenant object's own AES-GCM key.
 * @param input - The connection to save, and the origin its identifiers are built against.
 * @returns The connection id and what an identity provider is configured from.
 */
export async function saveEnterpriseConnection(
	db: Database,
	sealKey: CryptoKey,
	input: SaveEnterpriseConnectionInput,
): Promise<SaveEnterpriseConnectionResult> {
	let parsed = s.parse(SaveEnterpriseConnectionSchema, input);
	let now = Date.now();

	if (!parsed.ssoRedirectUrl && !parsed.ssoPostUrl && !parsed.metadataUrl) {
		return { ok: false, reason: "missing-endpoint" };
	}

	let existing = await db.findOne(connections, { where: { slug: parsed.slug } });
	if (existing && existing.kind !== "saml") return { ok: false, reason: "kind-immutable" };

	let id = existing?.id ?? connectionRowId(generateUUID()).toString();
	let keys = existing ? await db.find(connectionSaml, { connection_id: id }) : null;
	let generated = keys ? null : await generateServiceProviderKeys(sealKey, parsed.slug, now);

	if (generated && !generated.ok) return generated;

	let certificates = await readPastedCertificates(parsed.signingCertificates ?? []);
	if (!certificates.ok) return certificates;

	if (existing) {
		await db.update(
			connections,
			{ id },
			{ display_name: parsed.displayName, updated_at: now, ...unknownSubject(parsed) },
		);
	} else {
		await db.create(connections, {
			id,
			slug: parsed.slug,
			kind: "saml",
			catalog_entry: null,
			display_name: parsed.displayName,
			enabled: false,
			issuer: parsed.idpEntityId,
			authorization_endpoint: null,
			token_endpoint: null,
			userinfo_endpoint: null,
			client_id: "",
			client_secret_sealed: null,
			scopes: [],
			subject_claim: "nameId",
			email_authority: false,
			auto_link: false,
			on_unknown_subject: parsed.onUnknownSubject ?? "create",
			created_at: now,
			updated_at: now,
		});
	}

	let shape = {
		idp_entity_id: parsed.idpEntityId,
		sso_redirect_url: parsed.ssoRedirectUrl ?? null,
		sso_post_url: parsed.ssoPostUrl ?? null,
		metadata_url: parsed.metadataUrl ?? null,
		want_assertions_encrypted: parsed.wantAssertionsEncrypted ?? false,
		allow_idp_initiated: parsed.allowIdpInitiated ?? false,
		updated_at: now,
	};

	if (keys) {
		await db.update(connectionSaml, { connection_id: id }, shape);
	} else if (generated?.ok) {
		await db.create(connectionSaml, {
			connection_id: id,
			...shape,
			sp_private_key_sealed: generated.sealed,
			sp_certificate: generated.certificate.toPem(),
			sp_certificate_not_after: generated.certificate.notAfter.getTime(),
			created_at: now,
		});
	}

	for (let certificate of certificates.certificates) {
		await rememberCertificate(db, id, "signing", certificate, "manual", now);
	}

	await writeAuditEvent(db, {
		action: existing ? "connection.updated" : "connection.created",
		actor: PLATFORM_ACTOR,
		targetType: "connection",
		targetId: id,
		outcome: "succeeded",
		detail: { kind: "saml", slug: parsed.slug },
	});

	let row = await db.find(connectionSaml, { connection_id: id });
	if (!row) throw new Error("SAML connection row missing immediately after its own write");

	return {
		ok: true,
		connectionId: id,
		serviceProvider: describeFromRow(parsed.callbackOrigin, parsed.slug, row),
	};
}

/** The unknown-subject column to write, left as it was when a save does not name one. */
function unknownSubject(parsed: { onUnknownSubject?: "create" | "refuse" }) {
	return parsed.onUnknownSubject ? { on_unknown_subject: parsed.onUnknownSubject } : {};
}

/** The service-provider description built from one stored row. */
function describeFromRow(
	callbackOrigin: string,
	slug: string,
	row: ConnectionSamlRow,
): SamlServiceProviderDescription {
	return {
		...samlServiceProviderUrls(callbackOrigin, slug),
		certificate: row.sp_certificate,
		certificateNotAfter: row.sp_certificate_not_after,
	};
}

/**
 * Generates the service provider's own key pair and the certificate that
 * publishes its public half, sealing the private half with the tenant's key so
 * it is readable only inside the object that holds that key.
 */
async function generateServiceProviderKeys(
	sealKey: CryptoKey,
	slug: string,
	now: number,
): Promise<
	| { ok: true; sealed: string; certificate: Certificate }
	| { ok: false; reason: "invalid-certificate"; detail: string }
> {
	let keys = await crypto.subtle.generateKey(SP_KEY_PARAMETERS, true, ["sign", "verify"]);

	let certificate = await SAML.Certificate.selfSigned({
		keys,
		commonName: slug,
		notBefore: new Date(now),
		notAfter: new Date(now + SP_CERTIFICATE_YEARS * YEAR_MS),
	});
	if (isFailure(certificate)) {
		return { ok: false, reason: "invalid-certificate", detail: certificate.error.message };
	}

	let exported = await crypto.subtle.exportKey("pkcs8", keys.privateKey);
	let sealed = await seal(sealKey, Base64.encode(new Uint8Array(exported)));
	if (isFailure(sealed)) {
		return { ok: false, reason: "invalid-certificate", detail: "private key could not be sealed" };
	}

	return { ok: true, sealed: sealed.data, certificate: certificate.data };
}

/** Reads the certificates a tenant pasted, refusing the whole save on the first unreadable one. */
async function readPastedCertificates(
	sources: string[],
): Promise<
	| { ok: true; certificates: Certificate[] }
	| { ok: false; reason: "invalid-certificate"; detail: string }
> {
	let certificates: Certificate[] = [];

	for (let source of sources) {
		let parsed = await SAML.Certificate.parse(source);
		if (isFailure(parsed)) {
			return { ok: false, reason: "invalid-certificate", detail: parsed.error.message };
		}
		certificates.push(parsed.data);
	}

	return { ok: true, certificates };
}

/**
 * Writes one certificate into a connection's set, or brings a retired one back,
 * which is what a provider republishing a certificate it briefly dropped looks
 * like from here.
 */
async function rememberCertificate(
	db: Database,
	connectionId: string,
	use: CertificateUse,
	certificate: Certificate,
	source: "metadata" | "manual",
	now: number,
): Promise<void> {
	let key = { connection_id: connectionId, use, fingerprint: certificate.fingerprint };
	let existing = await db.find(connectionCertificates, key);

	if (existing) {
		await db.update(connectionCertificates, key, { retired_at: null, source });
		return;
	}

	await db.create(connectionCertificates, {
		...key,
		certificate: certificate.toPem(),
		not_before: certificate.notBefore.getTime(),
		not_after: certificate.notAfter.getTime(),
		source,
		retired_at: null,
		created_at: now,
	});
}

export type RefreshConnectionMetadataResult =
	| { ok: true; signing: number; encryption: number; retired: number }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "unsupported-connection-kind" }
	| { ok: false; reason: "invalid-metadata"; detail: string };

/**
 * Re-reads a provider's metadata into the connection: endpoints replaced,
 * certificates added, and one absent long enough to be a decision rather than a
 * blip retired. Nothing is removed, so a provider that briefly published an
 * incomplete document locks nobody out.
 *
 * @param db - The tenant's database.
 * @param input - The connection's slug and the metadata document as fetched.
 * @returns How many certificates the document carried, and how many were retired.
 */
export async function refreshConnectionMetadata(
	db: Database,
	input: { slug: string; metadataXml: string; now?: number },
): Promise<RefreshConnectionMetadataResult> {
	let parsed = s.parse(
		s.object({ slug: s.string(), metadataXml: s.string(), now: s.optional(s.number()) }),
		input,
	);
	let now = parsed.now ?? Date.now();

	let connection = await db.findOne(connections, { where: { slug: parsed.slug } });
	if (!connection) return { ok: false, reason: "not-found" };
	if (connection.kind !== "saml") return { ok: false, reason: "unsupported-connection-kind" };

	let metadata = await SAML.parseIdPMetadata(parsed.metadataXml);
	if (isFailure(metadata)) {
		return { ok: false, reason: "invalid-metadata", detail: metadata.error.message };
	}

	let redirect = metadata.data.singleSignOn.find(
		(endpoint: SAML.IdPMetadata.Endpoint) =>
			endpoint.binding === "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
	);
	let post = metadata.data.singleSignOn.find(
		(endpoint: SAML.IdPMetadata.Endpoint) =>
			endpoint.binding === "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
	);

	await db.update(
		connectionSaml,
		{ connection_id: connection.id },
		{
			idp_entity_id: metadata.data.entityId,
			sso_redirect_url: redirect?.location ?? null,
			sso_post_url: post?.location ?? null,
			updated_at: now,
		},
	);

	for (let certificate of metadata.data.signing) {
		await rememberCertificate(db, connection.id, "signing", certificate, "metadata", now);
	}
	for (let certificate of metadata.data.encryption) {
		await rememberCertificate(db, connection.id, "encryption", certificate, "metadata", now);
	}

	let published = new Set([
		...metadata.data.signing.map(
			(certificate: Certificate) => `signing:${certificate.fingerprint}`,
		),
		...metadata.data.encryption.map(
			(certificate: Certificate) => `encryption:${certificate.fingerprint}`,
		),
	]);

	let retired = await retireAbsentCertificates(db, connection.id, published, now);

	return {
		ok: true,
		signing: metadata.data.signing.length,
		encryption: metadata.data.encryption.length,
		retired,
	};
}

/**
 * Retires the metadata-sourced certificates the document stopped publishing,
 * once they have been absent long enough that a provider's blip has had time to
 * resolve. A hand-pasted certificate is a tenant's own decision and is left.
 */
async function retireAbsentCertificates(
	db: Database,
	connectionId: string,
	published: Set<string>,
	now: number,
): Promise<number> {
	let rows = await db.findMany(connectionCertificates, {
		where: { connection_id: connectionId, source: "metadata", retired_at: null },
	});

	let retired = 0;

	for (let row of rows) {
		if (published.has(`${row.use}:${row.fingerprint}`)) continue;
		if (now - row.created_at < RETIREMENT_GRACE_MS) continue;

		await db.update(
			connectionCertificates,
			{ connection_id: connectionId, use: row.use, fingerprint: row.fingerprint },
			{ retired_at: now },
		);
		retired++;
	}

	return retired;
}

/**
 * The certificates a connection currently verifies against: every unretired one
 * inside its own validity window. A connection whose whole set has expired
 * verifies nothing, which is the state a rotation left unfinished produces.
 *
 * @param db - The tenant's database.
 * @param connectionId - Which connection's set to read.
 * @param use - Whether the set is for verifying signatures or for encryption.
 * @param now - The moment each window is judged against.
 */
export async function activeCertificates(
	db: Database,
	connectionId: string,
	use: CertificateUse,
	now: number,
): Promise<Certificate[]> {
	let rows = await db.findMany(connectionCertificates, {
		where: { connection_id: connectionId, use, retired_at: null },
	});

	let certificates: Certificate[] = [];

	for (let row of rows) {
		if (now < row.not_before || now >= row.not_after) continue;

		let parsed = await SAML.Certificate.parse(row.certificate);
		if (isFailure(parsed)) continue;

		certificates.push(parsed.data);
	}

	return certificates;
}

/**
 * The service provider's own private key, imported for every role it plays:
 * signing an authentication request, and opening an assertion encrypted under
 * either of the two OAEP digests providers emit.
 *
 * @param sealKey - The tenant object's own AES-GCM key.
 * @param row - The connection's SAML row, holding the sealed key.
 */
export async function openServiceProviderKeys(
	sealKey: CryptoKey,
	row: ConnectionSamlRow,
): Promise<{ signing: CryptoKey; decryption: CryptoKey[] }> {
	let opened = await open(sealKey, row.sp_private_key_sealed);
	if (isFailure(opened)) throw new Error("failed to open the connection's sealed private key");

	let decoded = Base64.decode(opened.data);
	if (isFailure(decoded)) throw new Error("the connection's sealed private key is not base64");

	let pkcs8 = decoded.data;

	let signing = await crypto.subtle.importKey(
		"pkcs8",
		pkcs8,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["sign"],
	);

	let decryption = await Promise.all(
		(["SHA-1", "SHA-256"] as const).map((hash) =>
			crypto.subtle.importKey("pkcs8", pkcs8, { name: "RSA-OAEP", hash }, false, ["decrypt"]),
		),
	);

	return { signing, decryption };
}

export type DescribeSamlServiceProviderResult =
	| { ok: true; metadata: string; description: SamlServiceProviderDescription }
	| { ok: false; reason: "not-found" }
	| { ok: false; reason: "unsupported-connection-kind" }
	| { ok: false; reason: "invalid-metadata"; detail: string };

/**
 * The metadata document an identity provider is handed, built from the
 * connection's own identifiers and certificate so a tenant hands over a URL
 * rather than transcribing four fields into somebody else's console.
 *
 * @param db - The tenant's database.
 * @param input - The connection's slug and the tenant's own platform origin.
 * @returns The document, and the identifiers it describes.
 */
export async function describeSamlServiceProvider(
	db: Database,
	input: { slug: string; callbackOrigin: string },
): Promise<DescribeSamlServiceProviderResult> {
	let parsed = s.parse(s.object({ slug: s.string(), callbackOrigin: s.string() }), input);

	let connection = await db.findOne(connections, { where: { slug: parsed.slug } });
	if (!connection) return { ok: false, reason: "not-found" };
	if (connection.kind !== "saml") return { ok: false, reason: "unsupported-connection-kind" };

	let row = await db.find(connectionSaml, { connection_id: connection.id });
	if (!row) return { ok: false, reason: "not-found" };

	let certificate = await SAML.Certificate.parse(row.sp_certificate);
	if (isFailure(certificate)) {
		return { ok: false, reason: "invalid-metadata", detail: certificate.error.message };
	}

	let description = describeFromRow(parsed.callbackOrigin, parsed.slug, row);

	let document = SAML.buildServiceProviderMetadata({
		entityId: description.entityId,
		assertionConsumerService: description.acsUrl,
		certificate: certificate.data,
		nameIdFormat: null,
		wantAssertionsSigned: true,
		authnRequestsSigned: true,
		validUntil: null,
	});
	if (isFailure(document)) {
		return { ok: false, reason: "invalid-metadata", detail: document.error.message };
	}

	return { ok: true, metadata: document.data, description };
}

/**
 * The SAML configuration for one connection, or nothing where the connection is
 * of another kind.
 *
 * @param db - The tenant's database.
 * @param connection - The connection row already read.
 */
export async function samlConfiguration(
	db: Database,
	connection: ConnectionRow,
): Promise<ConnectionSamlRow | null> {
	if (connection.kind !== "saml") return null;
	return db.find(connectionSaml, { connection_id: connection.id });
}

/**
 * Drops the assertion ids whose windows have closed, in bounded batches so one
 * alarm never runs long.
 *
 * @param db - The tenant's database.
 * @param input - The moment to sweep against, and how many rows to take.
 * @returns How many rows went, and whether more remain.
 */
export async function sweepExpiredAssertionIds(
	db: Database,
	input: { now?: number; limit?: number } = {},
): Promise<{ deleted: number; more: boolean }> {
	let now = input.now ?? Date.now();
	let limit = input.limit ?? 500;

	let batch = await db.findMany(samlAssertionIds, {
		where: lt("expires_at", now),
		orderBy: ["expires_at", "asc"],
		limit,
	});
	if (batch.length === 0) return { deleted: 0, more: false };

	for (let row of batch) {
		await db.delete(samlAssertionIds, {
			connection_id: row.connection_id,
			assertion_id: row.assertion_id,
		});
	}

	return { deleted: batch.length, more: batch.length === limit };
}

export type SetEnterpriseConnectionEnabledResult =
	| SetConnectionEnabledResult
	| { ok: false; reason: "unsupported-connection-kind" }
	| { ok: false; reason: "missing-endpoint" }
	| { ok: false; reason: "no-trusted-certificate" };

/**
 * Turns an enterprise connection on or off. Enabling one takes a sign-on
 * endpoint and a certificate currently inside its own window, because those are
 * what a sign-in against it actually needs, and a connection that would refuse
 * every assertion must never appear as a route somebody's address resolves to.
 *
 * @param db - The tenant's database.
 * @param input - The connection's slug, whether it should now be enabled, and
 * the moment its certificates are judged against.
 * @returns The connection's public record, or which rule refused the change.
 */
export async function setEnterpriseConnectionEnabled(
	db: Database,
	input: { slug: string; enabled: boolean; now?: number },
): Promise<SetEnterpriseConnectionEnabledResult> {
	let parsed = s.parse(
		s.object({ slug: s.string(), enabled: s.boolean(), now: s.optional(s.number()) }),
		input,
	);
	let now = parsed.now ?? Date.now();

	let connection = await db.findOne(connections, { where: { slug: parsed.slug } });
	if (!connection) return { ok: false, reason: "not-found" };
	if (connection.kind !== "saml") return { ok: false, reason: "unsupported-connection-kind" };

	if (parsed.enabled) {
		let configuration = await db.find(connectionSaml, { connection_id: connection.id });
		if (!configuration?.sso_redirect_url && !configuration?.sso_post_url) {
			return { ok: false, reason: "missing-endpoint" };
		}

		let certificates = await activeCertificates(db, connection.id, "signing", now);
		if (certificates.length === 0) return { ok: false, reason: "no-trusted-certificate" };
	}

	return setConnectionEnabled(db, { slug: parsed.slug, enabled: parsed.enabled });
}
