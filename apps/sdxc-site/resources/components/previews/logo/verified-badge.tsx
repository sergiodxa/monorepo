/**
 * Live example for a large `Logo` carrying a verified badge. The badge is a bare `<span>`,
 * so it takes `role="img"` for its `aria-label` to reach assistive technology; the mark is
 * a data URI, which keeps the example's markup free of network requests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Logo } from "@sdxc/ui";

/** An organization mark drawn as a data URI, so the example fetches nothing to render. */
const MARK =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Crect width='8' height='8' fill='%230f766e'/%3E%3Cpath d='M2 6 4 2l2 4z' fill='%23fff'/%3E%3C/svg%3E";

/** The source the page shows, matching the markup below. */
const CODE = `<Logo size="lg">
	<Logo.Image src={MARK} alt="Acme" />
	<Logo.Fallback>AC</Logo.Fallback>
	<Logo.Badge role="img" aria-label="Verified organization" />
</Logo>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "With a verified badge",
	code: CODE,
	render: () => (
		<Logo size="lg">
			<Logo.Image src={MARK} alt="Acme" />
			<Logo.Fallback>AC</Logo.Fallback>
			<Logo.Badge role="img" aria-label="Verified organization" />
		</Logo>
	),
};
