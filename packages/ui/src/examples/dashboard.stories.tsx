import type { Meta, StoryObj } from "@storybook/react";

import {
	Activity,
	BarChart3,
	Bell,
	ChevronDown,
	CreditCard,
	DollarSign,
	Home,
	PanelLeft,
	Settings,
	TrendingUp,
	Users,
} from "lucide-react";

import { Avatar } from "../components/avatar";
import { Badge } from "../components/badge";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { Empty } from "../components/empty";
import { Menu } from "../components/menu";
import { Popover } from "../components/popover";
import { Separator } from "../components/separator";
import { Sidebar } from "../components/sidebar";
import { Table } from "../components/table";
import { Tabs } from "../components/tabs";

const meta: Meta = {
	title: "Examples/Dashboard",
};

export default meta;
type Story = StoryObj;

// Sample data
interface Order {
	id: string;
	customer: string;
	email: string;
	status: "completed" | "pending" | "cancelled" | "processing";
	amount: string;
	date: string;
}

const orders: Order[] = [
	{
		id: "ORD-001",
		customer: "Alice Johnson",
		email: "alice@example.com",
		status: "completed",
		amount: "$250.00",
		date: "2024-01-15",
	},
	{
		id: "ORD-002",
		customer: "Bob Smith",
		email: "bob@example.com",
		status: "pending",
		amount: "$125.50",
		date: "2024-01-14",
	},
	{
		id: "ORD-003",
		customer: "Carol White",
		email: "carol@example.com",
		status: "processing",
		amount: "$540.00",
		date: "2024-01-14",
	},
	{
		id: "ORD-004",
		customer: "David Brown",
		email: "david@example.com",
		status: "completed",
		amount: "$89.99",
		date: "2024-01-13",
	},
	{
		id: "ORD-005",
		customer: "Eve Davis",
		email: "eve@example.com",
		status: "cancelled",
		amount: "$320.00",
		date: "2024-01-12",
	},
];

function getStatusColor(status: Order["status"]): Badge.Color {
	switch (status) {
		case "completed":
			return "success";
		case "pending":
			return "warning";
		case "cancelled":
			return "danger";
		case "processing":
			return "primary";
	}
}

// Metric Card Component
function MetricCard({
	title,
	value,
	change,
	changeType,
	icon,
}: {
	title: string;
	value: string;
	change: string;
	changeType: "positive" | "negative" | "neutral";
	icon: React.ReactNode;
}) {
	return (
		<Card>
			<Card.Header className="flex-row items-center justify-between pb-2">
				<Card.Title className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
					{title}
				</Card.Title>
				<span className="text-neutral-400 dark:text-neutral-500">{icon}</span>
			</Card.Header>
			<Card.Content className="pt-0">
				<div className="text-2xl font-bold">{value}</div>
				<p
					className={`text-xs ${
						changeType === "positive"
							? "text-success-600 dark:text-success-400"
							: changeType === "negative"
								? "text-danger-600 dark:text-danger-400"
								: "text-neutral-500 dark:text-neutral-400"
					}`}
				>
					{change}
				</p>
			</Card.Content>
		</Card>
	);
}

// Dashboard Sidebar Component
function DashboardSidebar({ currentItem }: { currentItem: string }) {
	return (
		<Sidebar>
			<Sidebar.Header>
				<div className="flex items-center gap-2 px-2">
					<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 dark:bg-primary-500 font-bold text-white">
						A
					</div>
					<span className="font-semibold">Acme Inc</span>
				</div>
			</Sidebar.Header>

			<Sidebar.Content>
				<Sidebar.Group>
					<Sidebar.GroupLabel>Overview</Sidebar.GroupLabel>
					<Sidebar.GroupContent>
						<Sidebar.Menu>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink href="#" active={currentItem === "dashboard"}>
									<Home size={16} />
									<span>Dashboard</span>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink href="#" active={currentItem === "orders"}>
									<CreditCard size={16} />
									<span>Orders</span>
									<Sidebar.MenuBadge>12</Sidebar.MenuBadge>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink href="#" active={currentItem === "customers"}>
									<Users size={16} />
									<span>Customers</span>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
						</Sidebar.Menu>
					</Sidebar.GroupContent>
				</Sidebar.Group>

				<Sidebar.Group>
					<Sidebar.GroupLabel>Analytics</Sidebar.GroupLabel>
					<Sidebar.GroupContent>
						<Sidebar.Menu>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink href="#" active={currentItem === "reports"}>
									<BarChart3 size={16} />
									<span>Reports</span>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink href="#" active={currentItem === "insights"}>
									<TrendingUp size={16} />
									<span>Insights</span>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink href="#" active={currentItem === "activity"}>
									<Activity size={16} />
									<span>Activity</span>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
						</Sidebar.Menu>
					</Sidebar.GroupContent>
				</Sidebar.Group>

				<Sidebar.Group>
					<Sidebar.GroupLabel>Settings</Sidebar.GroupLabel>
					<Sidebar.GroupContent>
						<Sidebar.Menu>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink href="#" active={currentItem === "settings"}>
									<Settings size={16} />
									<span>General</span>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink href="#" active={currentItem === "notifications"}>
									<Bell size={16} />
									<span>Notifications</span>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
						</Sidebar.Menu>
					</Sidebar.GroupContent>
				</Sidebar.Group>
			</Sidebar.Content>

			<Sidebar.Footer>
				<div className="flex items-center gap-2 px-2">
					<Avatar size="sm">
						<Avatar.Image
							src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face"
							alt="John Doe"
						/>
						<Avatar.Fallback>JD</Avatar.Fallback>
					</Avatar>
					<div className="flex flex-col text-sm">
						<span className="font-medium">John Doe</span>
						<span className="text-xs text-neutral-500 dark:text-neutral-400">john@acme.com</span>
					</div>
				</div>
			</Sidebar.Footer>
		</Sidebar>
	);
}

// Dashboard Header Component
function DashboardHeader() {
	return (
		<header className="flex h-14 items-center justify-between border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 sm:px-6">
			<div className="flex items-center gap-4">
				<Sidebar.Trigger>
					<PanelLeft size={20} />
				</Sidebar.Trigger>
				<h1 className="text-lg font-semibold">Dashboard</h1>
			</div>

			<div className="flex items-center gap-3">
				<Button variant="ghost" size="sm" className="relative">
					<Bell size={16} />
					<span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger-500 dark:bg-danger-600 text-[10px] text-white">
						3
					</span>
				</Button>

				<Separator orientation="vertical" className="h-6" />

				<Menu.Trigger>
					<Button variant="ghost" size="sm" className="gap-2">
						<Avatar size="sm">
							<Avatar.Image
								src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face"
								alt="John Doe"
							/>
							<Avatar.Fallback>JD</Avatar.Fallback>
						</Avatar>
						<span className="hidden sm:inline">John Doe</span>
						<ChevronDown size={16} />
					</Button>
					<Popover placement="bottom end">
						<Menu>
							<Menu.Item>Profile</Menu.Item>
							<Menu.Item>Account Settings</Menu.Item>
							<Menu.Item>Billing</Menu.Item>
							<Menu.Separator />
							<Menu.Item danger>Sign Out</Menu.Item>
						</Menu>
					</Popover>
				</Menu.Trigger>
			</div>
		</header>
	);
}

// Orders Table Component
function OrdersTable() {
	return (
		<Card>
			<Card.Header>
				<Card.Title>Recent Orders</Card.Title>
				<Card.Description>A list of recent orders from your store.</Card.Description>
			</Card.Header>
			<Card.Content className="overflow-x-auto">
				<Table aria-label="Recent orders">
					<Table.Header>
						<Table.Column isRowHeader>Order</Table.Column>
						<Table.Column>Customer</Table.Column>
						<Table.Column className="hidden sm:table-cell">Status</Table.Column>
						<Table.Column align="right">Amount</Table.Column>
						<Table.Column className="hidden md:table-cell">Date</Table.Column>
					</Table.Header>
					<Table.Body>
						{orders.map((order) => (
							<Table.Row key={order.id}>
								<Table.Cell className="font-medium">{order.id}</Table.Cell>
								<Table.Cell>
									<div className="flex flex-col">
										<span>{order.customer}</span>
										<span className="text-xs text-neutral-500 dark:text-neutral-400 sm:hidden">
											{order.status}
										</span>
										<span className="hidden text-xs text-neutral-500 dark:text-neutral-400 md:inline">
											{order.email}
										</span>
									</div>
								</Table.Cell>
								<Table.Cell className="hidden sm:table-cell">
									<Badge color={getStatusColor(order.status)} variant="secondary">
										{order.status}
									</Badge>
								</Table.Cell>
								<Table.Cell className="text-right">{order.amount}</Table.Cell>
								<Table.Cell className="hidden text-neutral-500 dark:text-neutral-400 md:table-cell">
									{order.date}
								</Table.Cell>
							</Table.Row>
						))}
					</Table.Body>
				</Table>
			</Card.Content>
			<Card.Footer>
				<Button variant="outline" size="sm">
					View All Orders
				</Button>
			</Card.Footer>
		</Card>
	);
}

// Analytics Tabs Component
function AnalyticsTabs() {
	return (
		<Card>
			<Card.Header>
				<Card.Title>Analytics</Card.Title>
				<Card.Description>Track your store performance over time.</Card.Description>
			</Card.Header>
			<Card.Content>
				<Tabs>
					<Tabs.List>
						<Tabs.Tab id="overview">Overview</Tabs.Tab>
						<Tabs.Tab id="revenue">Revenue</Tabs.Tab>
						<Tabs.Tab id="customers">Customers</Tabs.Tab>
					</Tabs.List>
					<Tabs.Panels className="mt-4">
						<Tabs.Panel id="overview">
							<Empty>
								<Empty.Icon>
									<BarChart3 />
								</Empty.Icon>
								<Empty.Title>No overview data</Empty.Title>
								<Empty.Description>
									Overview analytics will appear here once data is available.
								</Empty.Description>
							</Empty>
						</Tabs.Panel>
						<Tabs.Panel id="revenue">
							<Empty>
								<Empty.Icon>
									<DollarSign />
								</Empty.Icon>
								<Empty.Title>No revenue data</Empty.Title>
								<Empty.Description>
									Revenue analytics will appear here once data is available.
								</Empty.Description>
							</Empty>
						</Tabs.Panel>
						<Tabs.Panel id="customers">
							<Empty>
								<Empty.Icon>
									<Users />
								</Empty.Icon>
								<Empty.Title>No customer data</Empty.Title>
								<Empty.Description>
									Customer analytics will appear here once data is available.
								</Empty.Description>
							</Empty>
						</Tabs.Panel>
					</Tabs.Panels>
				</Tabs>
			</Card.Content>
		</Card>
	);
}

// Main Dashboard Component
function Dashboard() {
	return (
		<Sidebar.Provider defaultOpen>
			<div className="flex min-h-screen w-full bg-neutral-50 dark:bg-neutral-950">
				<DashboardSidebar currentItem="dashboard" />

				<div className="flex flex-1 flex-col overflow-hidden">
					<DashboardHeader />

					<main className="flex-1 overflow-auto p-3 sm:p-6">
						{/* Metrics Grid */}
						<div className="mb-4 grid gap-3 sm:mb-6 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<MetricCard
								title="Total Revenue"
								value="$45,231.89"
								change="+20.1% from last month"
								changeType="positive"
								icon={<DollarSign size={16} />}
							/>
							<MetricCard
								title="Subscriptions"
								value="+2,350"
								change="+180.1% from last month"
								changeType="positive"
								icon={<Users size={16} />}
							/>
							<MetricCard
								title="Sales"
								value="+12,234"
								change="+19% from last month"
								changeType="positive"
								icon={<CreditCard size={16} />}
							/>
							<MetricCard
								title="Active Now"
								value="+573"
								change="+201 since last hour"
								changeType="neutral"
								icon={<Activity size={16} />}
							/>
						</div>

						{/* Main Content Grid */}
						<div className="grid gap-4 sm:gap-6 lg:grid-cols-7">
							<div className="min-w-0 lg:col-span-4">
								<AnalyticsTabs />
							</div>
							<div className="min-w-0 lg:col-span-3">
								<Card className="h-full">
									<Card.Header>
										<Card.Title>Recent Activity</Card.Title>
										<Card.Description>Your latest transactions and updates.</Card.Description>
									</Card.Header>
									<Card.Content className="px-3 sm:px-6">
										<div className="space-y-3 sm:space-y-4">
											{[
												{
													name: "Alice Johnson",
													action: "made a purchase",
													amount: "$250.00",
													time: "2 minutes ago",
												},
												{
													name: "Bob Smith",
													action: "subscribed to Pro",
													amount: "$29.00/mo",
													time: "1 hour ago",
												},
												{
													name: "Carol White",
													action: "upgraded plan",
													amount: "$99.00/mo",
													time: "3 hours ago",
												},
												{
													name: "David Brown",
													action: "made a purchase",
													amount: "$89.99",
													time: "5 hours ago",
												},
											].map((activity, index) => (
												<div key={index} className="flex items-center gap-2 sm:gap-3">
													<Avatar size="sm">
														<Avatar.Fallback>
															{activity.name
																.split(" ")
																.map((n) => n[0])
																.join("")}
														</Avatar.Fallback>
													</Avatar>
													<div className="min-w-0 flex-1 overflow-hidden">
														<p className="truncate text-xs font-medium sm:text-sm">
															{activity.name}
														</p>
														<p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
															{activity.action}
														</p>
													</div>
													<div className="shrink-0 text-right text-xs sm:text-sm">
														<p className="font-medium">{activity.amount}</p>
														<p className="text-neutral-500 dark:text-neutral-400">
															{activity.time}
														</p>
													</div>
												</div>
											))}
										</div>
									</Card.Content>
								</Card>
							</div>
						</div>

						{/* Orders Table */}
						<div className="mt-6">
							<OrdersTable />
						</div>
					</main>
				</div>
			</div>
		</Sidebar.Provider>
	);
}

export const Default: Story = {
	render: () => <Dashboard />,
	parameters: {
		layout: "fullscreen",
	},
};

// Collapsed sidebar variant
export const CollapsedSidebar: Story = {
	render: () => (
		<Sidebar.Provider defaultOpen={false}>
			<div className="flex min-h-screen w-full bg-neutral-50 dark:bg-neutral-950">
				<DashboardSidebar currentItem="dashboard" />

				<div className="flex flex-1 flex-col overflow-hidden">
					<DashboardHeader />

					<main className="flex-1 overflow-auto p-3 sm:p-6">
						<div className="mb-4 grid gap-3 sm:mb-6 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<MetricCard
								title="Total Revenue"
								value="$45,231.89"
								change="+20.1% from last month"
								changeType="positive"
								icon={<DollarSign size={16} />}
							/>
							<MetricCard
								title="Subscriptions"
								value="+2,350"
								change="+180.1% from last month"
								changeType="positive"
								icon={<Users size={16} />}
							/>
							<MetricCard
								title="Sales"
								value="+12,234"
								change="+19% from last month"
								changeType="positive"
								icon={<CreditCard size={16} />}
							/>
							<MetricCard
								title="Active Now"
								value="+573"
								change="+201 since last hour"
								changeType="neutral"
								icon={<Activity size={16} />}
							/>
						</div>

						<div className="grid gap-4 sm:gap-6 lg:grid-cols-7">
							<div className="min-w-0 lg:col-span-4">
								<AnalyticsTabs />
							</div>
							<div className="min-w-0 lg:col-span-3">
								<Card className="h-full">
									<Card.Header>
										<Card.Title>Recent Activity</Card.Title>
									</Card.Header>
									<Card.Content>
										<p className="text-neutral-500 dark:text-neutral-400">
											Activity feed content...
										</p>
									</Card.Content>
								</Card>
							</div>
						</div>
					</main>
				</div>
			</div>
		</Sidebar.Provider>
	),
	parameters: {
		layout: "fullscreen",
	},
};
