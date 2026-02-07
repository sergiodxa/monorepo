import { useEffect, useState, useSyncExternalStore } from "react";

import type { Color } from "./color-context";

import { AlertDialog } from "./alert-dialog";
import { Button } from "./button";

export namespace confirm {
	export interface Options {
		/** Description text shown below the title */
		description?: string;
		/** Text for the confirm button. Defaults to "Confirm" */
		confirmLabel?: string;
		/** Text for the cancel button. Defaults to "Cancel" */
		cancelLabel?: string;
		/** Color for the confirm button. Defaults to "danger" */
		color?: Color;
	}
}

interface ConfirmState {
	isOpen: boolean;
	title: string;
	options: confirm.Options;
	resolve: ((value: boolean) => void) | null;
}

let state: ConfirmState = {
	isOpen: false,
	title: "",
	options: {},
	resolve: null,
};

let listeners = new Set<() => void>();

function notify() {
	for (let listener of listeners) {
		listener();
	}
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function getSnapshot() {
	return state;
}

/**
 * Shows a confirmation dialog and returns a Promise that resolves to true if confirmed, false if cancelled.
 *
 * @example
 * ```tsx
 * if (await confirm("Delete this item?")) {
 *   // User confirmed
 *   await deleteItem();
 * }
 *
 * // With options
 * if (await confirm("Delete this item?", {
 *   description: "This action cannot be undone.",
 *   confirmLabel: "Delete",
 *   cancelLabel: "Keep",
 *   color: "danger",
 * })) {
 *   await deleteItem();
 * }
 * ```
 */
export function confirm(title: string, options: confirm.Options = {}): Promise<boolean> {
	return new Promise((resolve) => {
		state = {
			isOpen: true,
			title,
			options,
			resolve,
		};
		notify();
	});
}

function handleClose(confirmed: boolean) {
	let { resolve } = state;
	state = {
		isOpen: false,
		title: "",
		options: {},
		resolve: null,
	};
	notify();
	resolve?.(confirmed);
}

/**
 * Renders the confirmation dialog. Place this component once at the root of your app,
 * similar to the Toaster component.
 *
 * @example
 * ```tsx
 * // app/root.tsx
 * import { ConfirmDialog, Toaster } from "@pkg/ui";
 *
 * export default function App() {
 *   return (
 *     <>
 *       <Outlet />
 *       <Toaster />
 *       <ConfirmDialog />
 *     </>
 *   );
 * }
 * ```
 */
export function ConfirmDialog() {
	let { isOpen, title, options } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
	let [mounted, setMounted] = useState(false);

	// Track if we've been open to handle the close animation
	useEffect(() => {
		if (isOpen) setMounted(true);
	}, [isOpen]);

	// Don't render anything until we've been opened at least once
	if (!mounted) return null;

	let { description, confirmLabel = "Confirm", cancelLabel = "Cancel", color = "danger" } = options;

	return (
		<AlertDialog.Content isOpen={isOpen} onOpenChange={(open) => !open && handleClose(false)}>
			<AlertDialog>
				<AlertDialog.Header>
					<AlertDialog.Title>{title}</AlertDialog.Title>
					{description && <AlertDialog.Description>{description}</AlertDialog.Description>}
				</AlertDialog.Header>

				<AlertDialog.Footer>
					<Button variant="outline" color="neutral" onPress={() => handleClose(false)}>
						{cancelLabel}
					</Button>
					<Button color={color} onPress={() => handleClose(true)}>
						{confirmLabel}
					</Button>
				</AlertDialog.Footer>
			</AlertDialog>
		</AlertDialog.Content>
	);
}
