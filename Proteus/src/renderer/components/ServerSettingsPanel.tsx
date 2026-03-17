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

  const navItems = [
    { key: "overview", label: "Overview" },
    ...(hasPermission(myPermissions, Permissions.MANAGE_ROLES)
      ? [{ key: "roles", label: "Roles" }]
      : []),
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
            {item.label}
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
                    style={{ backgroundColor: "var(--input-background)", borderColor: "var(--background-modifier-accent)", color: "var(--header-primary)" }}
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
