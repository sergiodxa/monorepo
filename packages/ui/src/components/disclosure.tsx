import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import {
	Disclosure as AriaDisclosure,
	DisclosureGroup as AriaDisclosureGroup,
	DisclosurePanel as AriaDisclosurePanel,
	Button,
} from "react-aria-components";

export namespace Disclosure {
	export interface Props extends Omit<ComponentProps<typeof AriaDisclosure>, "className"> {
		className?: cn.ClassName;
	}

	export interface GroupProps extends Omit<
		ComponentProps<typeof AriaDisclosureGroup>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface TriggerProps extends Omit<ComponentProps<typeof Button>, "slot" | "className"> {
		className?: cn.ClassName;
	}

	export interface PanelProps extends Omit<
		ComponentProps<typeof AriaDisclosurePanel>,
		"className"
	> {
		className?: cn.ClassName;
	}
}

export function Disclosure({ className, ...props }: Disclosure.Props) {
	return <AriaDisclosure {...props} className={classNames("ui-disclosure", className)} />;
}

Disclosure.Group = function DisclosureGroup({ className, ...props }: Disclosure.GroupProps) {
	return (
		<AriaDisclosureGroup {...props} className={classNames("ui-disclosure-group", className)} />
	);
};

Disclosure.Trigger = function DisclosureTrigger({
	className,
	children,
	...props
}: Disclosure.TriggerProps) {
	return (
		<Button {...props} slot="trigger" className={classNames("ui-disclosure-trigger", className)}>
			{children}
		</Button>
	);
};

Disclosure.Panel = function DisclosurePanel({ className, ...props }: Disclosure.PanelProps) {
	return (
		<AriaDisclosurePanel {...props} className={classNames("ui-disclosure-panel", className)} />
	);
};
