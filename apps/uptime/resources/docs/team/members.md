---
title: Team Members & Roles
description: See what Owners, Admins and Members can each do, and change a member's role or remove them from the team.
section:
  title: Team & Settings
  order: 5
order: 1
lastUpdated: 2026-10-31
next: ["/docs/team/invites", "/docs/team/domains"]
keywords: ["permissions", "roles", "admin", "owner", "access", "rbac"]
---

Every team member holds one of three roles. The **Owner** is the person who created the team, and there is one per team. Everyone else is an **Admin** or a **Member**; people who join through an invite or a verified domain start as Members.

## Role Permissions

| Action                                                               | Member | Admin | Owner |
| -------------------------------------------------------------------- | :----: | :---: | :---: |
| View monitors, results, alerts, maintenance windows and status pages |  Yes   |  Yes  |  Yes  |
| Create and edit HTTP, DNS, TCP and flow monitors and cron jobs       |  Yes   |  Yes  |  Yes  |
| Run a check now                                                      |  Yes   |  Yes  |  Yes  |
| Create, edit and delete alerts                                       |  Yes   |  Yes  |  Yes  |
| Schedule, edit and end maintenance windows                           |  Yes   |  Yes  |  Yes  |
| Create, edit and delete status pages                                 |  Yes   |  Yes  |  Yes  |
| Download reports                                                     |  Yes   |  Yes  |  Yes  |
| Delete monitors and cron jobs                                        |   No   |  Yes  |  Yes  |
| Open <ui>Settings</ui> and change the team's name and logo           |   No   |  Yes  |  Yes  |
| Invite people and revoke invites                                     |   No   |  Yes  |  Yes  |
| Change a member's role or remove them                                |   No   |  Yes  |  Yes  |
| Add, verify and remove team domains                                  |   No   |  Yes  |  Yes  |
| Create and delete API keys                                           |   No   |  Yes  |  Yes  |
| Open the billing portal and manage the subscription                  |   No   |  No   |  Yes  |
| Delete the team                                                      |   No   |  No   |  Yes  |
| Leave the team                                                       |  Yes   |  No   |  No   |

Nobody can change the Owner's role or remove the Owner from the team. The <ui>API Keys</ui> and <ui>Settings</ui> links appear in the sidebar only for Admins and the Owner.

## Changing Roles

Owners and Admins can change the role of any member except the Owner.

1. Open <ui>Settings</ui> in the sidebar and find the person under **Current Members**.
2. Open their <ui>Actions Menu</ui>.
3. Choose <ui>Convert to Admin</ui> or <ui>Convert to Member</ui>.

The change takes effect immediately.

## Transferring Ownership

Ownership can't be handed to someone else yet. The <ui>Transfer Ownership</ui> item in the menu is shown but disabled.

## Removing Team Members

Owners and Admins can remove any member except the Owner.

1. Open <ui>Settings</ui> in the sidebar and find the person under **Current Members**.
2. Open their <ui>Actions Menu</ui> and choose <ui>Remove from Team</ui>.
3. Confirm the removal.

Removed members immediately lose access to the team. Any monitors, alerts, or status pages they created remain intact and are still accessible by other team members.

To remove yourself from a team, open <ui>Account</ui> from your user menu, find the team under **Your Teams**, and choose <ui>Leave Team</ui> from its <ui>Actions Menu</ui>. The option appears only for Members: an Admin is converted to Member by the Owner or another Admin first, and the Owner can't leave the team.
