/**
 * The `sdxc-email-address check` handler: parses each address with `parseEmailAddress`, then
 * runs `findDisposableDomain` and `checkMailServer` on it and prints one line per address, or
 * the report as JSON for a script. The exit code carries the outcome either way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Style } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { createCommand, exit, success, usage } from "@sdxc/cli";

import type { MailServerError, MailServerReason, MailServers } from "./mail-server.js";
import type { EmailAddressReason } from "./parse.js";

import { EMAIL_ADDRESS_COMMANDS } from "./cli-contract.js";
import { findDisposableDomain } from "./disposable.js";
import { checkMailServer } from "./mail-server.js";
import { parseEmailAddress } from "./parse.js";

/** What `check` found about one input line; `--json` prints these under `results`. */
interface AddressReport {
	input: string;
	/** The address passed every check that ran. */
	ok: boolean;
	/** The form to store and deliver to; `null` when the input did not parse. */
	address: string | null;
	/** The form to compare on; `null` when the input did not parse. */
	canonical: string | null;
	/** The ASCII domain; `null` when the input did not parse. */
	domain: string | null;
	/** The parse rule the input failed. */
	invalid: EmailAddressReason | null;
	/** The listed disposable domain the address's domain equals or sits under. */
	disposable: string | null;
	/** The mail hosts; `null` when the lookup was skipped or refused the domain. */
	mailServers: Pick<MailServers, "hosts" | "implicit"> | null;
	/** Why the domain cannot be confirmed to receive mail. */
	mailServerError: MailServerReason | null;
}

/** How each mail-server failure reads in the human report. */
const MAIL_SERVER_PROBLEMS: { [Reason in MailServerReason]: string } = {
	"null-mx": "domain refuses mail (null MX)",
	"no-mail-server": "no mail server",
	"domain-not-found": "domain does not exist",
	"lookup-failed": "mail-server lookup failed",
};

/**
 * Checks the argument, or every non-blank line of stdin for `-`, looking each domain up once.
 * Empty input and a terminal on stdin are usage errors, so a bare run answers at once.
 */
export default createCommand(EMAIL_ADDRESS_COMMANDS.check, async (ctx) => {
	let address = ctx.arguments.address ?? "-";
	let inputs = [address];
	if (address === "-") {
		if (ctx.stdin.isTTY) return usage("Pass an address, or pipe one per line on stdin");
		inputs = (await ctx.stdin.text())
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line.length > 0);
		if (inputs.length === 0) return exit(2, "No addresses on stdin");
	}

	let lookups = new Map<string, Promise<Result<MailServers, MailServerError>>>();
	let lookup = (domain: string) => {
		let pending = lookups.get(domain) ?? checkMailServer(domain, { signal: ctx.signal });
		lookups.set(domain, pending);
		return pending;
	};

	let reports: AddressReport[] = [];
	for (let input of inputs) {
		reports.push(await checkAddress(input, ctx.flags.skipMx ? null : lookup));
	}

	let ok = reports.every((report) => report.ok);
	ctx.stdout(
		ctx.flags.json
			? `${JSON.stringify({ ok, results: reports }, null, 2)}\n`
			: formatReport(reports, ctx.style),
	);
	return ok ? success() : exit(1);
});

/**
 * Runs every check on one input; an address that fails to parse skips the domain checks.
 *
 * @param lookup - Resolves a domain's mail servers, or `null` to leave the lookup out
 */
async function checkAddress(
	input: string,
	lookup: ((domain: string) => Promise<Result<MailServers, MailServerError>>) | null,
): Promise<AddressReport> {
	let parsed = parseEmailAddress(input);
	if (parsed.status === "failure") {
		return {
			input,
			ok: false,
			address: null,
			canonical: null,
			domain: null,
			invalid: parsed.error.reason,
			disposable: null,
			mailServers: null,
			mailServerError: null,
		};
	}

	let { address, canonical, domain } = parsed.data;
	let disposable = findDisposableDomain(domain);
	let servers = lookup === null ? null : await lookup(domain);
	let mailServers =
		servers?.status === "success"
			? { hosts: servers.data.hosts, implicit: servers.data.implicit }
			: null;
	let mailServerError = servers?.status === "failure" ? servers.error.reason : null;

	return {
		input,
		ok: disposable === null && mailServerError === null,
		address,
		canonical,
		domain,
		invalid: null,
		disposable,
		mailServers,
		mailServerError,
	};
}

/** The report for a person: one marked line per address, then a tally when there are several. */
function formatReport(reports: AddressReport[], style: Style): string {
	let lines = reports.map((report) => {
		let mark = report.ok ? style.green("✓") : style.red("✗");
		return `${mark} ${report.address ?? report.input}  ${describe(report)}`.trimEnd();
	});
	if (reports.length > 1) {
		let failed = reports.filter((report) => !report.ok).length;
		lines.push("", `${reports.length - failed} passed, ${failed} failed`);
	}
	return `${lines.join("\n")}\n`;
}

/** What a line says after the address: its problems, or where its mail goes. */
function describe(report: AddressReport): string {
	if (report.invalid !== null) return `invalid: ${report.invalid}`;

	let problems: string[] = [];
	if (report.disposable !== null) problems.push(`disposable domain (${report.disposable})`);
	if (report.mailServerError !== null) {
		problems.push(MAIL_SERVER_PROBLEMS[report.mailServerError]);
	}
	if (problems.length > 0) return problems.join(", ");

	if (report.mailServers === null) return "";
	let via = `mail via ${report.mailServers.hosts.join(", ")}`;
	return report.mailServers.implicit ? `${via} (no MX, its own address)` : via;
}
