import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { PlusIcon, MinusIcon } from "lucide-react";
import { NumberField as AriaNumberField, Group, Input, Button } from "react-aria-components";

export namespace NumberField {
	export interface Props extends Omit<ComponentProps<typeof AriaNumberField>, "className"> {
		className?: cn.ClassName;
	}

	export interface GroupProps extends Omit<ComponentProps<typeof Group>, "className"> {
		className?: cn.ClassName;
	}

	export interface InputProps extends Omit<ComponentProps<typeof Input>, "className"> {
		className?: cn.ClassName;
	}

	export interface IncrementButtonProps extends Omit<
		ComponentProps<typeof Button>,
		"slot" | "children" | "className"
	> {
		className?: cn.ClassName;
	}

	export interface DecrementButtonProps extends Omit<
		ComponentProps<typeof Button>,
		"slot" | "children" | "className"
	> {
		className?: cn.ClassName;
	}
}

export function NumberField({ className, ...props }: NumberField.Props) {
	return <AriaNumberField {...props} className={cn("ui-number-field", className)} />;
}

NumberField.Group = function NumberFieldGroup({ className, ...props }: NumberField.GroupProps) {
	return <Group {...props} className={cn("ui-number-field-group", className)} />;
};

NumberField.Input = function NumberFieldInput({ className, ...props }: NumberField.InputProps) {
	return <Input {...props} className={cn("ui-number-field-input", className)} />;
};

NumberField.IncrementButton = function NumberFieldIncrementButton({
	className,
	...props
}: NumberField.IncrementButtonProps) {
	return (
		<Button {...props} slot="increment" className={cn("ui-number-field-button", className)}>
			<PlusIcon className="size-4" aria-hidden />
		</Button>
	);
};

NumberField.DecrementButton = function NumberFieldDecrementButton({
	className,
	...props
}: NumberField.DecrementButtonProps) {
	return (
		<Button {...props} slot="decrement" className={cn("ui-number-field-button", className)}>
			<MinusIcon className="size-4" aria-hidden />
		</Button>
	);
};
