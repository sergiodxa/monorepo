import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import {
	Tabs as AriaTabs,
	TabList as AriaTabList,
	Tab as AriaTab,
	TabPanel as AriaTabPanel,
	TabPanels as AriaTabPanels,
} from "react-aria-components";

export namespace Tabs {
	export interface Props extends Omit<ComponentProps<typeof AriaTabs>, "className"> {
		className?: cn.ClassName;
	}

	export interface ListProps<T extends object> extends Omit<
		ComponentProps<typeof AriaTabList<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface TabProps extends Omit<ComponentProps<typeof AriaTab>, "className"> {
		className?: cn.ClassName;
	}

	export interface PanelsProps<T extends object> extends Omit<
		ComponentProps<typeof AriaTabPanels<T>>,
		"className"
	> {
		className?: cn.ClassName;
	}

	export interface PanelProps extends Omit<ComponentProps<typeof AriaTabPanel>, "className"> {
		className?: cn.ClassName;
	}
}

export function Tabs({ className, ...props }: Tabs.Props) {
	return <AriaTabs {...props} className={classNames("ui-tabs", className)} />;
}

Tabs.List = function TabsList<T extends object>({ className, ...props }: Tabs.ListProps<T>) {
	return <AriaTabList {...props} className={classNames("ui-tab-list", className)} />;
};

Tabs.Tab = function TabsTab({ className, ...props }: Tabs.TabProps) {
	return <AriaTab {...props} className={classNames("ui-tab", className)} />;
};

Tabs.Panels = function TabsPanels<T extends object>({ className, ...props }: Tabs.PanelsProps<T>) {
	return <AriaTabPanels {...props} className={classNames("ui-tab-panels", className)} />;
};

Tabs.Panel = function TabsPanel({ className, ...props }: Tabs.PanelProps) {
	return <AriaTabPanel {...props} className={classNames("ui-tab-panel", className)} />;
};
