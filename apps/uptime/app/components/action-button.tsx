/**
 * A reusable submit button React component that posts a monitor action through a React
 * Router fetcher. It renders a single-button form carrying hidden `monitorId` and `intent`
 * fields, shows a spin-delayed pending state while the request is in flight, and accepts an
 * optional action URL and submit handler. Monitor rows use it for per-row actions like
 * running or deleting a monitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ComponentProps } from "react";

import { Button } from "@pkg/ui";
import { useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import type { SelectMonitor } from "~/db/schema";

export function ActionButton(props: {
	id: SelectMonitor["id"];
	intent: string;
	children: React.ReactNode;
	label: string;
	color: ComponentProps<typeof Button>["color"];
	onSubmit?: React.FormEventHandler<HTMLFormElement>;
	action?: string;
}) {
	let fetcher = useFetcher();
	let isPending = useSpinDelay(fetcher.state !== "idle", {
		minDuration: 100,
		delay: 10,
	});

	return (
		<fetcher.Form
			action={props.action}
			method="POST"
			className="contents"
			onSubmit={props.onSubmit}
		>
			<input type="hidden" name="monitorId" value={props.id} />
			<input type="hidden" name="intent" value={props.intent} />
			<Button type="submit" className="shrink-0 px-2" isPending={isPending} color={props.color}>
				{props.children}
			</Button>
		</fetcher.Form>
	);
}
