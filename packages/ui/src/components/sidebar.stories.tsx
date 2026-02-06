import type { Meta, StoryObj } from "@storybook/react";

import { useState } from "react";

import { Sidebar, useSidebar } from "./sidebar";

interface StoryArgs {
	currentItem: "dashboard" | "projects" | "team" | "calendar" | "settings" | "help";
	variant: "sidebar" | "floating" | "inset";
	collapsible: "none" | "offcanvas" | "icon";
	side: "left" | "right";
	defaultOpen: boolean;
}

const meta: Meta<StoryArgs> = {
	title: "Navigation/Sidebar",
	component: Sidebar as unknown as Meta<StoryArgs>["component"],
	args: {
		currentItem: "dashboard",
		variant: "sidebar",
		collapsible: "offcanvas",
		side: "left",
		defaultOpen: true,
	},
	argTypes: {
		currentItem: {
			control: "select",
			options: ["dashboard", "projects", "team", "calendar", "settings", "help"],
		},
		variant: {
			control: "select",
			options: ["sidebar", "floating", "inset"],
		},
		collapsible: {
			control: "select",
			options: ["none", "offcanvas", "icon"],
		},
		side: {
			control: "select",
			options: ["left", "right"],
		},
		defaultOpen: {
			control: "boolean",
		},
	},
	decorators: [
		(Story, context) => (
			<Sidebar.Provider defaultOpen={context.args.defaultOpen}>
				<Story />
			</Sidebar.Provider>
		),
	],
};

export default meta;
type Story = StoryObj<StoryArgs>;

// Icon components for the stories
function HomeIcon() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
			<path
				fillRule="evenodd"
				d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z"
				clipRule="evenodd"
			/>
		</svg>
	);
}

function FolderIcon() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
			<path d="M3.75 3A1.75 1.75 0 0 0 2 4.75v3.26a3.235 3.235 0 0 1 1.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0 0 16.25 5h-4.836a.25.25 0 0 1-.177-.073L9.823 3.513A1.75 1.75 0 0 0 8.586 3H3.75ZM3.75 9A1.75 1.75 0 0 0 2 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0 0 18 15.25v-4.5A1.75 1.75 0 0 0 16.25 9H3.75Z" />
		</svg>
	);
}

function UsersIcon() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
			<path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z" />
		</svg>
	);
}

function CalendarIcon() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
			<path
				fillRule="evenodd"
				d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z"
				clipRule="evenodd"
			/>
		</svg>
	);
}

function CogIcon() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
			<path
				fillRule="evenodd"
				d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
				clipRule="evenodd"
			/>
		</svg>
	);
}

function HelpIcon() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
			<path
				fillRule="evenodd"
				d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM8.94 6.94a.75.75 0 1 1-1.061-1.061 3 3 0 1 1 2.871 5.026v.345a.75.75 0 0 1-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 1 0 8.94 6.94ZM10 15a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
				clipRule="evenodd"
			/>
		</svg>
	);
}

function PlusIcon() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
			<path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
		</svg>
	);
}

function ChevronLeftIcon() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
			<path
				fillRule="evenodd"
				d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
				clipRule="evenodd"
			/>
		</svg>
	);
}

function ChevronRightIcon() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
			<path
				fillRule="evenodd"
				d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
				clipRule="evenodd"
			/>
		</svg>
	);
}

function DotsIcon() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
			<path d="M3 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM8.5 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM15.5 8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
		</svg>
	);
}

function SidebarContent({
	currentItem,
	variant,
	collapsible,
	side,
}: Omit<StoryArgs, "defaultOpen">) {
	let { state } = useSidebar();

	return (
		<Sidebar variant={variant} collapsible={collapsible} side={side}>
			<Sidebar.Header>
				<div className="flex w-full items-center gap-3">
					<div className="flex size-8 items-center justify-center rounded-lg bg-primary-600 text-white">
						<span className="text-sm font-bold">A</span>
					</div>
					<div
						className="flex flex-col"
						data-sidebar-collapsed-hide={collapsible === "icon" ? "" : undefined}
					>
						<span className="text-sm font-semibold">Acme Inc</span>
						<span className="text-xs text-neutral-500">Enterprise</span>
					</div>
					<Sidebar.Trigger className="ml-auto" aria-label="Toggle sidebar">
						{state === "expanded" ? <ChevronLeftIcon /> : <ChevronRightIcon />}
					</Sidebar.Trigger>
				</div>
			</Sidebar.Header>

			<Sidebar.Content>
				<Sidebar.Group>
					<Sidebar.GroupLabel>
						Platform
						<Sidebar.GroupAction aria-label="Add item">
							<PlusIcon />
						</Sidebar.GroupAction>
					</Sidebar.GroupLabel>
					<Sidebar.GroupContent>
						<Sidebar.Menu>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink href="#" active={currentItem === "dashboard"} tooltip="Dashboard">
									<HomeIcon />
									<span>Dashboard</span>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink href="#" active={currentItem === "projects"} tooltip="Projects">
									<FolderIcon />
									<span>Projects</span>
								</Sidebar.MenuLink>
								<Sidebar.MenuBadge>12</Sidebar.MenuBadge>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink href="#" active={currentItem === "team"} tooltip="Team">
									<UsersIcon />
									<span>Team</span>
								</Sidebar.MenuLink>
								<Sidebar.MenuAction aria-label="Team options">
									<DotsIcon />
								</Sidebar.MenuAction>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink href="#" active={currentItem === "calendar"} tooltip="Calendar">
									<CalendarIcon />
									<span>Calendar</span>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
						</Sidebar.Menu>
					</Sidebar.GroupContent>
				</Sidebar.Group>

				<Sidebar.Group>
					<Sidebar.GroupLabel>Projects</Sidebar.GroupLabel>
					<Sidebar.GroupContent>
						<Sidebar.Menu>
							<Sidebar.MenuItem>
								<Sidebar.MenuButton tooltip="Website Redesign">
									<div className="size-2 rounded-full bg-primary-500" />
									<span>Website Redesign</span>
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuButton tooltip="Mobile App">
									<div className="size-2 rounded-full bg-success-500" />
									<span>Mobile App</span>
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuButton tooltip="API Integration">
									<div className="size-2 rounded-full bg-warning-500" />
									<span>API Integration</span>
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						</Sidebar.Menu>
					</Sidebar.GroupContent>
				</Sidebar.Group>

				<Sidebar.Group>
					<Sidebar.GroupLabel>Support</Sidebar.GroupLabel>
					<Sidebar.GroupContent>
						<Sidebar.Menu>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink href="#" active={currentItem === "settings"} tooltip="Settings">
									<CogIcon />
									<span>Settings</span>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink href="#" active={currentItem === "help"} tooltip="Help">
									<HelpIcon />
									<span>Help & Support</span>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
						</Sidebar.Menu>
					</Sidebar.GroupContent>
				</Sidebar.Group>
			</Sidebar.Content>

			<Sidebar.Footer>
				<div className="flex w-full items-center gap-3">
					<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-medium dark:bg-neutral-800">
						A
					</div>
					<div
						className="flex min-w-0 flex-col"
						data-sidebar-collapsed-hide={collapsible === "icon" ? "" : undefined}
					>
						<span className="truncate text-sm font-medium">Alex Johnson</span>
						<span className="truncate text-xs text-neutral-500">alex@acme.com</span>
					</div>
				</div>
			</Sidebar.Footer>

			<Sidebar.Rail aria-label="Toggle sidebar" />
		</Sidebar>
	);
}

export const Default: Story = {
	render: ({ currentItem, variant, collapsible, side }) => (
		<div className="flex h-[600px] w-full overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
			<SidebarContent
				currentItem={currentItem}
				variant={variant}
				collapsible={collapsible}
				side={side}
			/>
			<main className="flex-1 overflow-auto p-6">
				<div className="mb-4 flex items-center gap-2">
					<h1 className="text-xl font-semibold">Welcome back</h1>
				</div>
				<p className="text-neutral-600 dark:text-neutral-400">
					Press{" "}
					<kbd className="rounded border bg-neutral-100 px-1.5 py-0.5 text-xs dark:border-neutral-700 dark:bg-neutral-800">
						Cmd+B
					</kbd>{" "}
					(or{" "}
					<kbd className="rounded border bg-neutral-100 px-1.5 py-0.5 text-xs dark:border-neutral-700 dark:bg-neutral-800">
						Ctrl+B
					</kbd>
					) to toggle sidebar.
				</p>
				<p className="mt-2 text-sm text-neutral-500">
					Hover over the rail on the edge of the sidebar to see the toggle indicator.
				</p>
			</main>
		</div>
	),
};

export const IconCollapsible: Story = {
	args: {
		collapsible: "icon",
	},
	render: ({ currentItem, variant, side }) => (
		<div className="flex h-[600px] w-full overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
			<SidebarContent currentItem={currentItem} variant={variant} collapsible="icon" side={side} />
			<main className="flex-1 overflow-auto p-6">
				<h1 className="mb-4 text-xl font-semibold">Icon Collapsible Mode</h1>
				<p className="text-neutral-600 dark:text-neutral-400">
					In icon mode, the sidebar collapses to show only icons. Hover over icons to see tooltips.
				</p>
				<p className="mt-2 text-sm text-neutral-500">
					Click the toggle button or press Cmd+B to collapse/expand.
				</p>
			</main>
		</div>
	),
};

export const FloatingVariant: Story = {
	args: {
		variant: "floating",
	},
	render: ({ currentItem, collapsible, side }) => (
		<div className="flex h-[600px] w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 p-4 dark:border-neutral-800 dark:bg-neutral-900">
			<SidebarContent
				currentItem={currentItem}
				variant="floating"
				collapsible={collapsible}
				side={side}
			/>
			<main className="flex-1 overflow-auto rounded-lg bg-white p-6 shadow-sm dark:bg-neutral-950">
				<h1 className="mb-4 text-xl font-semibold">Floating Variant</h1>
				<p className="text-neutral-600 dark:text-neutral-400">
					The floating variant adds elevation and rounded corners with a subtle backdrop blur
					effect.
				</p>
			</main>
		</div>
	),
};

export const InsetVariant: Story = {
	args: {
		variant: "inset",
	},
	render: ({ currentItem, collapsible, side }) => (
		<div className="flex h-[600px] w-full overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
			<SidebarContent
				currentItem={currentItem}
				variant="inset"
				collapsible={collapsible}
				side={side}
			/>
			<Sidebar.Inset>
				<main className="flex-1 overflow-auto p-6">
					<h1 className="mb-4 text-xl font-semibold">Inset Variant</h1>
					<p className="text-neutral-600 dark:text-neutral-400">
						The inset variant uses a subtle background and border, ideal for dashboard layouts.
					</p>
				</main>
			</Sidebar.Inset>
		</div>
	),
};

export const WithSubMenu: Story = {
	render: () => (
		<Sidebar.Provider>
			<div className="flex h-[600px] w-full overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
				<Sidebar>
					<Sidebar.Header>
						<span className="text-sm font-semibold">Navigation</span>
					</Sidebar.Header>
					<Sidebar.Content>
						<Sidebar.Group>
							<Sidebar.GroupLabel>Main</Sidebar.GroupLabel>
							<Sidebar.GroupContent>
								<Sidebar.Menu>
									<Sidebar.MenuItem>
										<Sidebar.MenuLink href="#" active>
											<HomeIcon />
											<span>Dashboard</span>
										</Sidebar.MenuLink>
									</Sidebar.MenuItem>
									<Sidebar.MenuItem>
										<Sidebar.MenuLink href="#">
											<FolderIcon />
											<span>Projects</span>
										</Sidebar.MenuLink>
									</Sidebar.MenuItem>
								</Sidebar.Menu>
								<Sidebar.MenuSub>
									<Sidebar.MenuSubItem>
										<Sidebar.MenuSubButton active>Active Tasks</Sidebar.MenuSubButton>
									</Sidebar.MenuSubItem>
									<Sidebar.MenuSubItem>
										<Sidebar.MenuSubButton>Completed</Sidebar.MenuSubButton>
									</Sidebar.MenuSubItem>
									<Sidebar.MenuSubItem>
										<Sidebar.MenuSubButton>Archived</Sidebar.MenuSubButton>
									</Sidebar.MenuSubItem>
								</Sidebar.MenuSub>
							</Sidebar.GroupContent>
						</Sidebar.Group>

						<Sidebar.Group>
							<Sidebar.GroupLabel>Settings</Sidebar.GroupLabel>
							<Sidebar.GroupContent>
								<Sidebar.Menu>
									<Sidebar.MenuItem>
										<Sidebar.MenuLink href="#">
											<CogIcon />
											<span>General</span>
										</Sidebar.MenuLink>
									</Sidebar.MenuItem>
									<Sidebar.MenuItem>
										<Sidebar.MenuLink href="#">
											<UsersIcon />
											<span>Team</span>
										</Sidebar.MenuLink>
									</Sidebar.MenuItem>
								</Sidebar.Menu>
								<Sidebar.MenuSub>
									<Sidebar.MenuSubItem>
										<Sidebar.MenuSubButton>Members</Sidebar.MenuSubButton>
									</Sidebar.MenuSubItem>
									<Sidebar.MenuSubItem>
										<Sidebar.MenuSubButton>Permissions</Sidebar.MenuSubButton>
									</Sidebar.MenuSubItem>
								</Sidebar.MenuSub>
							</Sidebar.GroupContent>
						</Sidebar.Group>
					</Sidebar.Content>
				</Sidebar>
				<main className="flex-1 p-6">
					<h1 className="mb-4 text-xl font-semibold">Sub Menu Example</h1>
					<p className="text-neutral-600 dark:text-neutral-400">
						Sub-menus are indented with a visual border connecting them to the parent.
					</p>
				</main>
			</div>
		</Sidebar.Provider>
	),
};

export const WithSkeleton: Story = {
	render: () => (
		<Sidebar.Provider>
			<div className="flex h-[600px] w-full overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
				<Sidebar>
					<Sidebar.Header>
						<div className="h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
					</Sidebar.Header>
					<Sidebar.Content>
						<Sidebar.Group>
							<Sidebar.GroupLabel>Loading...</Sidebar.GroupLabel>
							<Sidebar.GroupContent>
								<Sidebar.Menu>
									<Sidebar.MenuItem>
										<Sidebar.MenuSkeleton showIcon />
									</Sidebar.MenuItem>
									<Sidebar.MenuItem>
										<Sidebar.MenuSkeleton showIcon />
									</Sidebar.MenuItem>
									<Sidebar.MenuItem>
										<Sidebar.MenuSkeleton showIcon />
									</Sidebar.MenuItem>
									<Sidebar.MenuItem>
										<Sidebar.MenuSkeleton showIcon />
									</Sidebar.MenuItem>
								</Sidebar.Menu>
							</Sidebar.GroupContent>
						</Sidebar.Group>

						<Sidebar.Group>
							<Sidebar.GroupLabel>Recent</Sidebar.GroupLabel>
							<Sidebar.GroupContent>
								<Sidebar.Menu>
									<Sidebar.MenuItem>
										<Sidebar.MenuSkeleton />
									</Sidebar.MenuItem>
									<Sidebar.MenuItem>
										<Sidebar.MenuSkeleton />
									</Sidebar.MenuItem>
									<Sidebar.MenuItem>
										<Sidebar.MenuSkeleton />
									</Sidebar.MenuItem>
								</Sidebar.Menu>
							</Sidebar.GroupContent>
						</Sidebar.Group>
					</Sidebar.Content>
				</Sidebar>
				<main className="flex-1 p-6">
					<h1 className="mb-4 text-xl font-semibold">Loading State</h1>
					<p className="text-neutral-600 dark:text-neutral-400">
						Skeleton components provide visual feedback during loading states.
					</p>
				</main>
			</div>
		</Sidebar.Provider>
	),
};

function ControlledSidebarDemo() {
	let [open, setOpen] = useState(true);

	return (
		<Sidebar.Provider open={open} onOpenChange={setOpen}>
			<div className="flex h-[600px] w-full overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
				<Sidebar>
					<Sidebar.Header>
						<span className="text-sm font-semibold">Controlled</span>
						<Sidebar.Trigger className="ml-auto">
							{open ? <ChevronLeftIcon /> : <ChevronRightIcon />}
						</Sidebar.Trigger>
					</Sidebar.Header>
					<Sidebar.Content>
						<Sidebar.Group>
							<Sidebar.GroupLabel>Navigation</Sidebar.GroupLabel>
							<Sidebar.GroupContent>
								<Sidebar.Menu>
									<Sidebar.MenuItem>
										<Sidebar.MenuLink href="#" active>
											<HomeIcon />
											<span>Home</span>
										</Sidebar.MenuLink>
									</Sidebar.MenuItem>
									<Sidebar.MenuItem>
										<Sidebar.MenuLink href="#">
											<FolderIcon />
											<span>Projects</span>
										</Sidebar.MenuLink>
									</Sidebar.MenuItem>
									<Sidebar.MenuItem>
										<Sidebar.MenuLink href="#">
											<CogIcon />
											<span>Settings</span>
										</Sidebar.MenuLink>
									</Sidebar.MenuItem>
								</Sidebar.Menu>
							</Sidebar.GroupContent>
						</Sidebar.Group>
					</Sidebar.Content>
				</Sidebar>
				<main className="flex-1 p-6">
					<h1 className="mb-4 text-xl font-semibold">Controlled Sidebar</h1>
					<p className="mb-4 text-neutral-600 dark:text-neutral-400">
						Sidebar state: <strong className="font-semibold">{open ? "Open" : "Closed"}</strong>
					</p>
					<button
						type="button"
						onClick={() => setOpen(!open)}
						className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
					>
						Toggle from outside
					</button>
				</main>
			</div>
		</Sidebar.Provider>
	);
}

export const Controlled: Story = {
	render: () => <ControlledSidebarDemo />,
	decorators: [],
};

function SidebarStateDisplay() {
	let { state, open, isMobile, openMobile } = useSidebar();
	return (
		<div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
			<h3 className="mb-3 font-medium">Sidebar State</h3>
			<dl className="grid grid-cols-2 gap-2 text-sm">
				<dt className="text-neutral-500">State:</dt>
				<dd className="font-mono">{state}</dd>
				<dt className="text-neutral-500">Open:</dt>
				<dd className="font-mono">{String(open)}</dd>
				<dt className="text-neutral-500">Mobile:</dt>
				<dd className="font-mono">{String(isMobile)}</dd>
				<dt className="text-neutral-500">Mobile Open:</dt>
				<dd className="font-mono">{String(openMobile)}</dd>
			</dl>
		</div>
	);
}

export const WithStateDisplay: Story = {
	render: () => (
		<div className="flex h-[600px] w-full overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
			<Sidebar>
				<Sidebar.Header>
					<span className="text-sm font-semibold">State Demo</span>
					<Sidebar.Trigger className="ml-auto">
						<ChevronLeftIcon />
					</Sidebar.Trigger>
				</Sidebar.Header>
				<Sidebar.Content>
					<Sidebar.Group>
						<Sidebar.GroupLabel>Navigation</Sidebar.GroupLabel>
						<Sidebar.GroupContent>
							<Sidebar.Menu>
								<Sidebar.MenuItem>
									<Sidebar.MenuLink href="#" active>
										<HomeIcon />
										<span>Dashboard</span>
									</Sidebar.MenuLink>
								</Sidebar.MenuItem>
							</Sidebar.Menu>
						</Sidebar.GroupContent>
					</Sidebar.Group>
				</Sidebar.Content>
			</Sidebar>
			<main className="flex-1 p-6">
				<h1 className="mb-4 text-xl font-semibold">State Display</h1>
				<SidebarStateDisplay />
				<p className="mt-4 text-sm text-neutral-500">
					Resize the window to see mobile detection. Toggle sidebar to see state changes.
				</p>
			</main>
		</div>
	),
};

export const RightSide: Story = {
	args: {
		side: "right",
	},
	render: ({ currentItem, variant, collapsible }) => (
		<div className="flex h-[600px] w-full overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
			<main className="flex-1 overflow-auto p-6">
				<h1 className="mb-4 text-xl font-semibold">Right-Side Sidebar</h1>
				<p className="text-neutral-600 dark:text-neutral-400">
					The sidebar can be positioned on the right side of the layout.
				</p>
			</main>
			<SidebarContent
				currentItem={currentItem}
				variant={variant}
				collapsible={collapsible}
				side="right"
			/>
		</div>
	),
};

function MobileSidebarDemo() {
	let { openMobile, setOpenMobile, isMobile } = useSidebar();

	return (
		<div className="flex h-[600px] w-full flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
			<header className="flex shrink-0 items-center gap-3 border-b border-neutral-200 p-4 dark:border-neutral-800">
				<Sidebar.Trigger aria-label="Menu">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						className="size-5"
					>
						<path
							fillRule="evenodd"
							d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"
							clipRule="evenodd"
						/>
					</svg>
				</Sidebar.Trigger>
				<span className="font-semibold">Mobile Demo</span>
			</header>
			<div className="flex flex-1 overflow-hidden">
				<Sidebar side="left">
					<Sidebar.Header>
						<span className="text-sm font-semibold">Navigation</span>
					</Sidebar.Header>
					<Sidebar.Content>
						<Sidebar.Group>
							<Sidebar.GroupLabel>Menu</Sidebar.GroupLabel>
							<Sidebar.GroupContent>
								<Sidebar.Menu>
									<Sidebar.MenuItem>
										<Sidebar.MenuLink href="#" active>
											<HomeIcon />
											<span>Home</span>
										</Sidebar.MenuLink>
									</Sidebar.MenuItem>
									<Sidebar.MenuItem>
										<Sidebar.MenuLink href="#">
											<FolderIcon />
											<span>Projects</span>
										</Sidebar.MenuLink>
									</Sidebar.MenuItem>
									<Sidebar.MenuItem>
										<Sidebar.MenuLink href="#">
											<UsersIcon />
											<span>Team</span>
										</Sidebar.MenuLink>
									</Sidebar.MenuItem>
									<Sidebar.MenuItem>
										<Sidebar.MenuLink href="#">
											<CogIcon />
											<span>Settings</span>
										</Sidebar.MenuLink>
									</Sidebar.MenuItem>
								</Sidebar.Menu>
							</Sidebar.GroupContent>
						</Sidebar.Group>
					</Sidebar.Content>
				</Sidebar>
				<main className="flex-1 overflow-auto p-6">
					<h1 className="mb-4 text-xl font-semibold">Mobile Behavior</h1>
					<div className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
						<dl className="grid grid-cols-2 gap-2 text-sm">
							<dt className="text-neutral-500">Mobile detected:</dt>
							<dd className="font-mono font-semibold">{String(isMobile)}</dd>
							<dt className="text-neutral-500">Mobile sidebar:</dt>
							<dd className="font-mono font-semibold">{String(openMobile)}</dd>
						</dl>
					</div>
					<p className="mb-4 text-sm text-neutral-500">
						Resize the window to below 768px to see mobile behavior. On mobile, the sidebar renders
						inside a Sheet component with a backdrop overlay.
					</p>
					{isMobile && (
						<button
							type="button"
							onClick={() => setOpenMobile(true)}
							className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
						>
							Open Mobile Sidebar
						</button>
					)}
				</main>
			</div>
		</div>
	);
}

export const MobileBehavior: Story = {
	render: () => <MobileSidebarDemo />,
	parameters: {
		viewport: {
			defaultViewport: "mobile1",
		},
	},
};

export const MenuSizes: Story = {
	render: () => (
		<Sidebar.Provider>
			<div className="flex h-[600px] w-full overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
				<Sidebar>
					<Sidebar.Header>
						<span className="text-sm font-semibold">Menu Sizes</span>
					</Sidebar.Header>
					<Sidebar.Content>
						<Sidebar.Group>
							<Sidebar.GroupLabel>Small</Sidebar.GroupLabel>
							<Sidebar.GroupContent>
								<Sidebar.Menu>
									<Sidebar.MenuItem>
										<Sidebar.MenuButton size="sm" active>
											<HomeIcon />
											<span>Small Active</span>
										</Sidebar.MenuButton>
									</Sidebar.MenuItem>
									<Sidebar.MenuItem>
										<Sidebar.MenuButton size="sm">
											<FolderIcon />
											<span>Small Item</span>
										</Sidebar.MenuButton>
									</Sidebar.MenuItem>
								</Sidebar.Menu>
							</Sidebar.GroupContent>
						</Sidebar.Group>

						<Sidebar.Group>
							<Sidebar.GroupLabel>Medium (default)</Sidebar.GroupLabel>
							<Sidebar.GroupContent>
								<Sidebar.Menu>
									<Sidebar.MenuItem>
										<Sidebar.MenuButton size="md" active>
											<HomeIcon />
											<span>Medium Active</span>
										</Sidebar.MenuButton>
									</Sidebar.MenuItem>
									<Sidebar.MenuItem>
										<Sidebar.MenuButton size="md">
											<FolderIcon />
											<span>Medium Item</span>
										</Sidebar.MenuButton>
									</Sidebar.MenuItem>
								</Sidebar.Menu>
							</Sidebar.GroupContent>
						</Sidebar.Group>

						<Sidebar.Group>
							<Sidebar.GroupLabel>Large</Sidebar.GroupLabel>
							<Sidebar.GroupContent>
								<Sidebar.Menu>
									<Sidebar.MenuItem>
										<Sidebar.MenuButton size="lg" active>
											<HomeIcon />
											<span>Large Active</span>
										</Sidebar.MenuButton>
									</Sidebar.MenuItem>
									<Sidebar.MenuItem>
										<Sidebar.MenuButton size="lg">
											<FolderIcon />
											<span>Large Item</span>
										</Sidebar.MenuButton>
									</Sidebar.MenuItem>
								</Sidebar.Menu>
							</Sidebar.GroupContent>
						</Sidebar.Group>
					</Sidebar.Content>
				</Sidebar>
				<main className="flex-1 p-6">
					<h1 className="mb-4 text-xl font-semibold">Menu Button Sizes</h1>
					<p className="text-neutral-600 dark:text-neutral-400">
						Menu buttons support three sizes: small, medium (default), and large.
					</p>
				</main>
			</div>
		</Sidebar.Provider>
	),
};
