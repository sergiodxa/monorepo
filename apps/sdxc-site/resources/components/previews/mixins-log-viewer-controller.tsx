/**
 * Live demo for `logViewerController()`: a failed CI job whose search field finds matches across every
 * step, closed ones included, and steps to each with Enter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import preview from "~/resources/components/previews/log-viewer";

/** What the preview registry reads: the component carrying the mixin, and its source. */
export default {
	code: `// LogViewer's controller island carries logViewerController(), which searches every step and follows new lines.\n${preview.code}`,
	render: preview.render,
};
