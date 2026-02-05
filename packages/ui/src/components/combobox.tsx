import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import { ChevronDownIcon } from "lucide-react";
import { ComboBox as AriaComboBox, Input, Button, Group } from "react-aria-components";

export namespace ComboBox {
	export interface Props<T extends object> extends Omit<
		ComponentProps<typeof AriaComboBox<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface GroupProps extends Omit<ComponentProps<typeof Group>, "className"> {
		className?: cn.ClassName;
	}

	export interface InputProps extends Omit<ComponentProps<typeof Input>, "className"> {
		className?: cn.ClassName;
	}

	export interface ButtonProps extends Omit<
		ComponentProps<typeof Button>,
		"children" | "className"
	> {
		className?: cn.ClassName;
	}
}

export function ComboBox<T extends object>({ className, ...props }: ComboBox.Props<T>) {
	return <AriaComboBox {...props} className={classNames("ui-combobox", className)} />;
}

ComboBox.Group = function ComboBoxGroup({ className, ...props }: ComboBox.GroupProps) {
	return <Group {...props} className={classNames("ui-combobox-group", className)} />;
};

ComboBox.Input = function ComboBoxInput({ className, ...props }: ComboBox.InputProps) {
	return <Input {...props} className={classNames("ui-combobox-input", className)} />;
};

ComboBox.Button = function ComboBoxButton({ className, ...props }: ComboBox.ButtonProps) {
	return (
		<Button {...props} className={classNames("ui-combobox-button", className)}>
			<ChevronDownIcon className="size-4" aria-hidden />
		</Button>
	);
};
