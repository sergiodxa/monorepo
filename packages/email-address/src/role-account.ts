/**
 * Role-account detection: local parts that name a function rather than a person — the
 * RFC 2142 mailboxes, `admin`, `noreply` and the like — which an app may refuse at sign-up
 * because several people share them or nobody reads them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { EmailAddress } from "./parse.js";

/** The failure `checkRoleAccount` returns; `role` is the list entry the local part matched. */
export class RoleAccountError extends Error {
	override name = "RoleAccountError";

	readonly reason = "role-account";

	readonly role: string;

	/** @param role - The role mailbox the local part names. */
	constructor(role: string) {
		super(`${role} is a role account`);
		this.role = role;
	}
}

/** RFC 2142's mailbox names plus the shared and unattended ones sign-up forms see most. */
const ROLE_ACCOUNTS = new Set([
	"abuse",
	"admin",
	"administrator",
	"billing",
	"contact",
	"do-not-reply",
	"donotreply",
	"ftp",
	"help",
	"hostmaster",
	"info",
	"mailer-daemon",
	"marketing",
	"news",
	"no-reply",
	"noc",
	"noreply",
	"postmaster",
	"root",
	"sales",
	"security",
	"support",
	"sysadmin",
	"usenet",
	"uucp",
	"webmaster",
	"www",
]);

/**
 * Refuses an address whose local part is a role mailbox, compared case-insensitively
 * with any `+tag` removed, so `Support+billing@` matches `support`. Only the whole local
 * part counts: `sales-jane@` passes.
 *
 * @param address - A parsed address.
 * @returns The same address, or the role it names.
 */
export function checkRoleAccount(address: EmailAddress): Result<EmailAddress, RoleAccountError> {
	let role = address.localPart.toLowerCase().split("+", 1)[0] ?? "";
	return ROLE_ACCOUNTS.has(role) ? failure(new RoleAccountError(role)) : success(address);
}
