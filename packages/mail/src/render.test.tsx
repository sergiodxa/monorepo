/**
 * Tests that rendering a body tree yields both parts of a message from one authored
 * source: serialized HTML, and a plain-text alternative carrying the same copy and
 * the same link targets.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { describe, expect, test } from "vitest";

import { render } from "./render.js";

namespace InviteBody {
	export interface Props {
		team: string;
		url: string;
	}
}

/** Minimal body used to check that both parts come from the same tree. */
function InviteBody(handle: Handle<InviteBody.Props>) {
	return () => {
		let { team, url } = handle.props;

		return (
			<div>
				<p>You have been invited to join {team}.</p>
				<p>
					<a href={url}>Accept invite</a>
				</p>
			</div>
		);
	};
}

describe("render", () => {
	test("serializes the tree to HTML", async () => {
		let { html } = await render(<InviteBody team="Acme" url="https://example.com/invite/1" />);

		expect(html).toContain("<p>You have been invited to join Acme.</p>");
		expect(html).toContain('href="https://example.com/invite/1"');
	});

	test("derives a plain-text part from the same tree", async () => {
		let { text } = await render(<InviteBody team="Acme" url="https://example.com/invite/1" />);

		expect(text).toBe(
			"You have been invited to join Acme.\n\nAccept invite (https://example.com/invite/1)",
		);
	});

	test("keeps every link target in the text part, since it has no clickable markup", async () => {
		let url = "https://example.com/invite/1?token=abc";
		let { text } = await render(<InviteBody team="Acme" url={url} />);

		expect(text).toContain(url);
	});
});
