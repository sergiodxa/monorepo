/**
 * The `lookup` handler: one `RDAP.domain` lookup printed as a labelled summary for people, or as
 * the domain model for scripts under `--json`, without the raw response and each contact's
 * JSContact card so the shape stays small and stable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import type { RDAP } from "./rdap.js";

import { client, day, lookupFailed } from "./cli-client.js";
import { RDAP_COMMANDS } from "./cli-contract.js";
import { isRedacted } from "./redacted.js";

/** How `secureDNS.delegationSigned` reads, keyed by its value as text. */
const DNSSEC_LABELS: Record<string, string> = { true: "signed", false: "unsigned" };

/** Milliseconds in a day, for the "in N days" beside the expiry. */
const DAY_MS = 86_400_000;

/**
 * The expiry with how far away it is, counted in whole days from `now`.
 *
 * @param expiresAt - Epoch milliseconds, or `null` when the registry published none
 * @param now - The moment the distance is measured from
 */
function expiry(expiresAt: number | null, now: number): string {
	if (expiresAt === null) return day(null);
	let days = Math.floor((expiresAt - now) / DAY_MS);
	if (days < 0) return `${day(expiresAt)} (${-days} days ago)`;
	return `${day(expiresAt)} (in ${days} days)`;
}

/**
 * One contact as a line: its roles, then the name, organization and emails it publishes, or
 * whether the registry withheld it.
 *
 * @param domain - The lookup the contact belongs to, for its redactions
 * @param contact - The entity to describe
 */
function contactLine(domain: RDAP.Domain, contact: RDAP.Contact): string {
	let details = [contact.name, contact.organization, ...contact.emails].filter(Boolean);
	let roles = contact.roles.join(", ") || "contact";
	if (details.length > 0) return `${roles}: ${details.join(", ")}`;
	let redacted = contact.roles.some((role) => isRedacted(domain, `${role}.contact`));
	return `${roles}: ${redacted ? "redacted by the registry" : "no details published"}`;
}

/**
 * The summary a person reads, one labelled row per field.
 *
 * @param domain - The registration to print
 * @param now - The moment the expiry distance is measured from
 */
function summary(domain: RDAP.Domain, now: number): string {
	let { registrar } = domain;
	let contacts = domain.contacts.map((contact) => contactLine(domain, contact));
	let rows: [string, string][] = [
		["Domain", domain.unicodeName ? `${domain.name} (${domain.unicodeName})` : domain.name],
		["Expires", expiry(domain.expiresAt, now)],
		["Registered", day(domain.registeredAt)],
		["Updated", day(domain.updatedAt)],
		["Status", domain.status.join(", ") || "none published"],
		["Registrar", registrarLine(registrar)],
		["Abuse", registrar?.abuseEmail ?? "not published"],
		["Nameservers", domain.nameservers.join(", ") || "none published"],
		["DNSSEC", DNSSEC_LABELS[String(domain.dnssec)] ?? "not published"],
		["Contacts", contacts.join("\n" + " ".repeat(13)) || "none published"],
		["Server", domain.server],
	];
	return rows.map(([label, value]) => `${label.padEnd(13)}${value}\n`).join("");
}

/**
 * The registrar's name with its IANA Registrar ID.
 *
 * @param registrar - The registrar of record, or `null` when the registry names none
 */
function registrarLine(registrar: RDAP.Registrar | null): string {
	if (registrar?.name == null) return "not published";
	return registrar.ianaId ? `${registrar.name} (IANA ${registrar.ianaId})` : registrar.name;
}

/**
 * The `--json` report: the domain model as the library answers it, dates in epoch
 * milliseconds, minus the raw `document` and each contact's `card`.
 *
 * @param domain - The registration to report
 */
function report(domain: RDAP.Domain) {
	let { document: _document, contacts, ...rest } = domain;
	return { ...rest, contacts: contacts.map(({ card: _card, ...contact }) => contact) };
}

/** Looks the domain up and prints it; a failed lookup exits 1, a malformed name 2. */
export default createCommand(RDAP_COMMANDS.lookup, async (ctx) => {
	let looked = await client(ctx.flags).domain(ctx.arguments.domain, {
		related: ctx.flags.related,
	});
	if (isFailure(looked)) return lookupFailed(looked.error, ctx.flags.json, ctx.stdout);

	if (ctx.flags.json) ctx.stdout(`${JSON.stringify(report(looked.data), null, 2)}\n`);
	else ctx.stdout(summary(looked.data, Date.now()));
	return success();
});
