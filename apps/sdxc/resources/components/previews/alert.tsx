/**
 * Live preview island for `Alert`. The component paints the tone, the icon well and the
 * action row; an alert that goes away again is the consumer's to arrange, so the preview
 * carries the same `dismiss()` wiring a reader would write — the `--ui-dismiss` command
 * aimed at the host, and the `ui:dismiss` listener that takes it off the page, since the
 * mixin only announces the dismissal.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { CircleAlertIcon, CircleCheckIcon, TriangleAlertIcon } from "@sdxc/icons";
import { self, vstack } from "@sdxc/u/layout";
import { is, maxIs } from "@sdxc/u/size";
import { Alert, Button } from "@sdxc/ui";
import { dismiss } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/component";

/** The source the page shows, matching the markup below. */
const CODE = `let dismissed = false;

function toggleDismissed() {
	dismissed = !dismissed;
	void handle.update();
}

<div mix={[vstack({ gap: 3, align: "stretch" }), is("100%"), maxIs("34rem")]}>
	<Alert color="danger" live="assertive">
		<Alert.Icon>
			<CircleAlertIcon />
		</Alert.Icon>
		<Alert.Content>
			<Alert.Title>We could not charge your card</Alert.Title>
			<Alert.Description>
				Visa ending 4242 was declined on 14 September. Invoices stay open for seven days
				before the workspace drops to the free plan.
			</Alert.Description>
		</Alert.Content>
		<Alert.Action>
			<Button type="button" color="danger" size="sm">
				Update card
			</Button>
		</Alert.Action>
	</Alert>

	{dismissed ? (
		<Button
			type="button"
			variant="outline"
			color="neutral"
			size="sm"
			mix={[self("start"), on<HTMLButtonElement, "click">("click", toggleDismissed)]}
		>
			Show the dismissible alert
		</Button>
	) : (
		<Alert
			id="preview-alert-quota"
			color="warning"
			// A page is read at its own pace, so the countdown stays off and dismissal
			// comes only from the button. A queued notice passes a duration instead.
			mix={[
				dismiss({ duration: null }),
				on<HTMLDivElement, "ui:dismiss">("ui:dismiss", toggleDismissed),
			]}
		>
			<Alert.Icon>
				<TriangleAlertIcon />
			</Alert.Icon>
			<Alert.Content>
				<Alert.Title>You are at 92% of your build minutes</Alert.Title>
				<Alert.Description>
					Builds keep running past the limit and bill at $0.008 per minute.
				</Alert.Description>
			</Alert.Content>
			<Alert.Action>
				<Button
					type="button"
					variant="ghost"
					color="warning"
					size="sm"
					commandfor="preview-alert-quota"
					command="--ui-dismiss"
				>
					Dismiss
				</Button>
			</Alert.Action>
		</Alert>
	)}

	<Alert color="success">
		<Alert.Icon>
			<CircleCheckIcon />
		</Alert.Icon>
		<Alert.Content>
			<Alert.Title>Domain verified</Alert.Title>
			<Alert.Description>acme.com now serves your workspace over HTTPS.</Alert.Description>
		</Alert.Content>
	</Alert>
</div>`;

/** A notice stack whose middle alert dismisses, hydrated so its command has something to answer. */
export const AlertPreview = clientEntry(import.meta.url, function AlertPreview(handle: Handle) {
	let dismissed = false;

	/** A reader who dismissed the alert gets it back, so the preview stays worth looking at. */
	function toggleDismissed() {
		dismissed = !dismissed;
		void handle.update();
	}

	return () => (
		<div mix={[vstack({ gap: 3, align: "stretch" }), is("100%"), maxIs("34rem")]}>
			<Alert color="danger" live="assertive">
				<Alert.Icon>
					<CircleAlertIcon />
				</Alert.Icon>
				<Alert.Content>
					<Alert.Title>We could not charge your card</Alert.Title>
					<Alert.Description>
						Visa ending 4242 was declined on 14 September. Invoices stay open for seven days before
						the workspace drops to the free plan.
					</Alert.Description>
				</Alert.Content>
				<Alert.Action>
					<Button type="button" color="danger" size="sm">
						Update card
					</Button>
				</Alert.Action>
			</Alert>

			{dismissed ? (
				<Button
					type="button"
					variant="outline"
					color="neutral"
					size="sm"
					mix={[self("start"), on<HTMLButtonElement, "click">("click", toggleDismissed)]}
				>
					Show the dismissible alert
				</Button>
			) : (
				<Alert
					id="preview-alert-quota"
					color="warning"
					// A page is read at its own pace, so the countdown stays off and dismissal
					// comes only from the button. A queued notice passes a duration instead.
					mix={[
						dismiss({ duration: null }),
						on<HTMLDivElement, "ui:dismiss">("ui:dismiss", toggleDismissed),
					]}
				>
					<Alert.Icon>
						<TriangleAlertIcon />
					</Alert.Icon>
					<Alert.Content>
						<Alert.Title>You are at 92% of your build minutes</Alert.Title>
						<Alert.Description>
							Builds keep running past the limit and bill at $0.008 per minute.
						</Alert.Description>
					</Alert.Content>
					<Alert.Action>
						<Button
							type="button"
							variant="ghost"
							color="warning"
							size="sm"
							commandfor="preview-alert-quota"
							command="--ui-dismiss"
						>
							Dismiss
						</Button>
					</Alert.Action>
				</Alert>
			)}

			<Alert color="success">
				<Alert.Icon>
					<CircleCheckIcon />
				</Alert.Icon>
				<Alert.Content>
					<Alert.Title>Domain verified</Alert.Title>
					<Alert.Description>acme.com now serves your workspace over HTTPS.</Alert.Description>
				</Alert.Content>
			</Alert>
		</div>
	);
});

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <AlertPreview /> };
