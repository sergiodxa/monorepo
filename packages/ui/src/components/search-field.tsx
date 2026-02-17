import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { SearchIcon, XIcon } from "lucide-react";
import { SearchField as AriaSearchField, Button, Input } from "react-aria-components";

export namespace SearchField {
	export interface Props extends Omit<ComponentProps<typeof AriaSearchField>, "className"> {
		className?: cn.ClassName;
	}

	export interface InputProps extends Omit<ComponentProps<typeof Input>, "className"> {
		className?: cn.ClassName;
	}

	export interface ClearButtonProps extends Omit<
		ComponentProps<typeof Button>,
		"children" | "className"
	> {
		className?: cn.ClassName;
	}
}

export function SearchField({ className, ...props }: SearchField.Props) {
	return <AriaSearchField {...props} className={cn("ui-search-field", className)} />;
}

SearchField.Input = function SearchFieldInput({ className, ...props }: SearchField.InputProps) {
	return (
		<div className="ui-search-field-input-wrapper">
			<SearchIcon className="ui-search-field-icon" aria-hidden />
			<Input {...props} className={cn("ui-search-field-input", className)} />
			<SearchField.ClearButton />
		</div>
	);
};

SearchField.ClearButton = function SearchFieldClearButton({
	className,
	...props
}: SearchField.ClearButtonProps) {
	return (
		<Button {...props} className={cn("ui-search-field-clear", className)}>
			<XIcon className="size-3.5" aria-hidden />
		</Button>
	);
};
