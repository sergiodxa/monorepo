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
import { generateUUID } from "@sdxc/uuid/v4";

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
		/** A key of the app's toasts to show once; any other value shows nothing. */
		toast: string | null;
	}
}

/**
 * Renders one screen of a demo app. The toast region is keyed by a fresh id whenever it holds
 * a toast, so a form answered in place by the client runtime mounts a new region and shows it.
 */
export default function DemoAppDocument(handle: Handle<DemoAppDocument.Props>) {
	return () => {
		let { app, assets, screen, toast } = handle.props;
		let message =
			toast !== null && Object.hasOwn(app.toasts, toast) ? app.toasts[toast] : undefined;
		let flashes: Toast.Flash[] = message === undefined ? [] : [{ ...message, id: generateUUID() }];

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
					<Toasts key={flashes[0]?.id ?? "toasts"} labels={TOAST_LABELS} initial={flashes} />
				</DemoTheme>
			</DocumentLayout>
		);
	};
}
