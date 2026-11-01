/**
 * The island that draws the page's one toast stack: server flash toasts and
 * toasts raised through `pageToaster()` share a region, timing, pause on hover
 * or focus, and close, so an app runs a single toast system.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle } from "remix/component";

import {
	CircleAlertIcon,
	CircleCheckIcon,
	InfoIcon,
	LoaderCircleIcon,
	TriangleAlertIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { clientEntry } from "remix/component";

import { spin } from "../animations/keyframes.js";
import { whileLive } from "../mixins/while-live.js";

import type { Toaster } from "./behaviors/toaster.js";

import { toastAction, toastClose, toastHold } from "./mixins/toast-queue.js";
import { toastStack } from "./mixins/toast-stack.js";
import { pageToaster, Toast } from "./toast.js";

/** Tone a {@link Toast.Message} takes when it names none. */
const DEFAULT_COLOR: Toast.Color = "neutral";

/** Prop types for {@link Toasts}. */
export namespace Toasts {
	/** Props accepted by {@link Toasts}. */
	export interface Props {
		/** Strings the region and its close buttons announce. */
		labels: Toast.Labels;
		/** Toasts the server rendered from a session flash; hydration adopts each element and starts its timer. */
		initial?: Toast.Flash[];
		/** Corner of the viewport. Default: `"bottom-end"`. */
		placement?: Toast.Placement;
		/** Most toasts shown at once. Default: `3`. */
		max?: number;
		/** Peek stack or plain list. Default: `"peek"`. */
		stack?: Toast.Stack;
		/** Which `pageToaster()` queue to draw; a page normally has one. Default: `"page"`. */
		queue?: string;
	}

	/** Props of one drawn toast inside {@link Toasts}. */
	export interface ItemProps {
		/** Queue id, also the base of the element id the close button targets. */
		id: string;
		/** What the toast says and offers. */
		message: Toast.Message;
		/** Strings the close button announces. */
		labels: Toast.Labels;
		/** The queue the toast belongs to, which its close and action report to. */
		toaster: Toaster<Toast.Message>;
	}
}

/**
 * The app's one toast stack. A flash toast shows and closes without JavaScript;
 * hydration adopts the same element and only then starts its timer. Reach for a
 * toast last, after an inline message or a banner.
 *
 * @example
 * <Toasts labels={{ region: t("toasts.region"), dismiss: t("toasts.dismiss") }} initial={flash ? [flash] : []} />
 */
export const Toasts: EntryComponent<Toasts.Props> = clientEntry(
	"@sdxc/ui/app/toasts#Toasts",
	function Toasts(handle: Handle<Toasts.Props>) {
		let toaster = pageToaster(handle.props.queue);
		let adopted = false;

		whileLive(handle, (queue: Toaster<Toast.Message>, signal) => {
			queue.addEventListener("change", () => void handle.update(), { signal });
		})(toaster);

		handle.queueTask(() => {
			for (let flash of handle.props.initial ?? []) {
				if (toaster.get(flash.id)) continue;
				toaster.add(flash, { id: flash.id, duration: flash.duration });
			}

			adopted = true;
			void handle.update();
		});

		return () => {
			let { labels, initial = [], placement, max, stack } = handle.props;
			let items = adopted
				? toaster.toasts.map((toast) => ({ id: toast.id, message: toast.data }))
				: initial.map((flash) => ({ id: flash.id, message: flash as Toast.Message }));

			return (
				<Toast.Region
					aria-label={labels.region}
					placement={placement}
					max={max}
					stack={stack}
					mix={[toastHold(toaster), toastStack()]}
				>
					{items.map((item) => (
						<ToastItem
							key={item.id}
							id={item.id}
							message={item.message}
							labels={labels}
							toaster={toaster}
						/>
					))}
				</Toast.Region>
			);
		};
	},
);

/**
 * Draws one queued {@link Toast.Message} inside an open, non-modal `<dialog>`,
 * whose close button uses the native `close` command, so a server-rendered
 * toast closes without JavaScript and the queue hears the same `close` event.
 *
 * @param handle Runtime handle carrying {@link Toasts.ItemProps}.
 * @returns The render function producing the toast's markup.
 */
function ToastItem(handle: Handle<Toasts.ItemProps>) {
	return () => {
		let { id, message, labels, toaster } = handle.props;
		let domId = `toast-${id}`;
		let color = message.color ?? DEFAULT_COLOR;
		let action = message.action;

		return (
			<dialog
				open
				id={domId}
				aria-labelledby={`${domId}-title`}
				data-slot="toast-item"
				mix={[
					toastClose(toaster, id),
					raw({
						position: "relative",
						inset: "auto",
						inlineSize: "100%",
						margin: "0",
						padding: "0",
						border: "0",
						background: "transparent",
						color: "inherit",
					}),
				]}
			>
				<Toast
					color={color}
					live={color === "danger" ? "assertive" : "polite"}
					aria-busy={message.loading ? "true" : undefined}
				>
					{message.loading ? (
						<Toast.Loader mix={[spin()]}>
							<LoaderCircleIcon size={16} />
						</Toast.Loader>
					) : (
						<Toast.Icon>
							<ToastColorIcon color={color} />
						</Toast.Icon>
					)}
					<Toast.Content>
						<Toast.Title id={`${domId}-title`}>{message.title}</Toast.Title>
						{message.description ? (
							<Toast.Description>{message.description}</Toast.Description>
						) : null}
					</Toast.Content>
					{action?.form ? (
						<form
							method={action.form.method ?? "post"}
							action={action.form.action}
							mix={[raw({ display: "contents" })]}
						>
							{Object.entries(action.form.fields ?? {}).map(([name, value]) => (
								<input key={name} type="hidden" name={name} value={value} />
							))}
							<Toast.Action type="submit" mix={[toastAction(toaster, id, action.onAction)]}>
								{action.label}
							</Toast.Action>
						</form>
					) : null}
					{action && !action.form ? (
						<Toast.Action mix={[toastAction(toaster, id, action.onAction)]}>
							{action.label}
						</Toast.Action>
					) : null}
					<Toast.Close aria-label={labels.dismiss} commandfor={domId} command="close" />
				</Toast>
			</dialog>
		);
	};
}

/**
 * Picks the icon a tone carries, so a success, warning and failure read apart
 * at a glance before the title is read.
 *
 * @param handle Runtime handle carrying the toast's tone.
 * @returns The render function producing the icon.
 */
function ToastColorIcon(handle: Handle<{ color: Toast.Color }>) {
	return () => {
		let { color } = handle.props;
		if (color === "success") return <CircleCheckIcon size={16} />;
		if (color === "danger") return <CircleAlertIcon size={16} />;
		if (color === "warning") return <TriangleAlertIcon size={16} />;
		return <InfoIcon size={16} />;
	};
}
