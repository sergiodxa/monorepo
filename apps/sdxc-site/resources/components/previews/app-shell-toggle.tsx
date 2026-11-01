/**
 * Live preview for `AppShellToggle`, the island an `AppShell` renders beside its collapse
 * checkbox. It shows the shell collapsed to its rail, where ⌘B and the toggle write the
 * cookie the server reads on the next request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { OpsShell } from "~/resources/components/previews/app-shell";

/** The source the page shows: the shell renders the toggle, so an app writes none itself. */
const CODE = `<AppShell
	labels={{ nav: "Main", skip: "Skip to content", menu: "Menu", close: "Close menu", collapse: "Collapse sidebar" }}
	collapsed={readAppShellCookie(request.headers.get("Cookie"))}
	nav={nav}
>
	{page}
</AppShell>`;

/** What the preview registry reads: the source to show, and the shell to draw. */
export default {
	code: CODE,
	flush: true,
	render: () => <OpsShell id="preview-app-shell-toggle" collapsed />,
};
