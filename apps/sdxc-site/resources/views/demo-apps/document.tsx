/**
 * The document every demo app screen renders in: the site's head with `noindex, nofollow`,
 * the app's theme around its frame, and one toast region. Both the screen route and a form
 * post that answers with a screen draw through it, so the two look alike.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Toast } from "@sdxc/ui/app";
import type { Handle } from "remix/component";

import { Toasts } from "@sdxc/ui/app/toasts";

import type { DemoApp, DemoAppScreen } from "~/resources/views/demo-apps";

import DemoTheme from "~/resources/components/demo-theme";
import DocumentLayout from "~/resources/layouts/document";

/** The directive every demo carries, which keeps it out of results and its links unfollowed. */
const DEMO_ROBOTS = "noindex, nofollow";

/** The toast region's strings, shared by every demo app. */
const TOAST_LABELS = { region: "Notifications", dismiss: "Dismiss" };

namespace DemoAppDocument {
	export interface Props {
		assets: DocumentAssets;
		app: DemoApp;
		screen: DemoAppScreen;
		/** The toast to show once, by the app's key and its id on the page; an unknown key shows nothing. */
		toast: { key: string; id: string } | null;
	}
}

/**
 * Renders one screen of a demo app. The toast's id comes from its address, so the region shows
 * each post's toast once, and a reload of the same address adds none.
 */
export default function DemoAppDocument(handle: Handle<DemoAppDocument.Props>) {
	return () => {
		let { app, assets, screen, toast } = handle.props;
		let message =
			toast !== null && Object.hasOwn(app.toasts, toast.key) ? app.toasts[toast.key] : undefined;
		let flashes: Toast.Flash[] =
			message === undefined || toast === null ? [] : [{ ...message, id: toast.id }];

		return (
			<DocumentLayout
				assets={assets}
				title={`${screen.title} — ${app.name}`}
				description={app.description}
				robots={DEMO_ROBOTS}
				siteFooter={false}
			>
				<DemoTheme brand={app.theme.brand} neutral={app.theme.neutral} tokens={app.theme.tokens}>
					{screen.body}
					<Toasts labels={TOAST_LABELS} initial={flashes} />
				</DemoTheme>
			</DocumentLayout>
		);
	};
}
