import type { ComponentProps } from "react";

import { LoaderIcon } from "lucide-react";
import { useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import type { SelectMonitor } from "~/db/schema";

import { Button } from "~/components/ui/button";

export function ActionButton(props: {
	id: SelectMonitor["id"];
	intent: string;
	children: React.JSX.Element;
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
			<Button type="submit" className="p-2" isPending={isPending} color={props.color}>
				{isPending ? <LoaderIcon className="size-5 animate-spin" /> : props.children}
				<span className="sr-only">{props.label}</span>
			</Button>
		</fetcher.Form>
	);
}
