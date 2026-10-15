/**
 * Live example for a `Heading` with no `level`. It takes its depth from the nearest
 * `HeadingScope`, and with none around it renders the top-level `<h1>`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Heading } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Heading>Billing settings</Heading>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Level from context",
	code: CODE,
	render: () => <Heading>Billing settings</Heading>,
};
