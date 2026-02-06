import type { Meta, StoryObj } from "@storybook/react";
import type { SortDescriptor } from "react-aria-components";

import { useState } from "react";

import { Checkbox } from "./checkbox";
import { Table } from "./table";

const meta: Meta<typeof Table> = {
	title: "Collections/Table",
	component: Table,
	args: {
		selectionMode: "none",
	},
	argTypes: {
		selectionMode: { control: "select", options: ["none", "single", "multiple"] },
	},
};

export default meta;
type Story = StoryObj<typeof Table>;

interface User {
	id: number;
	name: string;
	email: string;
	role: string;
	status: "active" | "inactive" | "pending";
}

const users: User[] = [
	{ id: 1, name: "Alice Johnson", email: "alice@example.com", role: "Admin", status: "active" },
	{ id: 2, name: "Bob Smith", email: "bob@example.com", role: "Editor", status: "active" },
	{ id: 3, name: "Carol White", email: "carol@example.com", role: "Viewer", status: "inactive" },
	{ id: 4, name: "David Brown", email: "david@example.com", role: "Editor", status: "pending" },
	{ id: 5, name: "Eve Davis", email: "eve@example.com", role: "Admin", status: "active" },
];

export const Default: Story = {
	render: (args) => (
		<Table aria-label="Users" {...args}>
			<Table.Header>
				<Table.Column isRowHeader>Name</Table.Column>
				<Table.Column>Email</Table.Column>
				<Table.Column>Role</Table.Column>
				<Table.Column>Status</Table.Column>
			</Table.Header>
			<Table.Body>
				{users.map((user) => (
					<Table.Row key={user.id}>
						<Table.Cell>{user.name}</Table.Cell>
						<Table.Cell>{user.email}</Table.Cell>
						<Table.Cell>{user.role}</Table.Cell>
						<Table.Cell>{user.status}</Table.Cell>
					</Table.Row>
				))}
			</Table.Body>
		</Table>
	),
};

export const SingleSelection: Story = {
	render: () => (
		<Table aria-label="Users" selectionMode="single">
			<Table.Header>
				<Table.Column isRowHeader>Name</Table.Column>
				<Table.Column>Email</Table.Column>
				<Table.Column>Role</Table.Column>
			</Table.Header>
			<Table.Body>
				{users.map((user) => (
					<Table.Row key={user.id}>
						<Table.Cell>{user.name}</Table.Cell>
						<Table.Cell>{user.email}</Table.Cell>
						<Table.Cell>{user.role}</Table.Cell>
					</Table.Row>
				))}
			</Table.Body>
		</Table>
	),
};

export const MultipleSelection: Story = {
	render: () => (
		<Table aria-label="Users" selectionMode="multiple">
			<Table.Header>
				<Table.Column>
					<Checkbox slot="selection" />
				</Table.Column>
				<Table.Column isRowHeader>Name</Table.Column>
				<Table.Column>Email</Table.Column>
				<Table.Column>Role</Table.Column>
			</Table.Header>
			<Table.Body>
				{users.map((user) => (
					<Table.Row key={user.id}>
						<Table.Cell>
							<Checkbox slot="selection" />
						</Table.Cell>
						<Table.Cell>{user.name}</Table.Cell>
						<Table.Cell>{user.email}</Table.Cell>
						<Table.Cell>{user.role}</Table.Cell>
					</Table.Row>
				))}
			</Table.Body>
		</Table>
	),
};

export const Sortable: Story = {
	render: function SortableTable() {
		let [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
			column: "name",
			direction: "ascending",
		});

		let sortedUsers = [...users].sort((a, b) => {
			let first = a[sortDescriptor.column as keyof User];
			let second = b[sortDescriptor.column as keyof User];
			let cmp = String(first ?? "").localeCompare(String(second ?? ""));
			if (sortDescriptor.direction === "descending") {
				cmp *= -1;
			}
			return cmp;
		});

		return (
			<Table aria-label="Users" sortDescriptor={sortDescriptor} onSortChange={setSortDescriptor}>
				<Table.Header>
					<Table.Column id="name" isRowHeader allowsSorting>
						Name
					</Table.Column>
					<Table.Column id="email" allowsSorting>
						Email
					</Table.Column>
					<Table.Column id="role" allowsSorting>
						Role
					</Table.Column>
					<Table.Column id="status" allowsSorting>
						Status
					</Table.Column>
				</Table.Header>
				<Table.Body>
					{sortedUsers.map((user) => (
						<Table.Row key={user.id}>
							<Table.Cell>{user.name}</Table.Cell>
							<Table.Cell>{user.email}</Table.Cell>
							<Table.Cell>{user.role}</Table.Cell>
							<Table.Cell>{user.status}</Table.Cell>
						</Table.Row>
					))}
				</Table.Body>
			</Table>
		);
	},
};

export const ColumnAlignment: Story = {
	render: () => (
		<Table aria-label="Products">
			<Table.Header>
				<Table.Column isRowHeader align="left">
					Product
				</Table.Column>
				<Table.Column align="center">Category</Table.Column>
				<Table.Column align="right">Price</Table.Column>
				<Table.Column align="right">Stock</Table.Column>
			</Table.Header>
			<Table.Body>
				<Table.Row>
					<Table.Cell>MacBook Pro</Table.Cell>
					<Table.Cell>Electronics</Table.Cell>
					<Table.Cell>$2,499.00</Table.Cell>
					<Table.Cell>45</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell>iPhone 15</Table.Cell>
					<Table.Cell>Electronics</Table.Cell>
					<Table.Cell>$999.00</Table.Cell>
					<Table.Cell>128</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell>AirPods Pro</Table.Cell>
					<Table.Cell>Accessories</Table.Cell>
					<Table.Cell>$249.00</Table.Cell>
					<Table.Cell>200</Table.Cell>
				</Table.Row>
			</Table.Body>
		</Table>
	),
};

export const ResizableColumns: Story = {
	render: () => (
		<Table.ResizableContainer>
			<Table aria-label="Users">
				<Table.Header>
					<Table.Column isRowHeader width={200} minWidth={100} maxWidth={300}>
						Name
						<Table.ColumnResizer />
					</Table.Column>
					<Table.Column width={250} minWidth={150}>
						Email
						<Table.ColumnResizer />
					</Table.Column>
					<Table.Column width={120} minWidth={80}>
						Role
						<Table.ColumnResizer />
					</Table.Column>
					<Table.Column width={100} minWidth={80}>
						Status
					</Table.Column>
				</Table.Header>
				<Table.Body>
					{users.map((user) => (
						<Table.Row key={user.id}>
							<Table.Cell>{user.name}</Table.Cell>
							<Table.Cell>{user.email}</Table.Cell>
							<Table.Cell>{user.role}</Table.Cell>
							<Table.Cell>{user.status}</Table.Cell>
						</Table.Row>
					))}
				</Table.Body>
			</Table>
		</Table.ResizableContainer>
	),
};

const allUsers: User[] = [
	...users,
	{ id: 6, name: "Frank Miller", email: "frank@example.com", role: "Viewer", status: "active" },
	{ id: 7, name: "Grace Lee", email: "grace@example.com", role: "Editor", status: "inactive" },
	{ id: 8, name: "Henry Wilson", email: "henry@example.com", role: "Admin", status: "active" },
];

export const WithLoadMore: Story = {
	render: function LoadMoreTable() {
		let [items, setItems] = useState<User[]>(allUsers.slice(0, 3));
		let [isLoading, setIsLoading] = useState(false);

		let hasMore = items.length < allUsers.length;

		let loadMore = async () => {
			setIsLoading(true);
			// Simulate API delay
			await new Promise((resolve) => setTimeout(resolve, 500));
			setItems((prev) => allUsers.slice(0, prev.length + 3));
			setIsLoading(false);
		};

		return (
			<Table aria-label="Users">
				<Table.Header>
					<Table.Column isRowHeader>Name</Table.Column>
					<Table.Column>Email</Table.Column>
					<Table.Column>Role</Table.Column>
				</Table.Header>
				<Table.Body renderEmptyState={() => <span>Loading...</span>}>
					{items.map((user) => (
						<Table.Row key={user.id}>
							<Table.Cell>{user.name}</Table.Cell>
							<Table.Cell>{user.email}</Table.Cell>
							<Table.Cell>{user.role}</Table.Cell>
						</Table.Row>
					))}
					{hasMore && (
						<Table.LoadMoreItem onLoadMore={loadMore} isLoading={isLoading}>
							Loading more...
						</Table.LoadMoreItem>
					)}
				</Table.Body>
			</Table>
		);
	},
};

export const Empty: Story = {
	render: () => (
		<Table aria-label="Empty table">
			<Table.Header>
				<Table.Column isRowHeader>Name</Table.Column>
				<Table.Column>Email</Table.Column>
				<Table.Column>Role</Table.Column>
			</Table.Header>
			<Table.Body renderEmptyState={() => <span>No users found</span>}>{[]}</Table.Body>
		</Table>
	),
};
