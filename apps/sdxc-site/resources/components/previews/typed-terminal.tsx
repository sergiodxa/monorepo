/**
 * Live preview for `TypedTerminal`: a browser flow spec types itself out line by line, its
 * run prints a passing result, and the session holds before the loop restarts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { TypedTerminal } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<TypedTerminal
	aria-label="A sign-in spec and its run"
	pauseLabel="Pause the animation"
	title="specs/sign-in.spec"
	lines={[
		{ kind: "input", text: 'visit "/login"' },
		{ kind: "input", text: 'fill "Email" with "ada@example.com"' },
		{ kind: "input", text: 'click "Sign in"' },
		{ kind: "input", text: 'see "Welcome back, Ada"' },
		{ kind: "output", text: "✓ 4 steps · 2.1s", status: "ok" },
	]}
/>`;

/** What the preview registry reads: the source to show, and the terminal to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", maxInlineSize: "32rem", marginInline: "auto" })]}>
			<TypedTerminal
				aria-label="A sign-in spec and its run"
				pauseLabel="Pause the animation"
				title="specs/sign-in.spec"
				lines={[
					{ kind: "input", text: 'visit "/login"' },
					{ kind: "input", text: 'fill "Email" with "ada@example.com"' },
					{ kind: "input", text: 'click "Sign in"' },
					{ kind: "input", text: 'see "Welcome back, Ada"' },
					{ kind: "output", text: "✓ 4 steps · 2.1s", status: "ok" },
				]}
			/>
		</div>
	),
};
