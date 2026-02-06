import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { SelectionIndicator as AriaSelectionIndicator } from "react-aria-components";

export namespace SelectionIndicator {
	export interface Props extends Omit<ComponentProps<typeof AriaSelectionIndicator>, "className"> {
		className?: cn.ClassName;
	}
}

/**
 * SelectionIndicator renders a checkmark or other indicator when an item is selected.
 *
 * @example
 * ```tsx
 * <Menu>
 *   <Menu.Item>
 *     <SelectionIndicator />
 *     <Text slot="label">Option 1</Text>
 *   </Menu.Item>
 * </Menu>
 * ```
 */
export function SelectionIndicator({ className, ...props }: SelectionIndicator.Props) {
	return <AriaSelectionIndicator {...props} className={cn("ui-selection-indicator", className)} />;
}
