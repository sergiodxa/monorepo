import type { Meta, StoryObj } from "@storybook/react";

import {
	Pagination,
	PaginationButton,
	PaginationItem,
	PaginationLink,
	PaginationList,
} from "./pagination";

const meta: Meta<typeof Pagination> = {
	title: "Navigation/Pagination",
	component: Pagination,
	args: {
		"aria-label": "Pagination",
	},
};

export default meta;
type Story = StoryObj<typeof Pagination>;

export const Default: Story = {
	render: (args) => (
		<Pagination {...args}>
			<PaginationList>
				<PaginationItem>
					<PaginationButton aria-label="Previous page" isDisabled>
						Previous
					</PaginationButton>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href="/items?page=1" isCurrent>
						1
					</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href="/items?page=2">2</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href="/items?page=3">3</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href="/items?page=4">4</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationLink href="/items?page=5">5</PaginationLink>
				</PaginationItem>
				<PaginationItem>
					<PaginationButton aria-label="Next page">Next</PaginationButton>
				</PaginationItem>
			</PaginationList>
		</Pagination>
	),
};
