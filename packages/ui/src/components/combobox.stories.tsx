import type { Meta, StoryObj } from "@storybook/react";

import { ComboBox } from "./combobox";
import { Header } from "./header";
import { Label } from "./label";
import { ListBox } from "./listbox";
import { Popover } from "./popover";
import { Text } from "./text";

const meta: Meta<typeof ComboBox> = {
	title: "Selection/ComboBox",
	component: ComboBox,
	args: {
		isDisabled: false,
		isInvalid: false,
	},
	argTypes: {
		isDisabled: { control: "boolean" },
		isInvalid: { control: "boolean" },
	},
};

export default meta;
type Story = StoryObj<typeof ComboBox>;

export const Default: Story = {
	render: (args) => (
		<ComboBox {...args}>
			<Label>Favorite fruit</Label>
			<ComboBox.Group>
				<ComboBox.Input placeholder="Search fruits..." />
				<ComboBox.Button />
			</ComboBox.Group>
			<Popover>
				<ListBox>
					<ListBox.Item id="apple">Apple</ListBox.Item>
					<ListBox.Item id="banana">Banana</ListBox.Item>
					<ListBox.Item id="orange">Orange</ListBox.Item>
					<ListBox.Item id="grape">Grape</ListBox.Item>
					<ListBox.Item id="mango">Mango</ListBox.Item>
				</ListBox>
			</Popover>
		</ComboBox>
	),
};

export const WithDefaultValue: Story = {
	render: (args) => (
		<ComboBox {...args} defaultInputValue="Banana">
			<Label>Favorite fruit</Label>
			<ComboBox.Group>
				<ComboBox.Input />
				<ComboBox.Button />
			</ComboBox.Group>
			<Popover>
				<ListBox>
					<ListBox.Item id="apple">Apple</ListBox.Item>
					<ListBox.Item id="banana">Banana</ListBox.Item>
					<ListBox.Item id="orange">Orange</ListBox.Item>
					<ListBox.Item id="grape">Grape</ListBox.Item>
				</ListBox>
			</Popover>
		</ComboBox>
	),
};

export const Disabled: Story = {
	render: (args) => (
		<ComboBox {...args} isDisabled>
			<Label>Favorite fruit</Label>
			<ComboBox.Group>
				<ComboBox.Input placeholder="Search fruits..." />
				<ComboBox.Button />
			</ComboBox.Group>
			<Popover>
				<ListBox>
					<ListBox.Item id="apple">Apple</ListBox.Item>
					<ListBox.Item id="banana">Banana</ListBox.Item>
					<ListBox.Item id="orange">Orange</ListBox.Item>
				</ListBox>
			</Popover>
		</ComboBox>
	),
};

export const Invalid: Story = {
	render: (args) => (
		<ComboBox {...args} isInvalid>
			<Label>Favorite fruit</Label>
			<ComboBox.Group>
				<ComboBox.Input placeholder="Search fruits..." />
				<ComboBox.Button />
			</ComboBox.Group>
			<Text slot="errorMessage">Please select a valid fruit</Text>
			<Popover>
				<ListBox>
					<ListBox.Item id="apple">Apple</ListBox.Item>
					<ListBox.Item id="banana">Banana</ListBox.Item>
					<ListBox.Item id="orange">Orange</ListBox.Item>
				</ListBox>
			</Popover>
		</ComboBox>
	),
};

export const WithDescription: Story = {
	render: (args) => (
		<ComboBox {...args}>
			<Label>Country</Label>
			<Text slot="description">Search and select your country</Text>
			<ComboBox.Group>
				<ComboBox.Input placeholder="Search countries..." />
				<ComboBox.Button />
			</ComboBox.Group>
			<Popover>
				<ListBox>
					<ListBox.Item id="us">United States</ListBox.Item>
					<ListBox.Item id="uk">United Kingdom</ListBox.Item>
					<ListBox.Item id="ca">Canada</ListBox.Item>
					<ListBox.Item id="au">Australia</ListBox.Item>
					<ListBox.Item id="de">Germany</ListBox.Item>
					<ListBox.Item id="fr">France</ListBox.Item>
				</ListBox>
			</Popover>
		</ComboBox>
	),
};

export const WithSections: Story = {
	render: (args) => (
		<ComboBox {...args}>
			<Label>Food</Label>
			<ComboBox.Group>
				<ComboBox.Input placeholder="Search food..." />
				<ComboBox.Button />
			</ComboBox.Group>
			<Popover>
				<ListBox>
					<ListBox.Section>
						<Header>Fruits</Header>
						<ListBox.Item id="apple">Apple</ListBox.Item>
						<ListBox.Item id="banana">Banana</ListBox.Item>
						<ListBox.Item id="orange">Orange</ListBox.Item>
					</ListBox.Section>
					<ListBox.Section>
						<Header>Vegetables</Header>
						<ListBox.Item id="carrot">Carrot</ListBox.Item>
						<ListBox.Item id="broccoli">Broccoli</ListBox.Item>
						<ListBox.Item id="spinach">Spinach</ListBox.Item>
					</ListBox.Section>
				</ListBox>
			</Popover>
		</ComboBox>
	),
};

export const WithItemDescriptions: Story = {
	render: (args) => (
		<ComboBox {...args}>
			<Label>Select a plan</Label>
			<ComboBox.Group>
				<ComboBox.Input placeholder="Search plans..." />
				<ComboBox.Button />
			</ComboBox.Group>
			<Popover>
				<ListBox>
					<ListBox.Item id="free" textValue="Free">
						<Text slot="label">Free</Text>
						<Text slot="description">Basic features, limited usage</Text>
					</ListBox.Item>
					<ListBox.Item id="pro" textValue="Pro">
						<Text slot="label">Pro</Text>
						<Text slot="description">All features, unlimited usage</Text>
					</ListBox.Item>
					<ListBox.Item id="enterprise" textValue="Enterprise">
						<Text slot="label">Enterprise</Text>
						<Text slot="description">Custom solutions, dedicated support</Text>
					</ListBox.Item>
				</ListBox>
			</Popover>
		</ComboBox>
	),
};

export const WithDisabledItems: Story = {
	render: (args) => (
		<ComboBox {...args}>
			<Label>Options</Label>
			<ComboBox.Group>
				<ComboBox.Input placeholder="Search options..." />
				<ComboBox.Button />
			</ComboBox.Group>
			<Popover>
				<ListBox disabledKeys={["option2"]}>
					<ListBox.Item id="option1">Option 1</ListBox.Item>
					<ListBox.Item id="option2">Option 2 (unavailable)</ListBox.Item>
					<ListBox.Item id="option3">Option 3</ListBox.Item>
				</ListBox>
			</Popover>
		</ComboBox>
	),
};

export const AllowsCustomValue: Story = {
	render: (args) => (
		<ComboBox {...args} allowsCustomValue>
			<Label>Tag</Label>
			<Text slot="description">Select an existing tag or create a new one</Text>
			<ComboBox.Group>
				<ComboBox.Input placeholder="Search or create..." />
				<ComboBox.Button />
			</ComboBox.Group>
			<Popover>
				<ListBox>
					<ListBox.Item id="react">React</ListBox.Item>
					<ListBox.Item id="typescript">TypeScript</ListBox.Item>
					<ListBox.Item id="javascript">JavaScript</ListBox.Item>
					<ListBox.Item id="nodejs">Node.js</ListBox.Item>
				</ListBox>
			</Popover>
		</ComboBox>
	),
};
