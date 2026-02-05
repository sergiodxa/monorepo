import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import { DropIndicator as AriaDropIndicator } from "react-aria-components";

export namespace DropIndicator {
	export interface Props extends Omit<ComponentProps<typeof AriaDropIndicator>, "className"> {
		className?: cn.ClassName;
	}
}

/**
 * DropIndicator shows where items will be dropped during drag and drop.
 *
 * @example
 * ```tsx
 * <GridList dragAndDropHooks={hooks}>
 *   {(item) => (
 *     <>
 *       <DropIndicator target={{ type: "item", key: item.id, dropPosition: "before" }} />
 *       <GridList.Item>{item.name}</GridList.Item>
 *     </>
 *   )}
 * </GridList>
 * ```
 */
export function DropIndicator({ className, ...props }: DropIndicator.Props) {
	return <AriaDropIndicator {...props} className={classNames("ui-drop-indicator", className)} />;
}
