import type { ComponentProps, ReactNode } from "react";

import { cn } from "@pkg/cn";
import { CheckIcon, MinusIcon } from "lucide-react";
import { Checkbox as AriaCheckbox } from "react-aria-components";

import { type Color, ColorProvider, useColor } from "./color-context";

export namespace Checkbox {
	export interface Props extends Omit<ComponentProps<typeof AriaCheckbox>, "className"> {
		color?: Color;
		children?: ReactNode;
		className?: cn.ClassName;
	}
}

export function Checkbox({ className, color: colorProp, children, ...props }: Checkbox.Props) {
	let color = useColor(colorProp);
	return (
		<ColorProvider color={color}>
			<AriaCheckbox {...props} data-color={color} className={cn("ui-checkbox", className)}>
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
		</ColorProvider>
	);
}
