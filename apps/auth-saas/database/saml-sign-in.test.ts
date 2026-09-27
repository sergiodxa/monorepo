/**
 * Drives the tenant object's enterprise SSO RPC methods against a fixture
 * identity provider: a real key pair, a real certificate, and responses signed
 * the way a provider signs them, so what the object accepts here is what it
 * would accept from somebody else's directory.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { randomToken } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { Certificate } from "@sdxc/saml";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { ResponseFixture } from "./test/saml-fixtures";

import Tenant from "./tenant-do";
import { signResponse } from "./test/saml-fixtures";

/** The tenant's own platform-subdomain origin, which every identifier is built from. */
const ORIGIN = "https://acme.example";

/** The host a sign-in actually starts on. */
const HOSTNAME = "acme.example";

/** The connection every test configures. */
const SLUG = "northwind";

/** The identity provider's own entity id. */
const IDP_ENTITY_ID = "https://idp.northwind.test/metadata";

/** Where the fixture provider receives authentication requests. */
const SSO_URL = "https://idp.northwind.test/sso";

/** The identity provider's signing key pair, and the certificate publishing it. */
let idp: CryptoKeyPair;
let idpCertificate: Certificate;

beforeAll(async () => {
	idp = await crypto.subtle.generateKey(
		{
			name: "RSASSA-PKCS1-v1_5",
			modulusLength: 2048,
			publicExponent: Uint8Array.of(0x01, 0x00, 0x01),
			hash: "SHA-256",
		},
		true,
		["sign", "verify"],
	);

	let certificate = await Certificate.selfSigned({
		keys: idp,
		commonName: "idp.northwind.test",
		notBefore: new Date(Date.now() - 24 * 60 * 60 * 1000),
		notAfter: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
	});
	if (isFailure(certificate)) throw certificate.error;
	idpCertificate = certificate.data;
});

let state: DurableObjectStateMock;
let tenant: Tenant;

beforeEach(async () => {
	state = createDurableObjectState();
	tenant = new Tenant(state, { TOTP_SEAL_KEY: randomToken({ bytes: 32 }) } as Cloudflare.Env);
	await tenant.provision({ tenantId: "ten_1", issuer: ORIGIN });
});

/** Configures the connection every test signs in against, and enables it. */
async function configure(
	overrides: Partial<Parameters<Tenant["saveEnterpriseConnection"]>[0]> = {},
) {
	let saved = await tenant.saveEnterpriseConnection({
		slug: SLUG,
		displayName: "Northwind",
		idpEntityId: IDP_ENTITY_ID,
		ssoRedirectUrl: SSO_URL,
		signingCertificates: [idpCertificate.toPem()],
		...overrides,
	});

	if (!saved.ok) throw new Error(`saveEnterpriseConnection refused: ${saved.reason}`);

	let enabled = await tenant.setEnterpriseConnectionEnabled({ slug: SLUG, enabled: true });
	if (!enabled.ok) throw new Error(`setEnterpriseConnectionEnabled refused: ${enabled.reason}`);

	return saved;
}

/** The relay state one started sign-in carries, read off the redirect it answered. */
function relayStateOf(redirectUrl: string): string {
	let state = new URL(redirectUrl).searchParams.get("RelayState");
	if (!state) throw new Error("the redirect carries no RelayState");
	return state;
}

/** Signs a response addressed to this tenant's own connection identifiers. */
async function respond(requestId: string | null, overrides: ResponseFixture = {}): Promise<string> {
	let acs = `${ORIGIN}/u/sso/${SLUG}/acs`;
	let now = Date.now();

	return signResponse(
		{
			issuer: IDP_ENTITY_ID,
			audience: `${ORIGIN}/u/sso/${SLUG}`,
			destination: acs,
			recipient: acs,
			inResponseTo: requestId,
			notBefore: new Date(now - 60_000),
			notOnOrAfter: new Date(now + 120_000),
			...overrides,
		},
		idp.privateKey,
	);
}

describe("enterprise connection configuration", () => {
	test("answers the identifiers an identity provider is configured with", async () => {
		let saved = await configure();
		if (!saved.ok) throw new Error("refused");

		expect(saved.serviceProvider.entityId).toBe(`${ORIGIN}/u/sso/${SLUG}`);
		expect(saved.serviceProvider.acsUrl).toBe(`${ORIGIN}/u/sso/${SLUG}/acs`);
		expect(saved.serviceProvider.metadataUrl).toBe(`${ORIGIN}/u/sso/${SLUG}/metadata`);
		expect(saved.serviceProvider.certificate).toContain("BEGIN CERTIFICATE");
	});

	test("keeps the generated key pair across a later save", async () => {
		let first = await configure();
		let second = await configure({ displayName: "Northwind Corp" });

		if (!first.ok || !second.ok) throw new Error("refused");
		expect(second.serviceProvider.certificate).toBe(first.serviceProvider.certificate);
	});

	test("refuses a connection naming no endpoint at all", async () => {
		let saved = await tenant.saveEnterpriseConnection({
			slug: "empty",
			displayName: "Empty",
			idpEntityId: IDP_ENTITY_ID,
		});

		expect(saved).toMatchObject({ ok: false, reason: "missing-endpoint" });
	});

	test("refuses a certificate it cannot read", async () => {
		let saved = await tenant.saveEnterpriseConnection({
			slug: "broken",
			displayName: "Broken",
			idpEntityId: IDP_ENTITY_ID,
			ssoRedirectUrl: SSO_URL,
			signingCertificates: ["not a certificate"],
		});

		expect(saved).toMatchObject({ ok: false, reason: "invalid-certificate" });
	});

	test("refuses to enable a connection with no certificate yet", async () => {
		await tenant.saveEnterpriseConnection({
			slug: "bare",
			displayName: "Bare",
			idpEntityId: IDP_ENTITY_ID,
			ssoRedirectUrl: SSO_URL,
		});

		let enabled = await tenant.setEnterpriseConnectionEnabled({ slug: "bare", enabled: true });
		expect(enabled).toMatchObject({ ok: false, reason: "no-trusted-certificate" });
	});

	test("publishes metadata carrying the service provider's own certificate", async () => {
		let saved = await configure();
		if (!saved.ok) throw new Error("refused");

		let described = await tenant.describeSamlServiceProvider({ slug: SLUG });
		if (!described.ok) throw new Error(`describeSamlServiceProvider refused: ${described.reason}`);

		expect(described.metadata).toContain(saved.serviceProvider.entityId);
		expect(described.metadata).toContain(saved.serviceProvider.acsUrl);
		expect(described.description.certificate).toBe(saved.serviceProvider.certificate);
	});

	test("reads endpoints and certificates out of a metadata document", async () => {
		await configure();

		let metadata = `<?xml version="1.0"?>
			<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${IDP_ENTITY_ID}">
				<md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
					<md:KeyDescriptor use="signing">
						<ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
							<ds:X509Data><ds:X509Certificate>${idpCertificate.toBase64()}</ds:X509Certificate></ds:X509Data>
						</ds:KeyInfo>
					</md:KeyDescriptor>
					<md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${SSO_URL}"/>
				</md:IDPSSODescriptor>
			</md:EntityDescriptor>`;

		let refreshed = await tenant.refreshConnectionMetadata({ slug: SLUG, metadataXml: metadata });
		expect(refreshed).toMatchObject({ ok: true, signing: 1, retired: 0 });
	});
});

describe("signing in through an enterprise connection", () => {
	test("sends the browser to a signed authentication request", async () => {
		await configure();

		let started = await tenant.beginSamlSignIn({ slug: SLUG, hostname: HOSTNAME });
		if (!started.ok) throw new Error(`beginSamlSignIn refused: ${started.reason}`);

		let url = new URL(started.redirectUrl);
		expect(url.origin + url.pathname).toBe(SSO_URL);
		expect(url.searchParams.get("SAMLRequest")).toBeTruthy();
		expect(url.searchParams.get("SigAlg")).toBe(
			"http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
		);
		expect(url.searchParams.get("Signature")).toBeTruthy();
		expect(started.requestId).toMatch(/^_[0-9a-f]{32}$/);
	});

	test("creates a subject and opens a session from a verified assertion", async () => {
		await configure();

		let started = await tenant.beginSamlSignIn({ slug: SLUG, hostname: HOSTNAME });
		if (!started.ok) throw new Error("begin refused");

		let signedIn = await tenant.signInWithSamlResponse({
			slug: SLUG,
			samlResponse: await respond(started.requestId),
			relayState: relayStateOf(started.redirectUrl),
			hostname: HOSTNAME,
		});

		if (!signedIn.ok) throw new Error(`refused: ${JSON.stringify(signedIn)}`);
		expect(signedIn.hostname).toBe(HOSTNAME);
		expect(signedIn.handoffTicket).toBeTruthy();
		expect(signedIn.subjectId).toBeTruthy();
	});

	test("resolves the same subject on a returning sign-in", async () => {
		await configure();

		let first = await signIn("_first");
		let second = await signIn("_second");

		expect(second).toBe(first);
	});

	test("refuses a blocked subject on a returning sign-in", async () => {
		await configure();

		let subjectId = await signIn("_first");
		await tenant.blockSubject({ subjectId, reason: "fraud" });

		let started = await tenant.beginSamlSignIn({ slug: SLUG, hostname: HOSTNAME });
		if (!started.ok) throw new Error("begin refused");

		let refused = await tenant.signInWithSamlResponse({
			slug: SLUG,
			samlResponse: await respond(started.requestId, { assertionId: "_second" }),
			relayState: relayStateOf(started.redirectUrl),
			hostname: HOSTNAME,
		});

		expect(refused).toMatchObject({ ok: false, reason: "subject-blocked" });
	});

	test("refuses a response nothing asked for", async () => {
		await configure();

		let refused = await tenant.signInWithSamlResponse({
			slug: SLUG,
			samlResponse: await respond(null, { inResponseTo: null }),
			relayState: null,
			hostname: HOSTNAME,
		});

		expect(refused).toMatchObject({ ok: false, reason: "idp-initiated-refused" });
	});

	test("accepts a provider-started sign-in where the connection allows one", async () => {
		await configure({ allowIdpInitiated: true });

		let signedIn = await tenant.signInWithSamlResponse({
			slug: SLUG,
			samlResponse: await respond(null, { inResponseTo: null }),
			relayState: null,
			hostname: HOSTNAME,
		});

		expect(signedIn).toMatchObject({ ok: true });
	});

	test("caps a provider-started assertion's window whatever it claimed", async () => {
		await configure({ allowIdpInitiated: true });

		let refused = await tenant.signInWithSamlResponse({
			slug: SLUG,
			samlResponse: await respond(null, {
				inResponseTo: null,
				notOnOrAfter: new Date(Date.now() + 60 * 60 * 1000),
			}),
			relayState: null,
			hostname: HOSTNAME,
		});

		expect(refused).toMatchObject({ ok: false, reason: "assertion-rejected" });
	});

	test("refuses the same assertion posted twice", async () => {
		await configure();

		let started = await tenant.beginSamlSignIn({ slug: SLUG, hostname: HOSTNAME });
		if (!started.ok) throw new Error("begin refused");

		let response = await respond(started.requestId);
		let relayState = relayStateOf(started.redirectUrl);

		let first = await tenant.signInWithSamlResponse({
			slug: SLUG,
			samlResponse: response,
			relayState,
			hostname: HOSTNAME,
		});
		expect(first).toMatchObject({ ok: true });

		let second = await tenant.signInWithSamlResponse({
			slug: SLUG,
			samlResponse: response,
			relayState,
			hostname: HOSTNAME,
		});
		expect(second).toMatchObject({ ok: false, reason: "invalid-transaction" });
	});

	test("refuses an assertion answering another request", async () => {
		await configure();

		let started = await tenant.beginSamlSignIn({ slug: SLUG, hostname: HOSTNAME });
		if (!started.ok) throw new Error("begin refused");

		let refused = await tenant.signInWithSamlResponse({
			slug: SLUG,
			samlResponse: await respond("_someone-elses-request"),
			relayState: relayStateOf(started.redirectUrl),
			hostname: HOSTNAME,
		});

		expect(refused).toMatchObject({ ok: false, reason: "assertion-rejected" });
	});

	test("refuses an assertion signed by a key the connection does not trust", async () => {
		await configure();

		let stranger = await crypto.subtle.generateKey(
			{
				name: "RSASSA-PKCS1-v1_5",
				modulusLength: 2048,
				publicExponent: Uint8Array.of(0x01, 0x00, 0x01),
				hash: "SHA-256",
			},
			true,
			["sign", "verify"],
		);

		let started = await tenant.beginSamlSignIn({ slug: SLUG, hostname: HOSTNAME });
		if (!started.ok) throw new Error("begin refused");

		let acs = `${ORIGIN}/u/sso/${SLUG}/acs`;
		let forged = await signResponse(
			{
				issuer: IDP_ENTITY_ID,
				audience: `${ORIGIN}/u/sso/${SLUG}`,
				destination: acs,
				recipient: acs,
				inResponseTo: started.requestId,
				notOnOrAfter: new Date(Date.now() + 120_000),
			},
			stranger.privateKey,
		);

		let refused = await tenant.signInWithSamlResponse({
			slug: SLUG,
			samlResponse: forged,
			relayState: relayStateOf(started.redirectUrl),
			hostname: HOSTNAME,
		});

		expect(refused).toMatchObject({ ok: false, reason: "assertion-rejected" });
	});

	test("refuses a sign-in against a disabled connection", async () => {
		await configure();
		await tenant.setEnterpriseConnectionEnabled({ slug: SLUG, enabled: false });

		let refused = await tenant.beginSamlSignIn({ slug: SLUG, hostname: HOSTNAME });
		expect(refused).toMatchObject({ ok: false, reason: "connection-disabled" });
	});

	test("refuses a first-seen identity where the connection provisions nobody", async () => {
		await configure({ onUnknownSubject: "refuse" });

		let started = await tenant.beginSamlSignIn({ slug: SLUG, hostname: HOSTNAME });
		if (!started.ok) throw new Error("begin refused");

		let refused = await tenant.signInWithSamlResponse({
			slug: SLUG,
			samlResponse: await respond(started.requestId),
			relayState: relayStateOf(started.redirectUrl),
			hostname: HOSTNAME,
		});

		expect(refused).toMatchObject({ ok: false, reason: "unknown-subject" });
	});
});

/**
 * Runs one whole sign-in and answers the subject it resolved. Each call names
 * its own assertion id, since the replay store refuses a second use of one.
 */
async function signIn(assertionId: string): Promise<string> {
	let started = await tenant.beginSamlSignIn({ slug: SLUG, hostname: HOSTNAME });
	if (!started.ok) throw new Error("begin refused");

	let signedIn = await tenant.signInWithSamlResponse({
		slug: SLUG,
		samlResponse: await respond(started.requestId, { assertionId }),
		relayState: relayStateOf(started.redirectUrl),
		hostname: HOSTNAME,
	});

	if (!signedIn.ok) throw new Error(`refused: ${JSON.stringify(signedIn)}`);
	return signedIn.subjectId;
}

describe("organization-scoped connections", () => {
	/** Creates a bare subject, the shape an organization's own creator needs. */
	async function createOwner(email: string): Promise<string> {
		let created = await tenant.createSubject({ identifiers: [{ kind: "email", value: email }] });
		if (!created.ok) throw new Error("setup failed");
		return created.subjectId;
	}

	/** Creates an organization with a fresh owning subject, for tests that need one already made. */
	async function createOrg(slug: string, ownerEmail: string) {
		let ownerId = await createOwner(ownerEmail);
		let created = await tenant.createOrganization({
			name: "Acme",
			slug,
			creatorSubjectId: ownerId,
			actor: { type: "subject", id: ownerId },
		});
		if (!created.ok) throw new Error("setup failed");
		return created.organization;
	}

	test("saveEnterpriseConnection refuses an organization that does not exist", async () => {
		let refused = await tenant.saveEnterpriseConnection({
			slug: SLUG,
			displayName: "Northwind",
			idpEntityId: IDP_ENTITY_ID,
			ssoRedirectUrl: SSO_URL,
			signingCertificates: [idpCertificate.toPem()],
			organizationId: "org_does_not_exist",
		});

		expect(refused).toMatchObject({ ok: false, reason: "organization-not-found" });
	});

	test("saves the connection scoped to a real organization", async () => {
		let organization = await createOrg("acme-scoped", "owner-scoped@acme.test");

		let saved = await configure({ organizationId: organization.id });
		expect(saved.ok).toBe(true);
	});

	test("resolveOrganizationConnection finds the connection for a verified domain, and none for an unclaimed one", async () => {
		let organization = await createOrg("acme-resolve", "owner-resolve@acme.test");
		let saved = await configure({ organizationId: organization.id });
		if (!saved.ok) throw new Error("setup failed");

		let domainAdded = await tenant.addOrganizationDomain({
			organizationId: organization.id,
			domain: "acme-resolve.example",
			mode: "auto_join",
			actor: { type: "platform", id: "system" },
		});
		if (!domainAdded.ok) throw new Error("setup failed");
		await tenant.confirmOrganizationDomain({
			organizationId: organization.id,
			domain: "acme-resolve.example",
		});

		let resolved = await tenant.resolveOrganizationConnection({ domain: "acme-resolve.example" });
		expect(resolved).toMatchObject({
			ok: true,
			connection: { id: saved.connectionId, organizationId: organization.id },
		});

		let none = await tenant.resolveOrganizationConnection({ domain: "unclaimed.example" });
		expect(none).toMatchObject({ ok: false, reason: "not-found" });
	});

	test("a sign-in through an organization-scoped connection writes the membership as joined_via: connection", async () => {
		let organization = await createOrg("acme-connection", "owner-connection@acme.test");
		let saved = await configure({ organizationId: organization.id });
		if (!saved.ok) throw new Error("setup failed");

		let started = await tenant.beginSamlSignIn({ slug: SLUG, hostname: HOSTNAME });
		if (!started.ok) throw new Error("begin refused");

		let signedIn = await tenant.signInWithSamlResponse({
			slug: SLUG,
			samlResponse: await respond(started.requestId, { nameId: "member@acme-connection.example" }),
			relayState: relayStateOf(started.redirectUrl),
			hostname: HOSTNAME,
		});
		if (!signedIn.ok) throw new Error(`refused: ${JSON.stringify(signedIn)}`);

		let memberships = await tenant.describeSubjectOrganizations({ subjectId: signedIn.subjectId });
		expect(memberships.organizations).toEqual([
			expect.objectContaining({ organizationId: organization.id, joinedVia: "connection" }),
		]);
	});

	test("a sign-in through an unscoped connection writes no membership", async () => {
		await configure();

		let subjectId = await signIn("_unscoped");

		let memberships = await tenant.describeSubjectOrganizations({ subjectId });
		expect(memberships.organizations).toEqual([]);
	});

	test("links automatically to an existing verified subject when the connection's organization holds a verified domain and auto_link is on", async () => {
		let organization = await createOrg("acme-linking", "owner-linking@acme.test");
		let saved = await configure({ organizationId: organization.id, autoLink: true });
		if (!saved.ok) throw new Error("setup failed");

		let domainAdded = await tenant.addOrganizationDomain({
			organizationId: organization.id,
			domain: "acme-linking.example",
			mode: "auto_join",
			actor: { type: "platform", id: "system" },
		});
		if (!domainAdded.ok) throw new Error("setup failed");
		await tenant.confirmOrganizationDomain({
			organizationId: organization.id,
			domain: "acme-linking.example",
		});

		let created = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "ada@acme-linking.example" }],
		});
		if (!created.ok) throw new Error("setup failed");
		let added = await tenant.addIdentifier({
			subjectId: created.subjectId,
			kind: "email",
			value: "ada@acme-linking.example",
			actor: { kind: "subject" },
		});
		if (!added.ok || added.kind !== "email") throw new Error("setup failed");
		await tenant.verifyIdentifier({ ticket: added.ticket });

		let started = await tenant.beginSamlSignIn({ slug: SLUG, hostname: HOSTNAME });
		if (!started.ok) throw new Error("begin refused");

		let signedIn = await tenant.signInWithSamlResponse({
			slug: SLUG,
			samlResponse: await respond(started.requestId, {
				nameId: "ada@acme-linking.example",
				attributes: { email: ["ada@acme-linking.example"] },
			}),
			relayState: relayStateOf(started.redirectUrl),
			hostname: HOSTNAME,
		});

		if (!signedIn.ok) throw new Error(`expected success, got ${JSON.stringify(signedIn)}`);
		expect(signedIn.subjectId).toBe(created.subjectId);
	});

	test("answers link_required with a ticket instead of linking when auto_link is off", async () => {
		let organization = await createOrg("acme-confirm", "owner-confirm@acme.test");
		let saved = await configure({ organizationId: organization.id, autoLink: false });
		if (!saved.ok) throw new Error("setup failed");

		let domainAdded = await tenant.addOrganizationDomain({
			organizationId: organization.id,
			domain: "acme-confirm.example",
			mode: "auto_join",
			actor: { type: "platform", id: "system" },
		});
		if (!domainAdded.ok) throw new Error("setup failed");
		await tenant.confirmOrganizationDomain({
			organizationId: organization.id,
			domain: "acme-confirm.example",
		});

		let created = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "ada@acme-confirm.example" }],
		});
		if (!created.ok) throw new Error("setup failed");
		let added = await tenant.addIdentifier({
			subjectId: created.subjectId,
			kind: "email",
			value: "ada@acme-confirm.example",
			actor: { kind: "subject" },
		});
		if (!added.ok || added.kind !== "email") throw new Error("setup failed");
		await tenant.verifyIdentifier({ ticket: added.ticket });

		let started = await tenant.beginSamlSignIn({ slug: SLUG, hostname: HOSTNAME });
		if (!started.ok) throw new Error("begin refused");

		let signedIn = await tenant.signInWithSamlResponse({
			slug: SLUG,
			samlResponse: await respond(started.requestId, {
				nameId: "ada@acme-confirm.example",
				attributes: { email: ["ada@acme-confirm.example"] },
			}),
			relayState: relayStateOf(started.redirectUrl),
			hostname: HOSTNAME,
		});

		expect(signedIn.ok).toBe(false);
		if (signedIn.ok || signedIn.reason !== "link_required") {
			throw new Error(`expected link_required, got ${JSON.stringify(signedIn)}`);
		}
		expect(signedIn.ticket.length).toBeGreaterThan(10);
	});

	test("still creates a fresh subject when no existing identifier matches the assertion's address", async () => {
		let organization = await createOrg("acme-fresh", "owner-fresh@acme.test");
		let saved = await configure({ organizationId: organization.id, autoLink: true });
		if (!saved.ok) throw new Error("setup failed");

		let domainAdded = await tenant.addOrganizationDomain({
			organizationId: organization.id,
			domain: "acme-fresh.example",
			mode: "auto_join",
			actor: { type: "platform", id: "system" },
		});
		if (!domainAdded.ok) throw new Error("setup failed");
		await tenant.confirmOrganizationDomain({
			organizationId: organization.id,
			domain: "acme-fresh.example",
		});

		let started = await tenant.beginSamlSignIn({ slug: SLUG, hostname: HOSTNAME });
		if (!started.ok) throw new Error("begin refused");

		let signedIn = await tenant.signInWithSamlResponse({
			slug: SLUG,
			samlResponse: await respond(started.requestId, {
				nameId: "nobody-yet@acme-fresh.example",
				attributes: { email: ["nobody-yet@acme-fresh.example"] },
			}),
			relayState: relayStateOf(started.redirectUrl),
			hostname: HOSTNAME,
		});

		if (!signedIn.ok) throw new Error(`expected success, got ${JSON.stringify(signedIn)}`);
		expect(signedIn.subjectId).toBeTruthy();
	});
});
