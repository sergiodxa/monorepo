/**
 * Expands the RFC 8620 example session's URL templates the way RFC 6570 level 1
 * defines, percent-encoding everything outside the unreserved set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { SESSION } from "./fixtures/rfc8620.js";
import { expand } from "./uri-template.js";

describe("expand", () => {
	test("fills the download template, encoding the slash in a media type", () => {
		let url = expand(SESSION.downloadUrl, {
			accountId: "A13824",
			blobId: "B841623871",
			name: "invite.ics",
			type: "text/calendar",
		});

		expect(url).toBe(
			"https://jmap.example.com/download/A13824/B841623871/invite.ics?accept=text%2Fcalendar",
		);
	});

	test("encodes the sub-delimiters encodeURIComponent keeps", () => {
		expect(expand("/{name}", { name: "it's (a)*!" })).toBe("/it%27s%20%28a%29%2A%21");
	});

	test("expands an undefined variable to the empty string", () => {
		expect(expand(SESSION.uploadUrl, {})).toBe("https://jmap.example.com/upload//");
	});
});
