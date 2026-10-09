/**
 * Live example for a large `Avatar` carrying a status dot. The dot is a bare `<span>`, so
 * it takes `role="img"` for its `aria-label` to reach assistive technology; the portrait is
 * a data URI, which keeps the example's markup free of network requests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Avatar } from "@sdxc/ui";

/** A portrait drawn as a data URI, so the example fetches nothing to render. */
const PORTRAIT =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Crect width='8' height='8' fill='%236366f1'/%3E%3Ccircle cx='4' cy='3' r='1.5' fill='%23fff'/%3E%3Cpath d='M1 8a3 3 0 0 1 6 0z' fill='%23fff'/%3E%3C/svg%3E";

/** The source the page shows, matching the markup below. */
const CODE = `<Avatar size="lg">
	<Avatar.Image src={PORTRAIT} alt="Ana Souza" />
	<Avatar.Fallback>AS</Avatar.Fallback>
	<Avatar.Badge role="img" aria-label="Online" />
</Avatar>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "With a status badge",
	code: CODE,
	render: () => (
		<Avatar size="lg">
			<Avatar.Image src={PORTRAIT} alt="Ana Souza" />
			<Avatar.Fallback>AS</Avatar.Fallback>
			<Avatar.Badge role="img" aria-label="Online" />
		</Avatar>
	),
};
