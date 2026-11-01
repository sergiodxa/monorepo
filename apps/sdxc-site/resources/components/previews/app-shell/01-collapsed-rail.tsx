/**
 * Live example for a collapsed `AppShell`: the sidebar as its icon rail, as the server draws
 * it when the collapse cookie says so. Resting the pointer on the rail opens it over the
 * content without moving the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { OpsShell } from "~/resources/components/previews/app-shell";

/** The source the page shows, matching the markup below. */
const CODE = `<AppShell
	labels={labels}
	collapsed={readAppShellCookie(request.headers.get("Cookie"))}
	workspace={workspace}
	nav={nav}
	footer={footer}
>
	{page}
</AppShell>`;

/** What the preview registry reads: the title, the source to show, and the shell to draw. */
export default {
	title: "Collapsed to the icon rail",
	code: CODE,
	flush: true,
	render: () => <OpsShell id="preview-app-shell-rail" collapsed />,
};
