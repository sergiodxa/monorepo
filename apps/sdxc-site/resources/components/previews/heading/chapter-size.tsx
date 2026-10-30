/**
 * Live example for a `Heading` at marketing chapter size — the section H2
 * scale from `--ui-marketing-chapter-size`, fluid from 28px on a phone to 48px wide.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Heading } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Heading size="chapter">Tell customers before they ask</Heading>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Chapter size",
	code: CODE,
	render: () => <Heading size="chapter">Tell customers before they ask</Heading>,
};
