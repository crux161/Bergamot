import React, { useState, useEffect, useCallback } from "react";
import { Button, Input, Switch, Toast, Modal, Avatar } from "@douyinfe/semi-ui";
import { PhIcon } from "./PhIcon";
import type { ServerRead, UserRead, RoleRead, MemberWithRoles } from "../services/api";
import { Permissions, hasPermission } from "../services/api";
import * as api from "../services/api";

// ── Permission definitions for the toggle list ──

const PERMISSION_DEFS = [
  { flag: Permissions.ADMINISTRATOR, name: "Administrator", desc: "Full access — grants every permission." },
  { flag: Permissions.MANAGE_SERVER, name: "Manage Server", desc: "Edit server name and icon." },
  { flag: Permissions.MANAGE_CHANNELS, name: "Manage Channels", desc: "Create, edit, and delete channels." },
  { flag: Permissions.MANAGE_ROLES, name: "Manage Roles", desc: "Create, edit, and delete roles." },
  { flag: Permissions.MANAGE_MESSAGES, name: "Manage Messages", desc: "Delete messages from other members." },
  { flag: Permissions.KICK_MEMBERS, name: "Kick Members", desc: "Remove members from the server." },
  { flag: Permissions.SEND_MESSAGES, name: "Send Messages", desc: "Send messages in text channels." },
  { flag: Permissions.VIEW_CHANNELS, name: "View Channels", desc: "View and read text channels." },
];

const COLOR_PRESETS = [
  "#99aab5", "#1abc9c", "#2ecc71", "#3498db", "#9b59b6",
  "#e91e63", "#f1c40f", "#e67e22", "#e74c3c", "#95a5a6",
  "#607d8b", "#11806a", "#1f8b4c", "#206694", "#71368a",
  "#ad1457", "#c27c0e", "#a84300", "#992d22", "#6b9362",
];

// ── Types ──

interface Props {
  server: ServerRead;
  currentUser: UserRead;
  myPermissions: number;
  onClose: () => void;
}

// ── Main Component ──

export const ServerSettingsPanel: React.FC<Props> = ({
  server,
  currentUser,
  myPermissions,
  onClose,
}) => {
  const [activeKey, setActiveKey] = useState("overview");
  const [roles, setRoles] = useState<RoleRead[]>([]);
  const [members, setMembers] = useState<MemberWithRoles[]>([]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Load roles and members
  useEffect(() => {
    api.listRoles(server.id).then(setRoles).catch(() => {});
    api.listMembers(server.id).then(setMembers).catch(() => {});
  }, [server.id]);

  const handleRolesChanged = useCallback(() => {
    api.listRoles(server.id).then(setRoles).catch(() => {});
    api.listMembers(server.id).then(setMembers).catch(() => {});
  }, [server.id]);

  const isAdmin = hasPermission(myPermissions, Permissions.ADMINISTRATOR);
  const canManageServer = isAdmin || hasPermission(myPermissions, Permissions.MANAGE_SERVER);
  const canManageRoles = isAdmin || hasPermission(myPermissions, Permissions.MANAGE_ROLES);
  const canKick = isAdmin || hasPermission(myPermissions, Permissions.KICK_MEMBERS);

  const navItems = [
    { key: "overview", label: "Overview", icon: "circles-four" },
    ...(canManageRoles ? [{ key: "roles", label: "Roles", icon: "shield" }] : []),
    { key: "members", label: "Members", icon: "users" },
    ...(canManageServer ? [{ key: "invites", label: "Invites", icon: "link" }] : []),
    ...(canKick ? [{ key: "bans", label: "Bans", icon: "prohibit" }] : []),
    ...(canManageServer ? [{ key: "emoji", label: "Emoji", icon: "smiley" }] : []),
    ...(canManageServer ? [{ key: "audit-log", label: "Audit Log", icon: "clipboard-text" }] : []),
    ...(canManageServer ? [{ key: "moderation", label: "Moderation", icon: "shield-warning" }] : []),
    ...(canManageServer ? [{ key: "webhooks", label: "Webhooks", icon: "webhooks-logo" }] : []),
  ];

  return (
    <div className="settings-overlay">
      <nav className="settings-nav">
        <div className="settings-nav__section">{server.name}</div>
        {navItems.map((item) => (
          <div
            key={item.key}
            className={`settings-nav__item ${activeKey === item.key ? "settings-nav__item--active" : ""}`}
            onClick={() => setActiveKey(item.key)}
          >
            <PhIcon name={item.icon} size={18} className="settings-nav__item-icon" />
            <span className="settings-nav__item-label">{item.label}</span>
          </div>
        ))}
      </nav>

      <div className="settings-content">
        <div className="settings-content__header">
          <h2 className="settings-content__title">
            {navItems.find((i) => i.key === activeKey)?.label}
          </h2>
          <div className="settings-content__close" onClick={onClose}>
            <PhIcon name="x" size={24} />
            <span className="settings-content__close-label">ESC</span>
          </div>
        </div>

        <div className="settings-content__body">
          {activeKey === "overview" && (
            <OverviewPane server={server} currentUser={currentUser} />
          )}
          {activeKey === "roles" && (
            <RolesEditor
              serverId={server.id}
              roles={roles}
              members={members}
              onChanged={handleRolesChanged}
            />
          )}
          {activeKey === "members" && (
            <MembersPane serverId={server.id} members={members} roles={roles} />
          )}
          {activeKey === "invites" && (
            <InvitesPane serverId={server.id} />
          )}
          {activeKey === "bans" && (
            <BansPane serverId={server.id} members={members} />
          )}
          {activeKey === "emoji" && (
            <PlaceholderPane
              title="Server Emoji"
              description="Upload custom emoji for this server. Members can use these emoji in messages and reactions."
              icon="smiley"
            />
          )}
          {activeKey === "audit-log" && (
            <AuditLogPane serverId={server.id} />
          )}
          {activeKey === "moderation" && (
            <PlaceholderPane
              title="Moderation"
              description="Configure auto-moderation rules, spam filters, and content policies. Set up keyword filters and automatic actions for rule violations."
              icon="shield-warning"
            />
          )}
          {activeKey === "webhooks" && (
            <PlaceholderPane
              title="Webhooks"
              description="Create webhook integrations to post automated messages from external services into channels."
              icon="webhooks-logo"
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ── Overview Pane ──

const OverviewPane: React.FC<{ server: ServerRead; currentUser: UserRead }> = ({
  server,
  currentUser,
}) => (
  <div className="settings-card" style={{ padding: 24 }}>
    <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 24 }}>
      <Avatar size="extra-large" style={{ backgroundColor: "var(--semi-color-primary-light-default)", color: "var(--header-primary)", width: 80, height: 80, fontSize: 32 }}>
        {server.name[0]?.toUpperCase()}
      </Avatar>
      <div>
        <div style={{ color: "var(--header-primary)", fontSize: 20, fontWeight: 600 }}>{server.name}</div>
        <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
          Owner: {currentUser.display_name || currentUser.username}
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>
          Created {new Date(server.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </div>
      </div>
    </div>
  </div>
);

// ── Roles Editor ──

interface RolesEditorProps {
  serverId: string;
  roles: RoleRead[];
  members: MemberWithRoles[];
  onChanged: () => void;
}

const RolesEditor: React.FC<RolesEditorProps> = ({ serverId, roles, members, onChanged }) => {
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"display" | "permissions" | "members">("display");

  // Editing state
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<string | null>(null);
  const [editPermissions, setEditPermissions] = useState(0);
  const [dirty, setDirty] = useState(false);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) || null;

  // Sync edit state when selection changes
  useEffect(() => {
    if (selectedRole) {
      setEditName(selectedRole.name);
      setEditColor(selectedRole.color);
      setEditPermissions(selectedRole.permissions);
      setDirty(false);
      setActiveTab("display");
    }
  }, [selectedRoleId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateRole = useCallback(async () => {
    try {
      const role = await api.createRole(serverId, { name: "new role", permissions: 0 });
      onChanged();
      setSelectedRoleId(role.id);
    } catch (err: any) {
      Toast.error({ content: err.message, duration: 2 });
    }
  }, [serverId, onChanged]);

  const handleSave = useCallback(async () => {
    if (!selectedRole) return;
    try {
      await api.updateRole(serverId, selectedRole.id, {
        name: editName,
        color: editColor || undefined,
        permissions: editPermissions,
      });
      Toast.success({ content: "Role updated", duration: 1.5 });
      setDirty(false);
      onChanged();
    } catch (err: any) {
      Toast.error({ content: err.message, duration: 2 });
    }
  }, [serverId, selectedRole, editName, editColor, editPermissions, onChanged]);

  const handleReset = useCallback(() => {
    if (selectedRole) {
      setEditName(selectedRole.name);
      setEditColor(selectedRole.color);
      setEditPermissions(selectedRole.permissions);
      setDirty(false);
    }
  }, [selectedRole]);

  const handleDeleteRole = useCallback(async () => {
    if (!selectedRole || selectedRole.is_default) return;
    Modal.confirm({
      title: `Delete "${selectedRole.name}"?`,
      content: "This action cannot be undone. Members with this role will lose its permissions.",
      okText: "Delete",
      cancelText: "Cancel",
      okButtonProps: { type: "danger" } as any,
      onOk: async () => {
        try {
          await api.deleteRole(serverId, selectedRole.id);
          setSelectedRoleId(null);
          onChanged();
        } catch (err: any) {
          Toast.error({ content: err.message, duration: 2 });
        }
      },
    });
  }, [serverId, selectedRole, onChanged]);

  const handleTogglePermission = useCallback((flag: number) => {
    setEditPermissions((prev) => {
      const next = prev ^ flag;
      setDirty(true);
      return next;
    });
  }, []);

  // Role member assignment handlers
  const roleMembers = selectedRole
    ? members.filter((m) => m.role_ids.includes(selectedRole.id))
    : [];
  const availableMembers = selectedRole
    ? members.filter((m) => !m.role_ids.includes(selectedRole.id))
    : [];

  const handleAssignMember = useCallback(async (memberId: string) => {
    if (!selectedRole) return;
    try {
      await api.assignRole(serverId, selectedRole.id, memberId);
      onChanged();
    } catch (err: any) {
      Toast.error({ content: err.message, duration: 2 });
    }
  }, [serverId, selectedRole, onChanged]);

  const handleRemoveMember = useCallback(async (memberId: string) => {
    if (!selectedRole) return;
    try {
      await api.removeRole(serverId, selectedRole.id, memberId);
      onChanged();
    } catch (err: any) {
      Toast.error({ content: err.message, duration: 2 });
    }
  }, [serverId, selectedRole, onChanged]);

  return (
    <div className="roles-editor">
      {/* Left: role list */}
      <div className="roles-editor__list">
        <div className="roles-editor__list-header">
          <span>Roles — {roles.length}</span>
          <PhIcon
            name="plus"
            style={{ cursor: "pointer", color: "var(--text-normal)" }}
            onClick={handleCreateRole}
          />
        </div>
        {roles.map((role) => (
          <div
            key={role.id}
            className={`roles-editor__role-item ${selectedRoleId === role.id ? "roles-editor__role-item--active" : ""}`}
            onClick={() => setSelectedRoleId(role.id)}
          >
            <span
              className="roles-editor__role-dot"
              style={{ backgroundColor: role.color || "#99aab5" }}
            />
            <span className="roles-editor__role-name">{role.name}</span>
          </div>
        ))}
      </div>

      {/* Right: role editor */}
      <div className="roles-editor__detail">
        {selectedRole ? (
          <>
            <div className="roles-editor__detail-header">
              <span style={{ fontWeight: 600, fontSize: 16, color: "var(--header-primary)" }}>
                Edit Role — {selectedRole.name.toUpperCase()}
              </span>
              {!selectedRole.is_default && (
                <PhIcon
                  name="trash"
                  style={{ cursor: "pointer", color: "var(--status-danger)" }}
                  onClick={handleDeleteRole}
                />
              )}
            </div>

            {/* Tabs */}
            <div className="roles-editor__tabs">
              {(["display", "permissions", "members"] as const).map((tab) => (
                <div
                  key={tab}
                  className={`roles-editor__tab ${activeTab === tab ? "roles-editor__tab--active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </div>
              ))}
            </div>

            {/* Display tab */}
            {activeTab === "display" && (
              <div className="roles-editor__pane">
                <div className="roles-editor__field">
                  <label className="roles-editor__label">Role Name</label>
                  <Input
                    value={editName}
                    onChange={(v) => { setEditName(v); setDirty(true); }}
                    disabled={selectedRole.is_default}
                  />
                </div>
                <div className="roles-editor__field">
                  <label className="roles-editor__label">Role Color</label>
                  <div className="roles-editor__color-grid">
                    {COLOR_PRESETS.map((c) => (
                      <div
                        key={c}
                        className={`roles-editor__color-swatch ${editColor === c ? "roles-editor__color-swatch--active" : ""}`}
                        style={{ backgroundColor: c }}
                        onClick={() => { setEditColor(c); setDirty(true); }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Permissions tab */}
            {activeTab === "permissions" && (
              <div className="roles-editor__pane">
                {PERMISSION_DEFS.map((perm) => (
                  <div key={perm.flag} className="roles-editor__perm-row">
                    <div>
                      <div className="roles-editor__perm-name">{perm.name}</div>
                      <div className="roles-editor__perm-desc">{perm.desc}</div>
                    </div>
                    <Switch
                      checked={!!(editPermissions & perm.flag)}
                      onChange={() => handleTogglePermission(perm.flag)}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Members tab */}
            {activeTab === "members" && (
              <div className="roles-editor__pane">
                {!selectedRole.is_default && (
                  <>
                    <div className="roles-editor__label" style={{ marginBottom: 8 }}>
                      Members with this role ({roleMembers.length})
                    </div>
                    {roleMembers.length === 0 && (
                      <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
                        No members have this role yet.
                      </div>
                    )}
                    {roleMembers.map((m) => (
                      <div key={m.id} className="roles-editor__member-row">
                        <Avatar size="small" style={{ backgroundColor: "var(--semi-color-primary-light-default)", color: "var(--header-primary)" }}>
                          {(m.display_name || m.username)[0]?.toUpperCase()}
                        </Avatar>
                        <span className="roles-editor__member-name">
                          {m.display_name || m.username}
                        </span>
                        <Button
                          size="small"
                          type="danger"
                          theme="borderless"
                          onClick={() => handleRemoveMember(m.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}

                    <div className="roles-editor__label" style={{ marginTop: 20, marginBottom: 8 }}>
                      Add Members
                    </div>
                    {availableMembers.map((m) => (
                      <div key={m.id} className="roles-editor__member-row">
                        <Avatar size="small" style={{ backgroundColor: "var(--semi-color-primary-light-default)", color: "var(--header-primary)" }}>
                          {(m.display_name || m.username)[0]?.toUpperCase()}
                        </Avatar>
                        <span className="roles-editor__member-name">
                          {m.display_name || m.username}
                        </span>
                        <Button
                          size="small"
                          theme="borderless"
                          style={{ color: "var(--brand-experiment)" }}
                          onClick={() => handleAssignMember(m.id)}
                        >
                          Add
                        </Button>
                      </div>
                    ))}
                  </>
                )}
                {selectedRole.is_default && (
                  <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                    The @everyone role applies to all server members automatically.
                  </div>
                )}
              </div>
            )}

            {/* Save bar */}
            {dirty && (
              <div className="save-bar">
                <span style={{ color: "var(--header-primary)", fontSize: 14 }}>
                  Careful — you have unsaved changes!
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button theme="borderless" style={{ color: "var(--text-normal)" }} onClick={handleReset}>
                    Reset
                  </Button>
                  <Button
                    style={{ background: "var(--brand-experiment)", borderColor: "var(--brand-experiment)", color: "#fff" }}
                    onClick={handleSave}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ color: "var(--text-muted)", padding: 40, textAlign: "center" }}>
            Select a role to edit, or create a new one.
          </div>
        )}
      </div>
    </div>
  );
};

// ── Members Pane ──

const MembersPane: React.FC<{
  serverId: string;
  members: MemberWithRoles[];
  roles: RoleRead[];
}> = ({ members, roles }) => {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? members.filter(
        (m) =>
          m.username.toLowerCase().includes(search.toLowerCase()) ||
          (m.display_name || "").toLowerCase().includes(search.toLowerCase()),
      )
    : members;

  const roleMap = Object.fromEntries(roles.map((r) => [r.id, r]));

  return (
    <div>
      <Input
        prefix={<PhIcon name="magnifying-glass" size={14} />}
        placeholder="Search members"
        value={search}
        onChange={setSearch}
        style={{ marginBottom: 16 }}
      />
      <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>
        {filtered.length} Member{filtered.length !== 1 ? "s" : ""}
      </div>
      {filtered.map((m) => (
        <div key={m.id} className="roles-editor__member-row">
          <Avatar
            size="small"
            style={{ backgroundColor: "var(--semi-color-primary-light-default)", color: "var(--header-primary)" }}
          >
            {(m.display_name || m.username)[0]?.toUpperCase()}
          </Avatar>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-normal)" }}>
              {m.display_name || m.username}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {m.role_ids
                ?.map((rid: string) => roleMap[rid]?.name)
                .filter(Boolean)
                .join(", ") || "No roles"}
            </div>
          </div>
        </div>
      ))}
      {filtered.length === 0 && (
        <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-muted)" }}>
          No members found
        </div>
      )}
    </div>
  );
};

const InvitesPane: React.FC<{ serverId: string }> = ({ serverId }) => {
  const [invites, setInvites] = useState<api.ServerInviteRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresHours, setExpiresHours] = useState("");

  const loadInvites = useCallback(async () => {
    setLoading(true);
    try {
      setInvites(await api.listServerInvites(serverId));
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to load invites", duration: 2 });
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const created = await api.createServerInvite(serverId, {
        label: label.trim() || null,
        notes: notes.trim() || null,
        max_uses: maxUses.trim() ? Number(maxUses) : null,
        expires_in_hours: expiresHours.trim() ? Number(expiresHours) : null,
      });
      setInvites((prev) => [created, ...prev]);
      setLabel("");
      setNotes("");
      setMaxUses("");
      setExpiresHours("");
      Toast.success({ content: "Invite created", duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to create invite", duration: 2 });
    } finally {
      setCreating(false);
    }
  }, [expiresHours, label, maxUses, notes, serverId]);

  const handleCopy = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      Toast.success({ content: "Invite link copied", duration: 1.5 });
    } catch {
      Toast.warning({ content: url, duration: 3 });
    }
  }, []);

  const handleRevoke = useCallback(async (inviteId: string) => {
    try {
      await api.revokeServerInvite(serverId, inviteId);
      setInvites((prev) => prev.map((invite) => invite.id === inviteId ? { ...invite, revoked_at: new Date().toISOString() } : invite));
      Toast.success({ content: "Invite revoked", duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to revoke invite", duration: 2 });
    }
  }, [serverId]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="settings-card" style={{ padding: 24, display: "grid", gap: 10 }}>
        <h3 style={{ color: "var(--header-primary)", marginBottom: 4 }}>Create Invite</h3>
        <Input value={label} onChange={setLabel} placeholder="Label (optional)" />
        <Input value={notes} onChange={setNotes} placeholder="Notes (optional)" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Input value={maxUses} onChange={setMaxUses} placeholder="Max uses" />
          <Input value={expiresHours} onChange={setExpiresHours} placeholder="Expires in hours" />
        </div>
        <Button
          theme="solid"
          loading={creating}
          style={{ background: "var(--brand-experiment)", borderColor: "var(--brand-experiment)", color: "#fff" }}
          onClick={() => { void handleCreate(); }}
        >
          Create Invite
        </Button>
      </div>

      <div className="settings-card" style={{ padding: 24 }}>
        <h3 style={{ color: "var(--header-primary)", marginBottom: 8 }}>Invite Links</h3>
        {loading ? (
          <p style={{ color: "var(--text-muted)" }}>Loading invites...</p>
        ) : invites.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No invites yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {invites.map((invite) => {
              const expired = Boolean(invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now());
              const exhausted = invite.max_uses != null && invite.use_count >= invite.max_uses;
              const inactive = Boolean(invite.revoked_at || expired || exhausted);
              return (
                <div
                  key={invite.id}
                  style={{
                    border: "1px solid var(--background-modifier-accent)",
                    borderRadius: 12,
                    padding: 14,
                    display: "grid",
                    gap: 6,
                    opacity: inactive ? 0.68 : 1,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div style={{ color: "var(--header-primary)", fontWeight: 600 }}>{invite.label || invite.server_name}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button size="small" theme="light" onClick={() => { void handleCopy(invite.invite_url); }}>
                        Copy
                      </Button>
                      {!invite.revoked_at ? (
                        <Button size="small" theme="borderless" type="danger" onClick={() => { void handleRevoke(invite.id); }}>
                          Revoke
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{invite.invite_url}</div>
                  {invite.notes ? <div style={{ color: "var(--text-normal)", fontSize: 13 }}>{invite.notes}</div> : null}
                  <div style={{ color: "var(--interactive-muted)", fontSize: 12 }}>
                    Uses {invite.use_count}{invite.max_uses != null ? ` / ${invite.max_uses}` : ""} · Created {new Date(invite.created_at).toLocaleString()}
                  </div>
                  {invite.expires_at ? (
                    <div style={{ color: "var(--interactive-muted)", fontSize: 12 }}>
                      Expires {new Date(invite.expires_at).toLocaleString()}
                    </div>
                  ) : null}
                  {inactive ? (
                    <div style={{ color: "var(--status-warning)", fontSize: 12 }}>
                      {invite.revoked_at ? "Invite revoked" : expired ? "Invite expired" : "Invite maxed out"}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Bans Pane ──

const BansPane: React.FC<{ serverId: string; members: MemberWithRoles[] }> = ({ serverId, members }) => {
  const [bans, setBans] = useState<api.ServerBanRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [banUserId, setBanUserId] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banning, setBanning] = useState(false);
  const [search, setSearch] = useState("");

  const loadBans = useCallback(async () => {
    setLoading(true);
    try {
      setBans(await api.listServerBans(serverId));
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to load bans", duration: 2 });
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    void loadBans();
  }, [loadBans]);

  const handleBan = useCallback(async () => {
    if (!banUserId) return;
    setBanning(true);
    try {
      const ban = await api.banServerMember(serverId, banUserId, banReason.trim() || undefined);
      setBans((prev) => [ban, ...prev]);
      setBanUserId("");
      setBanReason("");
      Toast.success({ content: "User banned", duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to ban user", duration: 2 });
    } finally {
      setBanning(false);
    }
  }, [banUserId, banReason, serverId]);

  const handleUnban = useCallback(async (ban: api.ServerBanRead) => {
    Modal.confirm({
      title: `Unban ${ban.display_name || ban.username || "this user"}?`,
      content: "This user will be able to rejoin the server via invite links.",
      okText: "Unban",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await api.unbanServerMember(serverId, ban.id);
          setBans((prev) => prev.filter((b) => b.id !== ban.id));
          Toast.success({ content: "User unbanned", duration: 1.5 });
        } catch (err: any) {
          Toast.error({ content: err.message || "Failed to unban", duration: 2 });
        }
      },
    });
  }, [serverId]);

  // Members not already banned, for the ban dropdown
  const bannedUserIds = new Set(bans.map((b) => b.user_id));
  const bannableMembers = members.filter((m) => !bannedUserIds.has(m.user_id));

  const filtered = search.trim()
    ? bans.filter(
        (b) =>
          (b.username || "").toLowerCase().includes(search.toLowerCase()) ||
          (b.display_name || "").toLowerCase().includes(search.toLowerCase()) ||
          (b.reason || "").toLowerCase().includes(search.toLowerCase()),
      )
    : bans;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="settings-card" style={{ padding: 24, display: "grid", gap: 10 }}>
        <h3 style={{ color: "var(--header-primary)", marginBottom: 4 }}>Ban a Member</h3>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
          Banned users are removed from the server and cannot rejoin until unbanned.
        </div>
        <select
          value={banUserId}
          onChange={(e) => setBanUserId(e.target.value)}
          style={{
            background: "var(--background-secondary)",
            color: "var(--text-normal)",
            border: "1px solid var(--background-modifier-accent)",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 14,
          }}
        >
          <option value="">Select a member to ban…</option>
          {bannableMembers.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.display_name || m.username}
            </option>
          ))}
        </select>
        <Input
          value={banReason}
          onChange={setBanReason}
          placeholder="Reason (optional)"
        />
        <Button
          theme="solid"
          type="danger"
          loading={banning}
          disabled={!banUserId}
          onClick={() => { void handleBan(); }}
        >
          Ban Member
        </Button>
      </div>

      <div className="settings-card" style={{ padding: 24 }}>
        <h3 style={{ color: "var(--header-primary)", marginBottom: 8 }}>
          Banned Users ({bans.length})
        </h3>
        {bans.length > 3 && (
          <Input
            prefix={<PhIcon name="magnifying-glass" size={14} />}
            placeholder="Search bans"
            value={search}
            onChange={setSearch}
            style={{ marginBottom: 12 }}
          />
        )}
        {loading ? (
          <p style={{ color: "var(--text-muted)" }}>Loading bans…</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>
            {bans.length === 0 ? "No banned users." : "No bans match your search."}
          </p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {filtered.map((ban) => (
              <div
                key={ban.id}
                style={{
                  border: "1px solid var(--background-modifier-accent)",
                  borderRadius: 12,
                  padding: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Avatar
                  size="small"
                  src={ban.avatar_url || undefined}
                  style={{
                    backgroundColor: "var(--semi-color-primary-light-default)",
                    color: "var(--header-primary)",
                    flexShrink: 0,
                  }}
                >
                  {(ban.display_name || ban.username || "?")[0]?.toUpperCase()}
                </Avatar>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-normal)" }}>
                    {ban.display_name || ban.username || ban.user_id}
                  </div>
                  {ban.reason && (
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                      Reason: {ban.reason}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: "var(--interactive-muted)", marginTop: 2 }}>
                    Banned {new Date(ban.created_at).toLocaleDateString()}
                    {ban.banned_by_name ? ` by ${ban.banned_by_name}` : ""}
                  </div>
                </div>
                <Button
                  size="small"
                  theme="borderless"
                  style={{ color: "var(--brand-experiment)" }}
                  onClick={() => { void handleUnban(ban); }}
                >
                  Unban
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Audit Log Pane ──

const ACTION_ICONS: Record<number, string> = {
  1: "prohibit",       // MEMBER_BAN
  2: "check-circle",   // MEMBER_UNBAN
  3: "user-minus",     // MEMBER_KICK
  4: "shield-plus",    // ROLE_CREATE
  5: "shield",         // ROLE_UPDATE
  6: "shield-slash",   // ROLE_DELETE
  7: "hash",           // CHANNEL_CREATE
  8: "pencil-simple",  // CHANNEL_UPDATE
  9: "trash",          // CHANNEL_DELETE
  10: "gear",          // SERVER_UPDATE
  11: "link",          // INVITE_CREATE
  12: "link-break",    // INVITE_REVOKE
  13: "push-pin",      // MESSAGE_PIN
  14: "trash",         // MESSAGE_DELETE
};

const AuditLogPane: React.FC<{ serverId: string }> = ({ serverId }) => {
  const [entries, setEntries] = useState<api.AuditLogEntryRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("");

  const loadLog = useCallback(async () => {
    setLoading(true);
    try {
      const actionType = filterType ? Number(filterType) : undefined;
      setEntries(await api.listAuditLog(serverId, actionType));
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to load audit log", duration: 2 });
    } finally {
      setLoading(false);
    }
  }, [serverId, filterType]);

  useEffect(() => {
    void loadLog();
  }, [loadLog]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            background: "var(--background-secondary)",
            color: "var(--text-normal)",
            border: "1px solid var(--background-modifier-accent)",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 13,
          }}
        >
          <option value="">All actions</option>
          <option value="1">Member Ban</option>
          <option value="2">Member Unban</option>
          <option value="3">Member Kick</option>
          <option value="4">Role Create</option>
          <option value="5">Role Update</option>
          <option value="6">Role Delete</option>
          <option value="7">Channel Create</option>
          <option value="8">Channel Update</option>
          <option value="9">Channel Delete</option>
          <option value="10">Server Update</option>
          <option value="11">Invite Create</option>
          <option value="12">Invite Revoke</option>
          <option value="13">Message Pin</option>
          <option value="14">Message Delete</option>
        </select>
        <Button size="small" theme="light" onClick={() => { void loadLog(); }}>
          <PhIcon name="arrows-clockwise" size={14} />
        </Button>
      </div>

      <div className="settings-card" style={{ padding: 24 }}>
        {loading ? (
          <p style={{ color: "var(--text-muted)" }}>Loading audit log…</p>
        ) : entries.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No audit log entries found.</p>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {entries.map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: "1px solid var(--background-modifier-accent)",
                }}
              >
                <PhIcon
                  name={ACTION_ICONS[entry.action_type] || "clipboard-text"}
                  size={18}
                  style={{ color: "var(--text-muted)", marginTop: 2, flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: "var(--text-normal)" }}>
                    <strong>{entry.user_name || "Unknown"}</strong>
                    {" "}
                    <span style={{ color: "var(--text-muted)" }}>{entry.action_label}</span>
                    {entry.target_id && (
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                        {" "}target: {entry.target_id.slice(0, 8)}…
                      </span>
                    )}
                  </div>
                  {entry.reason && (
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                      Reason: {entry.reason}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: "var(--interactive-muted)", marginTop: 2 }}>
                    {new Date(entry.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Placeholder Pane (for tabs not yet fully wired) ──

const PlaceholderPane: React.FC<{
  title: string;
  description: string;
  icon: string;
}> = ({ title, description, icon }) => (
  <div style={{ textAlign: "center", padding: "48px 24px" }}>
    <PhIcon name={icon} size={48} />
    <h3 style={{ marginTop: 16, color: "var(--text-normal)", fontSize: 18, fontWeight: 600 }}>
      {title}
    </h3>
    <p style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 420, margin: "8px auto 0" }}>
      {description}
    </p>
  </div>
);
