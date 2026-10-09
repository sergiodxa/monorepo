/**
 * Live preview island for `Toast`. A notification is only worth looking at when
 * something raises it, so the example is the queue itself: a `Toaster` owning each
 * toast's timer behind a `Toast.Region`, and the buttons an app would raise them
 * from. The queue owns each countdown, so `dismiss()` is there for the close button's
 * own command, and the island pauses the countdown while the pointer rests on a toast.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { CircleAlertIcon, CircleCheckIcon, InfoIcon } from "@sdxc/icons";
import { hstack } from "@sdxc/u/layout";
import { Button, Toast } from "@sdxc/ui";
import { Toaster } from "@sdxc/ui/behaviors";
import { dismiss } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/component";

/** What each queued toast carries, which is all the region needs to draw one. */
interface Notice {
	color: Toast.Color;
	title: string;
	description: string;
	action?: string;
}

/** The three notices the buttons raise, so the queue stacks more than one shape. */
const NOTICES: Record<string, Notice> = {
	saved: {
		color: "success",
		title: "Changes published",
		description: "Your status page is live at status.acme.dev.",
		action: "Undo",
	},
	failed: {
		color: "danger",
		title: "Upload failed",
		description: "checks.yml was rejected: unknown key “retires”.",
		action: "Retry",
	},
	invited: {
		color: "brand",
		title: "Invitation sent",
		description: "sergio@aside.co can join until Friday.",
	},
};

/** The source the page shows, matching the markup below. */
const TOAST_CODE = `let toaster = new Toaster<Notice>({ defaultDuration: 6000 });
toaster.addEventListener("change", () => void handle.update());

<div mix={[hstack({ gap: 2, align: "center" })]}>
	<Button mix={[on<HTMLButtonElement, "click">("click", () => void toaster.add(notices.saved))]}>
		Publish
	</Button>
	<Button
		color="danger"
		variant="outline"
		mix={[on<HTMLButtonElement, "click">("click", () => void toaster.add(notices.failed))]}
	>
		Upload a bad file
	</Button>
	<Button
		variant="outline"
		mix={[on<HTMLButtonElement, "click">("click", () => void toaster.add(notices.invited))]}
	>
		Invite a teammate
	</Button>
</div>

<Toast.Region aria-label="Notifications" placement="bottom-end">
	{toaster.toasts.map((toast) => (
		<Toast
			key={toast.id}
			id={\`preview-toast-\${toast.id}\`}
			color={toast.data.color}
			live={toast.data.color === "danger" ? "assertive" : "polite"}
			mix={[
				// The queue owns the countdown, so the mixin is here only to answer
				// the close button's --ui-dismiss command.
				dismiss({ duration: null }),
				on<HTMLDivElement, "ui:dismiss">("ui:dismiss", () => void toaster.dismiss(toast.id)),
				on<HTMLDivElement, "pointerenter">("pointerenter", () => toaster.pause(toast.id)),
				on<HTMLDivElement, "pointerleave">("pointerleave", () => toaster.resume(toast.id)),
			]}
		>
			<Toast.Icon>
				{toast.data.color === "success" ? (
					<CircleCheckIcon />
				) : toast.data.color === "danger" ? (
					<CircleAlertIcon />
				) : (
					<InfoIcon />
				)}
			</Toast.Icon>
			<Toast.Content>
				<Toast.Title>{toast.data.title}</Toast.Title>
				<Toast.Description>{toast.data.description}</Toast.Description>
			</Toast.Content>
			{toast.data.action ? <Toast.Action>{toast.data.action}</Toast.Action> : null}
			<Toast.Close
				aria-label="Dismiss"
				commandfor={\`preview-toast-\${toast.id}\`}
				command="--ui-dismiss"
			/>
		</Toast>
	))}
</Toast.Region>`;

/** Buttons that raise real toasts, hydrated so the queue owns every timer. */
export const ToastPreview = clientEntry(import.meta.url, function ToastPreview(handle: Handle) {
	let toaster = new Toaster<Notice>({ defaultDuration: 6000 });

	// `handle.signal` is an inert stub during the server render, so the
	// subscription is plain: it dies with the island that owns the queue.
	toaster.addEventListener("change", () => void handle.update());

	return () => (
		<>
			<div mix={[hstack({ gap: 2, align: "center" })]}>
				<Button
					mix={[on<HTMLButtonElement, "click">("click", () => void toaster.add(NOTICES.saved!))]}
				>
					Publish
				</Button>
				<Button
					color="danger"
					variant="outline"
					mix={[on<HTMLButtonElement, "click">("click", () => void toaster.add(NOTICES.failed!))]}
				>
					Upload a bad file
				</Button>
				<Button
					variant="outline"
					mix={[on<HTMLButtonElement, "click">("click", () => void toaster.add(NOTICES.invited!))]}
				>
					Invite a teammate
				</Button>
			</div>

			<Toast.Region aria-label="Notifications" placement="bottom-end">
				{toaster.toasts.map((toast) => (
					<Toast
						key={toast.id}
						id={`preview-toast-${toast.id}`}
						color={toast.data.color}
						live={toast.data.color === "danger" ? "assertive" : "polite"}
						mix={[
							// The queue owns the countdown, so the mixin is here only to answer
							// the close button's --ui-dismiss command.
							dismiss({ duration: null }),
							on<HTMLDivElement, "ui:dismiss">("ui:dismiss", () => void toaster.dismiss(toast.id)),
							on<HTMLDivElement, "pointerenter">("pointerenter", () => toaster.pause(toast.id)),
							on<HTMLDivElement, "pointerleave">("pointerleave", () => toaster.resume(toast.id)),
						]}
					>
						<Toast.Icon>
							{toast.data.color === "success" ? (
								<CircleCheckIcon />
							) : toast.data.color === "danger" ? (
								<CircleAlertIcon />
							) : (
								<InfoIcon />
							)}
						</Toast.Icon>
						<Toast.Content>
							<Toast.Title>{toast.data.title}</Toast.Title>
							<Toast.Description>{toast.data.description}</Toast.Description>
						</Toast.Content>
						{toast.data.action ? <Toast.Action>{toast.data.action}</Toast.Action> : null}
						<Toast.Close
							aria-label="Dismiss"
							commandfor={`preview-toast-${toast.id}`}
							command="--ui-dismiss"
						/>
					</Toast>
				))}
			</Toast.Region>
		</>
	);
});

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: TOAST_CODE, render: () => <ToastPreview /> };
