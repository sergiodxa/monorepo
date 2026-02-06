import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";
import type { Key } from "react-aria-components";

import { cn as classNames } from "@pkg/cn";
import { useState } from "react";
import {
	Button,
	Disclosure as AriaDisclosure,
	DisclosureGroup as AriaDisclosureGroup,
	DisclosurePanel as AriaDisclosurePanel,
} from "react-aria-components";

type AccordionType = "single" | "multiple";

type AccordionSingleProps = {
	type: "single";
	collapsible?: boolean;
	value?: string;
	defaultValue?: string;
	onValueChange?: (value?: string) => void;
};

type AccordionMultipleProps = {
	type: "multiple";
	value?: string[];
	defaultValue?: string[];
	onValueChange?: (value: string[]) => void;
};

type AccordionBaseProps = Omit<
	ComponentProps<typeof AriaDisclosureGroup>,
	| "className"
	| "allowsMultipleExpanded"
	| "expandedKeys"
	| "defaultExpandedKeys"
	| "onExpandedChange"
> & {
	className?: cn.ClassName;
};

export namespace Accordion {
	export type Props = AccordionBaseProps & (AccordionSingleProps | AccordionMultipleProps);

	export interface ItemProps extends Omit<
		ComponentProps<typeof AriaDisclosure>,
		"className" | "id"
	> {
		className?: cn.ClassName;
		value: string;
	}

	export interface TriggerProps extends Omit<ComponentProps<typeof Button>, "slot" | "className"> {
		className?: cn.ClassName;
	}

	export interface ContentProps extends Omit<
		ComponentProps<typeof AriaDisclosurePanel>,
		"className"
	> {
		className?: cn.ClassName;
	}
}

function toArray(keys: Set<Key>) {
	return Array.from(keys, (key) => String(key));
}

function toSingle(keys: Set<Key>) {
	let [value] = keys;
	return value ? String(value) : undefined;
}

export function Accordion(props: Accordion.Props) {
	let { className, type, ...rest } = props;

	if (type === "multiple") {
		let { value, defaultValue, onValueChange, ...groupProps } = rest as AccordionMultipleProps &
			AccordionBaseProps;

		return (
			<AriaDisclosureGroup
				{...groupProps}
				allowsMultipleExpanded
				expandedKeys={value ? new Set<Key>(value) : undefined}
				defaultExpandedKeys={defaultValue ? new Set<Key>(defaultValue) : undefined}
				onExpandedChange={
					onValueChange
						? (keys) => {
								onValueChange(toArray(keys));
							}
						: undefined
				}
				className={classNames("ui-accordion", className)}
			/>
		);
	}

	let { value, defaultValue, onValueChange, collapsible, ...groupProps } =
		rest as AccordionSingleProps & AccordionBaseProps;
	let isControlled = value !== undefined;
	let [uncontrolledKeys, setUncontrolledKeys] = useState<Set<Key>>(
		() => new Set<Key>(defaultValue ? [defaultValue] : []),
	);

	let expandedKeys = isControlled
		? new Set<Key>(value ? [value] : [])
		: collapsible === false
			? uncontrolledKeys
			: undefined;
	let defaultExpandedKeys =
		!isControlled && collapsible !== false && defaultValue
			? new Set<Key>([defaultValue])
			: undefined;

	return (
		<AriaDisclosureGroup
			{...groupProps}
			allowsMultipleExpanded={false}
			expandedKeys={expandedKeys}
			defaultExpandedKeys={defaultExpandedKeys}
			onExpandedChange={(keys) => {
				if (collapsible === false && keys.size === 0) return;
				if (!isControlled && collapsible === false) {
					setUncontrolledKeys(keys);
				}
				onValueChange?.(toSingle(keys));
			}}
			className={classNames("ui-accordion", className)}
		/>
	);
}

Accordion.Item = function AccordionItem({ className, value, ...props }: Accordion.ItemProps) {
	return (
		<AriaDisclosure {...props} id={value} className={classNames("ui-accordion-item", className)} />
	);
};

Accordion.Trigger = function AccordionTrigger({
	className,
	children,
	...props
}: Accordion.TriggerProps) {
	return (
		<Button {...props} slot="trigger" className={classNames("ui-accordion-trigger", className)}>
			{children}
		</Button>
	);
};

Accordion.Content = function AccordionContent({ className, ...props }: Accordion.ContentProps) {
	return (
		<AriaDisclosurePanel {...props} className={classNames("ui-accordion-content", className)} />
	);
};
