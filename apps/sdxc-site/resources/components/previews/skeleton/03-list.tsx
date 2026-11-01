/**
 * Live example for `Skeleton.List`: an inbox's loading state, two-line rows with an avatar
 * at the real row height.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Skeleton } from "@sdxc/ui/app/skeleton";

/** The source the page shows, matching the markup below. */
const CODE = `<Skeleton.List rows={4} avatar label="Loading conversations" />`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "List",
	code: CODE,
	render: () => <Skeleton.List rows={4} avatar label="Loading conversations" />,
};
