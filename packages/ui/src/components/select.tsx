import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { ChevronDownIcon } from "lucide-react";
import {
	Select as AriaSelect,
	ListBoxSection as AriaListBoxSection,
	Button,
	SelectValue,
} from "react-aria-components";

import { ListBox as ListBoxComponent } from "./listbox";

export namespace Select {
	export interface Props<T extends object> extends Omit<
		ComponentProps<typeof AriaSelect<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface TriggerProps extends Omit<ComponentProps<typeof Button>, "className"> {
		className?: cn.ClassName;
	}

	export interface ItemProps extends ComponentProps<typeof ListBoxComponent.Item> {}

	export interface SectionProps<T extends object> extends ComponentProps<
		typeof AriaListBoxSection<T>
	> {}
}

export function Select<T extends object>({ className, ...props }: Select.Props<T>) {
	return <AriaSelect {...props} className={cn("ui-field-group", className)} />;
}

Select.Trigger = function SelectTrigger({ className, children, ...props }: Select.TriggerProps) {
	return (
		<Button {...props} className={cn("ui-select-trigger", className)}>
			{children ?? (
				<>
					<SelectValue className="ui-select-value" />
					<ChevronDownIcon className="size-4 text-neutral-500" aria-hidden />
				</>
			)}
		</Button>
	);
};

Select.Value = SelectValue;

Select.Item = ListBoxComponent.Item;

Select.Section = function SelectSection<T extends object>(props: Select.SectionProps<T>) {
	return <AriaListBoxSection {...props} />;
};
