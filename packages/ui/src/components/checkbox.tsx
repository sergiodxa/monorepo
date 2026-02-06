import type { cn } from "@pkg/cn";
import type { ComponentProps, ReactNode } from "react";

import { cn as classNames } from "@pkg/cn";
import { CheckIcon, MinusIcon } from "lucide-react";
import { Checkbox as AriaCheckbox } from "react-aria-components";

export namespace Checkbox {
	export type Color = "primary" | "neutral" | "danger" | "warning" | "success";

	export interface Props extends Omit<ComponentProps<typeof AriaCheckbox>, "className"> {
		color?: Color;
		children?: ReactNode;
		className?: cn.ClassName;
	}
}

export function Checkbox({ className, color = "primary", children, ...props }: Checkbox.Props) {
	return (
		<AriaCheckbox {...props} data-color={color} className={classNames("ui-checkbox", className)}>
			{(renderProps) => (
				<>
					<div
						className="ui-checkbox-box"
						data-selected={renderProps.isSelected || undefined}
						data-indeterminate={renderProps.isIndeterminate || undefined}
						data-focus-visible={renderProps.isFocusVisible || undefined}
						data-disabled={renderProps.isDisabled || undefined}
					>
						{renderProps.isSelected && <CheckIcon className="size-3" />}
						{renderProps.isIndeterminate && <MinusIcon className="size-3" />}
					</div>
					{children}
				</>
			)}
		</AriaCheckbox>
	);
}
