/**
 * Checks the status vocabulary: RDAP's words converted to EPP spelling for every listed
 * status, and a value outside the list kept exactly as the registry wrote it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { EPP_STATUSES, eppStatus } from "./status.js";

/** Spells an EPP code the way RFC 8056 writes it in RDAP: lowercase words. */
function rdapWords(code: string): string {
	return code.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`);
}

describe("eppStatus", () => {
	test.each(EPP_STATUSES.map((code) => [rdapWords(code), code]))("%j → %s", (words, code) => {
		expect(eppStatus(words)).toBe(code);
	});

	test("tolerates case and spacing", () => {
		expect(eppStatus("  Client  Transfer Prohibited ")).toBe("clientTransferProhibited");
	});

	test("keeps an unknown value as written", () => {
		expect(eppStatus("Registrar Experimental Hold")).toBe("Registrar Experimental Hold");
	});
});
