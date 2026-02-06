import type { Meta, StoryObj } from "@storybook/react";

import { useState } from "react";

import { Avatar } from "../components/avatar";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { Input } from "../components/input";
import { Label } from "../components/label";
import { Separator } from "../components/separator";
import { Sidebar } from "../components/sidebar";
import { Switch } from "../components/switch";
import { TextField } from "../components/text-field";
import { TextArea } from "../components/textarea";

const meta: Meta = {
	title: "Examples/Settings",
};

export default meta;
type Story = StoryObj;

// Icons
function UserIcon() {
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
			<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
			<circle cx="12" cy="7" r="4" />
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

function ShieldIcon() {
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
			<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
		</svg>
	);
}

function LockIcon() {
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
			<rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
			<path d="M7 11V7a5 5 0 0 1 10 0v4" />
		</svg>
	);
}

function EyeOffIcon() {
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
			<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
			<path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
			<path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
			<path d="m2 2 20 20" />
		</svg>
	);
}

function CameraIcon() {
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
			<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
			<circle cx="12" cy="13" r="3" />
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

function ChevronLeftIcon() {
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
			<path d="m15 18-6-6 6-6" />
		</svg>
	);
}

type SettingsSection = "profile" | "account" | "notifications" | "privacy" | "security";

// Settings Sidebar
function SettingsSidebar({
	currentSection,
	onSectionChange,
}: {
	currentSection: SettingsSection;
	onSectionChange: (section: SettingsSection) => void;
}) {
	return (
		<Sidebar>
			<Sidebar.Header>
				<div className="flex items-center gap-2 px-2">
					<Button variant="ghost" size="sm" className="size-8 p-0">
						<ChevronLeftIcon />
					</Button>
					<span className="font-semibold">Settings</span>
				</div>
			</Sidebar.Header>

			<Sidebar.Content>
				<Sidebar.Group>
					<Sidebar.GroupContent>
						<Sidebar.Menu>
							<Sidebar.MenuItem>
								<Sidebar.MenuButton
									active={currentSection === "profile"}
									onPress={() => onSectionChange("profile")}
								>
									<UserIcon />
									<span>Profile</span>
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuButton
									active={currentSection === "account"}
									onPress={() => onSectionChange("account")}
								>
									<SettingsIcon />
									<span>Account</span>
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuButton
									active={currentSection === "notifications"}
									onPress={() => onSectionChange("notifications")}
								>
									<BellIcon />
									<span>Notifications</span>
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuButton
									active={currentSection === "privacy"}
									onPress={() => onSectionChange("privacy")}
								>
									<EyeOffIcon />
									<span>Privacy</span>
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
							<Sidebar.MenuItem>
								<Sidebar.MenuButton
									active={currentSection === "security"}
									onPress={() => onSectionChange("security")}
								>
									<ShieldIcon />
									<span>Security</span>
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						</Sidebar.Menu>
					</Sidebar.GroupContent>
				</Sidebar.Group>
			</Sidebar.Content>

			<Sidebar.Footer>
				<div className="px-2 py-2">
					<p className="text-xs text-neutral-500">Need help?</p>
					<p className="text-xs text-neutral-500">
						Contact <span className="underline cursor-pointer">support</span>
					</p>
				</div>
			</Sidebar.Footer>
		</Sidebar>
	);
}

// Profile Section
function ProfileSection() {
	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-2xl font-semibold tracking-tight">Profile</h2>
				<p className="text-sm text-neutral-500">Manage your public profile information.</p>
			</div>

			<Separator />

			<Card>
				<Card.Header>
					<Card.Title>Avatar</Card.Title>
					<Card.Description>
						Click on the avatar to upload a custom one from your files.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<div className="flex items-center gap-6">
						<div className="relative">
							<Avatar size="lg">
								<Avatar.Image
									src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=96&h=96&fit=crop&crop=face"
									alt="Profile picture"
								/>
								<Avatar.Fallback>JD</Avatar.Fallback>
							</Avatar>
							<button
								type="button"
								className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full border-2 border-white bg-primary-600 text-white hover:bg-primary-700"
							>
								<CameraIcon />
							</button>
						</div>
						<div className="flex flex-col gap-2">
							<Button variant="outline" color="neutral" size="sm">
								Upload new picture
							</Button>
							<Button variant="ghost" color="danger" size="sm">
								Remove picture
							</Button>
						</div>
					</div>
				</Card.Content>
			</Card>

			<Card>
				<Card.Header>
					<Card.Title>Personal Information</Card.Title>
					<Card.Description>Update your personal details here.</Card.Description>
				</Card.Header>
				<Card.Content className="space-y-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<TextField>
							<Label>First name</Label>
							<Input defaultValue="John" />
						</TextField>
						<TextField>
							<Label>Last name</Label>
							<Input defaultValue="Doe" />
						</TextField>
					</div>

					<TextField type="email">
						<Label>Email</Label>
						<Input defaultValue="john.doe@example.com" />
					</TextField>

					<TextField>
						<Label>Bio</Label>
						<TextArea
							placeholder="Write a short bio about yourself..."
							defaultValue="Full-stack developer passionate about building great user experiences. I love working with React and TypeScript."
							rows={4}
						/>
					</TextField>
				</Card.Content>
				<Card.Footer className="justify-end gap-2">
					<Button variant="outline" color="neutral">
						Cancel
					</Button>
					<Button>Save changes</Button>
				</Card.Footer>
			</Card>
		</div>
	);
}

// Account Section
function AccountSection() {
	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-2xl font-semibold tracking-tight">Account</h2>
				<p className="text-sm text-neutral-500">Manage your account settings.</p>
			</div>

			<Separator />

			<Card>
				<Card.Header>
					<Card.Title>Username</Card.Title>
					<Card.Description>
						Your username is used to identify you across the platform.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<TextField>
						<Label>Username</Label>
						<Input defaultValue="johndoe" />
					</TextField>
				</Card.Content>
				<Card.Footer className="justify-end">
					<Button>Update username</Button>
				</Card.Footer>
			</Card>

			<Card>
				<Card.Header>
					<Card.Title>Language & Region</Card.Title>
					<Card.Description>Set your preferred language and timezone.</Card.Description>
				</Card.Header>
				<Card.Content className="space-y-4">
					<TextField>
						<Label>Language</Label>
						<Input defaultValue="English (US)" />
					</TextField>
					<TextField>
						<Label>Timezone</Label>
						<Input defaultValue="(UTC-05:00) Eastern Time" />
					</TextField>
				</Card.Content>
				<Card.Footer className="justify-end">
					<Button>Save preferences</Button>
				</Card.Footer>
			</Card>

			<Card className="border-danger-200 bg-danger-50">
				<Card.Header>
					<Card.Title className="text-danger-700">Danger Zone</Card.Title>
					<Card.Description className="text-danger-600">
						Irreversible and destructive actions.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<p className="text-sm text-danger-600">
						Once you delete your account, there is no going back. Please be certain.
					</p>
				</Card.Content>
				<Card.Footer>
					<Button color="danger" variant="outline">
						Delete account
					</Button>
				</Card.Footer>
			</Card>
		</div>
	);
}

// Notifications Section
function NotificationsSection() {
	let [emailNotifications, setEmailNotifications] = useState(true);
	let [pushNotifications, setPushNotifications] = useState(true);
	let [marketingEmails, setMarketingEmails] = useState(false);
	let [securityAlerts, setSecurityAlerts] = useState(true);
	let [weeklyDigest, setWeeklyDigest] = useState(true);
	let [mentionNotifications, setMentionNotifications] = useState(true);

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-2xl font-semibold tracking-tight">Notifications</h2>
				<p className="text-sm text-neutral-500">Configure how you receive notifications.</p>
			</div>

			<Separator />

			<Card>
				<Card.Header>
					<Card.Title>Email Notifications</Card.Title>
					<Card.Description>Manage your email notification preferences.</Card.Description>
				</Card.Header>
				<Card.Content className="space-y-4">
					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<p className="text-sm font-medium">Email notifications</p>
							<p className="text-sm text-neutral-500">
								Receive emails about your account activity.
							</p>
						</div>
						<Switch isSelected={emailNotifications} onChange={setEmailNotifications} />
					</div>
					<Separator />
					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<p className="text-sm font-medium">Marketing emails</p>
							<p className="text-sm text-neutral-500">
								Receive emails about new features and promotions.
							</p>
						</div>
						<Switch isSelected={marketingEmails} onChange={setMarketingEmails} />
					</div>
					<Separator />
					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<p className="text-sm font-medium">Weekly digest</p>
							<p className="text-sm text-neutral-500">
								Get a weekly summary of your account activity.
							</p>
						</div>
						<Switch isSelected={weeklyDigest} onChange={setWeeklyDigest} />
					</div>
				</Card.Content>
			</Card>

			<Card>
				<Card.Header>
					<Card.Title>Push Notifications</Card.Title>
					<Card.Description>Manage your push notification preferences.</Card.Description>
				</Card.Header>
				<Card.Content className="space-y-4">
					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<p className="text-sm font-medium">Push notifications</p>
							<p className="text-sm text-neutral-500">
								Receive push notifications on your devices.
							</p>
						</div>
						<Switch isSelected={pushNotifications} onChange={setPushNotifications} />
					</div>
					<Separator />
					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<p className="text-sm font-medium">Mentions</p>
							<p className="text-sm text-neutral-500">Get notified when someone mentions you.</p>
						</div>
						<Switch isSelected={mentionNotifications} onChange={setMentionNotifications} />
					</div>
					<Separator />
					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<p className="text-sm font-medium">Security alerts</p>
							<p className="text-sm text-neutral-500">
								Get notified about security events on your account.
							</p>
						</div>
						<Switch isSelected={securityAlerts} onChange={setSecurityAlerts} />
					</div>
				</Card.Content>
			</Card>
		</div>
	);
}

// Privacy Section
function PrivacySection() {
	let [profileVisibility, setProfileVisibility] = useState(true);
	let [showActivity, setShowActivity] = useState(false);
	let [showEmail, setShowEmail] = useState(false);

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-2xl font-semibold tracking-tight">Privacy</h2>
				<p className="text-sm text-neutral-500">Manage your privacy settings and data.</p>
			</div>

			<Separator />

			<Card>
				<Card.Header>
					<Card.Title>Profile Visibility</Card.Title>
					<Card.Description>Control who can see your profile information.</Card.Description>
				</Card.Header>
				<Card.Content className="space-y-4">
					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<p className="text-sm font-medium">Public profile</p>
							<p className="text-sm text-neutral-500">Make your profile visible to everyone.</p>
						</div>
						<Switch isSelected={profileVisibility} onChange={setProfileVisibility} />
					</div>
					<Separator />
					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<p className="text-sm font-medium">Show activity status</p>
							<p className="text-sm text-neutral-500">Let others see when you're online.</p>
						</div>
						<Switch isSelected={showActivity} onChange={setShowActivity} />
					</div>
					<Separator />
					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<p className="text-sm font-medium">Show email address</p>
							<p className="text-sm text-neutral-500">Display your email on your public profile.</p>
						</div>
						<Switch isSelected={showEmail} onChange={setShowEmail} />
					</div>
				</Card.Content>
			</Card>

			<Card>
				<Card.Header>
					<Card.Title>Data Management</Card.Title>
					<Card.Description>Download or delete your data.</Card.Description>
				</Card.Header>
				<Card.Content className="space-y-4">
					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<p className="text-sm font-medium">Export your data</p>
							<p className="text-sm text-neutral-500">
								Download a copy of all your data in JSON format.
							</p>
						</div>
						<Button variant="outline" color="neutral" size="sm">
							Export
						</Button>
					</div>
				</Card.Content>
			</Card>
		</div>
	);
}

// Security Section
function SecuritySection() {
	let [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-2xl font-semibold tracking-tight">Security</h2>
				<p className="text-sm text-neutral-500">
					Manage your security settings and keep your account safe.
				</p>
			</div>

			<Separator />

			<Card>
				<Card.Header>
					<Card.Title>Change Password</Card.Title>
					<Card.Description>Update your password to keep your account secure.</Card.Description>
				</Card.Header>
				<Card.Content className="space-y-4">
					<TextField type="password">
						<Label>Current password</Label>
						<Input placeholder="Enter your current password" />
					</TextField>
					<TextField type="password">
						<Label>New password</Label>
						<Input placeholder="Enter a new password" />
					</TextField>
					<TextField type="password">
						<Label>Confirm new password</Label>
						<Input placeholder="Confirm your new password" />
					</TextField>
				</Card.Content>
				<Card.Footer className="justify-end gap-2">
					<Button variant="outline" color="neutral">
						Cancel
					</Button>
					<Button>Update password</Button>
				</Card.Footer>
			</Card>

			<Card>
				<Card.Header>
					<Card.Title>Two-Factor Authentication</Card.Title>
					<Card.Description>Add an extra layer of security to your account.</Card.Description>
				</Card.Header>
				<Card.Content className="space-y-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="flex size-10 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
								<LockIcon />
							</div>
							<div className="space-y-0.5">
								<p className="text-sm font-medium">Two-factor authentication</p>
								<p className="text-sm text-neutral-500">
									{twoFactorEnabled
										? "Your account is protected with 2FA."
										: "Protect your account with 2FA."}
								</p>
							</div>
						</div>
						<Switch isSelected={twoFactorEnabled} onChange={setTwoFactorEnabled} />
					</div>
				</Card.Content>
				{!twoFactorEnabled && (
					<Card.Footer>
						<Button variant="outline" color="neutral" onPress={() => setTwoFactorEnabled(true)}>
							Set up 2FA
						</Button>
					</Card.Footer>
				)}
			</Card>

			<Card>
				<Card.Header>
					<Card.Title>Active Sessions</Card.Title>
					<Card.Description>Manage your active sessions across devices.</Card.Description>
				</Card.Header>
				<Card.Content className="space-y-4">
					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<p className="text-sm font-medium">MacBook Pro - Chrome</p>
							<p className="text-sm text-neutral-500">San Francisco, CA - Current session</p>
						</div>
						<span className="rounded-full bg-success-100 px-2 py-1 text-xs font-medium text-success-700">
							Active
						</span>
					</div>
					<Separator />
					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<p className="text-sm font-medium">iPhone 15 - Safari</p>
							<p className="text-sm text-neutral-500">San Francisco, CA - 2 hours ago</p>
						</div>
						<Button variant="ghost" color="danger" size="sm">
							Revoke
						</Button>
					</div>
					<Separator />
					<div className="flex items-center justify-between">
						<div className="space-y-0.5">
							<p className="text-sm font-medium">Windows PC - Firefox</p>
							<p className="text-sm text-neutral-500">New York, NY - 3 days ago</p>
						</div>
						<Button variant="ghost" color="danger" size="sm">
							Revoke
						</Button>
					</div>
				</Card.Content>
				<Card.Footer>
					<Button variant="outline" color="danger">
						Sign out all other sessions
					</Button>
				</Card.Footer>
			</Card>
		</div>
	);
}

// Settings Header
function SettingsHeader() {
	return (
		<header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
			<div className="flex items-center gap-4">
				<Sidebar.Trigger className="flex items-center justify-center rounded-md p-2 hover:bg-neutral-100 md:hidden">
					<MenuIcon />
				</Sidebar.Trigger>
				<h1 className="text-lg font-semibold">Settings</h1>
			</div>
		</header>
	);
}

// Main Settings Page
function SettingsPage() {
	let [currentSection, setCurrentSection] = useState<SettingsSection>("profile");

	let renderSection = () => {
		switch (currentSection) {
			case "profile":
				return <ProfileSection />;
			case "account":
				return <AccountSection />;
			case "notifications":
				return <NotificationsSection />;
			case "privacy":
				return <PrivacySection />;
			case "security":
				return <SecuritySection />;
		}
	};

	return (
		<Sidebar.Provider defaultOpen>
			<div className="flex h-[800px] w-full bg-neutral-50">
				<SettingsSidebar currentSection={currentSection} onSectionChange={setCurrentSection} />

				<div className="flex flex-1 flex-col overflow-hidden">
					<SettingsHeader />

					<main className="flex-1 overflow-auto p-6">
						<div className="mx-auto max-w-2xl">{renderSection()}</div>
					</main>
				</div>
			</div>
		</Sidebar.Provider>
	);
}

export const Default: Story = {
	render: () => <SettingsPage />,
	parameters: {
		layout: "fullscreen",
	},
};

// Profile Section Story
export const ProfileSettings: Story = {
	render: () => (
		<div className="min-h-screen bg-neutral-50 p-6">
			<div className="mx-auto max-w-2xl">
				<ProfileSection />
			</div>
		</div>
	),
	parameters: {
		layout: "fullscreen",
	},
};

// Notifications Section Story
export const NotificationSettings: Story = {
	render: () => (
		<div className="min-h-screen bg-neutral-50 p-6">
			<div className="mx-auto max-w-2xl">
				<NotificationsSection />
			</div>
		</div>
	),
	parameters: {
		layout: "fullscreen",
	},
};

// Security Section Story
export const SecuritySettings: Story = {
	render: () => (
		<div className="min-h-screen bg-neutral-50 p-6">
			<div className="mx-auto max-w-2xl">
				<SecuritySection />
			</div>
		</div>
	),
	parameters: {
		layout: "fullscreen",
	},
};
