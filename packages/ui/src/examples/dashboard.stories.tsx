import type { Meta, StoryObj } from "@storybook/react";

import { Avatar } from "../components/avatar";
import { Badge } from "../components/badge";
import { Button } from "../components/button";
import { Card } from "../components/card";
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

// Icons as simple SVG components
function HomeIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
			<polyline points="9 22 9 12 15 12 15 22" />
		</svg>
	);
}

function BarChartIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<line x1="12" x2="12" y1="20" y2="10" />
			<line x1="18" x2="18" y1="20" y2="4" />
			<line x1="6" x2="6" y1="20" y2="16" />
		</svg>
	);
}

function TrendingUpIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
			<polyline points="16 7 22 7 22 13" />
		</svg>
	);
}

function UsersIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
			<circle cx="9" cy="7" r="4" />
			<path d="M22 21v-2a4 4 0 0 0-3-3.87" />
			<path d="M16 3.13a4 4 0 0 1 0 7.75" />
		</svg>
	);
}

function SettingsIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	);
}

function BellIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
			<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
		</svg>
	);
}

function DollarIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<line x1="12" x2="12" y1="2" y2="22" />
			<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
		</svg>
	);
}

function CreditCardIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect width="20" height="14" x="2" y="5" rx="2" />
			<line x1="2" x2="22" y1="10" y2="10" />
		</svg>
	);
}

function ActivityIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
		</svg>
	);
}

function ChevronDownIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="m6 9 6 6 6-6" />
		</svg>
	);
}

function MenuIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<line x1="4" x2="20" y1="12" y2="12" />
			<line x1="4" x2="20" y1="6" y2="6" />
			<line x1="4" x2="20" y1="18" y2="18" />
		</svg>
	);
}

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
				<Card.Title className="text-sm font-medium text-neutral-500">{title}</Card.Title>
				<span className="text-neutral-400">{icon}</span>
			</Card.Header>
			<Card.Content className="pt-0">
				<div className="text-2xl font-bold">{value}</div>
				<p
					className={`text-xs ${
						changeType === "positive"
							? "text-success-600"
							: changeType === "negative"
								? "text-danger-600"
								: "text-neutral-500"
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
					<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 font-bold text-white">
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
									<HomeIcon />
									<span>Dashboard</span>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink href="#" active={currentItem === "orders"}>
									<CreditCardIcon />
									<span>Orders</span>
								</Sidebar.MenuLink>
								<Sidebar.MenuBadge>12</Sidebar.MenuBadge>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink href="#" active={currentItem === "customers"}>
									<UsersIcon />
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
									<BarChartIcon />
									<span>Reports</span>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink href="#" active={currentItem === "insights"}>
									<TrendingUpIcon />
									<span>Insights</span>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink href="#" active={currentItem === "activity"}>
									<ActivityIcon />
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
									<SettingsIcon />
									<span>General</span>
								</Sidebar.MenuLink>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuLink href="#" active={currentItem === "notifications"}>
									<BellIcon />
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
						<span className="text-xs text-neutral-500">john@acme.com</span>
					</div>
				</div>
			</Sidebar.Footer>
		</Sidebar>
	);
}

// Dashboard Header Component
function DashboardHeader() {
	return (
		<header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
			<div className="flex items-center gap-4">
				<Sidebar.Trigger className="flex items-center justify-center rounded-md p-2 hover:bg-neutral-100">
					<MenuIcon />
				</Sidebar.Trigger>
				<h1 className="text-lg font-semibold">Dashboard</h1>
			</div>

			<div className="flex items-center gap-3">
				<Button variant="ghost" size="sm" className="relative">
					<BellIcon />
					<span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger-500 text-[10px] text-white">
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
						<ChevronDownIcon />
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
			<Card.Content>
				<Table aria-label="Recent orders">
					<Table.Header>
						<Table.Column isRowHeader>Order</Table.Column>
						<Table.Column>Customer</Table.Column>
						<Table.Column>Status</Table.Column>
						<Table.Column align="right">Amount</Table.Column>
						<Table.Column>Date</Table.Column>
					</Table.Header>
					<Table.Body>
						{orders.map((order) => (
							<Table.Row key={order.id}>
								<Table.Cell className="font-medium">{order.id}</Table.Cell>
								<Table.Cell>
									<div className="flex flex-col">
										<span>{order.customer}</span>
										<span className="text-xs text-neutral-500">{order.email}</span>
									</div>
								</Table.Cell>
								<Table.Cell>
									<Badge color={getStatusColor(order.status)} variant="secondary">
										{order.status}
									</Badge>
								</Table.Cell>
								<Table.Cell className="text-right">{order.amount}</Table.Cell>
								<Table.Cell className="text-neutral-500">{order.date}</Table.Cell>
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
							<div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50">
								<p className="text-neutral-500">Overview chart placeholder</p>
							</div>
						</Tabs.Panel>
						<Tabs.Panel id="revenue">
							<div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50">
								<p className="text-neutral-500">Revenue chart placeholder</p>
							</div>
						</Tabs.Panel>
						<Tabs.Panel id="customers">
							<div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50">
								<p className="text-neutral-500">Customers chart placeholder</p>
							</div>
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
			<div className="flex h-[800px] w-full bg-neutral-50">
				<DashboardSidebar currentItem="dashboard" />

				<div className="flex flex-1 flex-col overflow-hidden">
					<DashboardHeader />

					<main className="flex-1 overflow-auto p-6">
						{/* Metrics Grid */}
						<div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<MetricCard
								title="Total Revenue"
								value="$45,231.89"
								change="+20.1% from last month"
								changeType="positive"
								icon={<DollarIcon />}
							/>
							<MetricCard
								title="Subscriptions"
								value="+2,350"
								change="+180.1% from last month"
								changeType="positive"
								icon={<UsersIcon />}
							/>
							<MetricCard
								title="Sales"
								value="+12,234"
								change="+19% from last month"
								changeType="positive"
								icon={<CreditCardIcon />}
							/>
							<MetricCard
								title="Active Now"
								value="+573"
								change="+201 since last hour"
								changeType="neutral"
								icon={<ActivityIcon />}
							/>
						</div>

						{/* Main Content Grid */}
						<div className="grid gap-6 lg:grid-cols-7">
							<div className="lg:col-span-4">
								<AnalyticsTabs />
							</div>
							<div className="lg:col-span-3">
								<Card className="h-full">
									<Card.Header>
										<Card.Title>Recent Activity</Card.Title>
										<Card.Description>Your latest transactions and updates.</Card.Description>
									</Card.Header>
									<Card.Content>
										<div className="space-y-4">
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
												<div key={index} className="flex items-center gap-3">
													<Avatar size="sm">
														<Avatar.Fallback>
															{activity.name
																.split(" ")
																.map((n) => n[0])
																.join("")}
														</Avatar.Fallback>
													</Avatar>
													<div className="flex-1 min-w-0">
														<p className="text-sm font-medium truncate">{activity.name}</p>
														<p className="text-xs text-neutral-500 truncate">{activity.action}</p>
													</div>
													<div className="text-right">
														<p className="text-sm font-medium">{activity.amount}</p>
														<p className="text-xs text-neutral-500">{activity.time}</p>
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
			<div className="flex h-[800px] w-full bg-neutral-50">
				<DashboardSidebar currentItem="dashboard" />

				<div className="flex flex-1 flex-col overflow-hidden">
					<DashboardHeader />

					<main className="flex-1 overflow-auto p-6">
						<div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<MetricCard
								title="Total Revenue"
								value="$45,231.89"
								change="+20.1% from last month"
								changeType="positive"
								icon={<DollarIcon />}
							/>
							<MetricCard
								title="Subscriptions"
								value="+2,350"
								change="+180.1% from last month"
								changeType="positive"
								icon={<UsersIcon />}
							/>
							<MetricCard
								title="Sales"
								value="+12,234"
								change="+19% from last month"
								changeType="positive"
								icon={<CreditCardIcon />}
							/>
							<MetricCard
								title="Active Now"
								value="+573"
								change="+201 since last hour"
								changeType="neutral"
								icon={<ActivityIcon />}
							/>
						</div>

						<div className="grid gap-6 lg:grid-cols-7">
							<div className="lg:col-span-4">
								<AnalyticsTabs />
							</div>
							<div className="lg:col-span-3">
								<Card className="h-full">
									<Card.Header>
										<Card.Title>Recent Activity</Card.Title>
									</Card.Header>
									<Card.Content>
										<p className="text-neutral-500">Activity feed content...</p>
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
