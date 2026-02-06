import type { ComponentProps, ReactNode } from "react";
import type { Key } from "react-aria-components";

import { cn } from "@pkg/cn";
import { createContext, useContext, useState } from "react";
import {
	Button,
	Disclosure as AriaDisclosure,
	DisclosureGroup as AriaDisclosureGroup,
	DisclosurePanel as AriaDisclosurePanel,
} from "react-aria-components";

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

type AccordionItemState = {
	isExpanded: boolean;
	isDisabled: boolean;
};

const AccordionItemContext = createContext<AccordionItemState | null>(null);

function useAccordionItemContext() {
	return useContext(AccordionItemContext);
}

export namespace Accordion {
	export type Props = AccordionBaseProps & (AccordionSingleProps | AccordionMultipleProps);

	export interface ItemProps extends Omit<
		ComponentProps<typeof AriaDisclosure>,
		"className" | "id" | "children"
	> {
		className?: cn.ClassName;
		value: string;
		children?: ReactNode;
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
				data-type={type}
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
				className={cn("ui-accordion", className)}
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
			data-type={type}
			data-collapsible={collapsible === false ? "false" : "true"}
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
			className={cn("ui-accordion", className)}
		/>
	);
}

Accordion.Item = function AccordionItem({
	className,
	value,
	children,
	...props
}: Accordion.ItemProps) {
	return (
		<AriaDisclosure
			{...props}
			id={value}
			data-value={value}
			data-disabled={props.isDisabled || undefined}
			className={cn("ui-accordion-item", className)}
		>
			{({ isExpanded, isDisabled }) => (
				<AccordionItemContext.Provider value={{ isExpanded, isDisabled }}>
					{children}
				</AccordionItemContext.Provider>
			)}
		</AriaDisclosure>
	);
};

Accordion.Trigger = function AccordionTrigger({
	className,
	children,
	...props
}: Accordion.TriggerProps) {
	let itemState = useAccordionItemContext();
	let dataState = itemState ? (itemState.isExpanded ? "open" : "closed") : undefined;
	return (
		<Button
			{...props}
			slot="trigger"
			data-state={dataState}
			data-disabled={itemState?.isDisabled || undefined}
			className={cn("ui-accordion-trigger", className)}
		>
			{children}
		</Button>
	);
};

Accordion.Content = function AccordionContent({ className, ...props }: Accordion.ContentProps) {
	let itemState = useAccordionItemContext();
	let dataState = itemState ? (itemState.isExpanded ? "open" : "closed") : undefined;
	return (
		<AriaDisclosurePanel
			{...props}
			data-state={dataState}
			data-disabled={itemState?.isDisabled || undefined}
			className={cn("ui-accordion-content", className)}
		/>
	);
};
