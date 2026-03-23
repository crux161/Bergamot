import React, { useEffect, useState } from "react";
import { Button, Toast, Typography } from "@douyinfe/semi-ui";
import * as api from "../services/api";
import { routerStore } from "../stores/routerStore";

const { Title, Text } = Typography;

export const InviteAuthPage: React.FC<{ token: string | null }> = ({ token }) => {
  const [preview, setPreview] = useState<api.ServerInvitePreviewRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const signedIn = Boolean(api.getToken());

  useEffect(() => {
    setLoading(true);
    if (!token) {
      setPreview(null);
      setLoading(false);
      return;
    }
    api.previewServerInvite(token)
      .then(setPreview)
      .catch(() => setPreview(null))
      .finally(() => setLoading(false));
  }, [token]);

  const title = preview?.server_name ? `Join ${preview.server_name}` : "Server Invite";
  const subtitle = preview?.valid
    ? `${preview.inviter_display_name || preview.inviter_username || "Someone"} invited you to join ${preview.server_name}.`
    : "This invite is missing, expired, or no longer usable.";

  const handleAccept = async () => {
    if (!token) return;
    setJoining(true);
    try {
      const result = await api.acceptServerInvite(token);
      Toast.success({ content: result.already_member ? "You are already in this server" : "Joined server", duration: 1.5 });
      routerStore.openGuild(result.server_id);
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to accept invite", duration: 2 });
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-card__header">
          <Title heading={3} className="login-card__title">{title}</Title>
          <Text className="login-card__subtitle">{subtitle}</Text>
        </div>
        <div style={{ textAlign: "center", padding: "16px 0", display: "grid", gap: 12 }}>
          {loading ? (
            <Text>Loading invite details...</Text>
          ) : (
            <>
              <Text>
                {preview?.server_name
                  ? `${preview.member_count} member${preview.member_count === 1 ? "" : "s"} · invite code ${preview.code}`
                  : token ? `Invite token: ${token}` : "This invite link does not include a token yet."}
              </Text>
              {preview?.notes ? <Text>{preview.notes}</Text> : null}
            </>
          )}
          <Button
            theme="solid"
            className="login-card__submit"
            loading={joining}
            disabled={Boolean(preview && !preview.valid)}
            onClick={() => (signedIn ? void handleAccept() : routerStore.beginLoginFlow({ kind: "inviteAuth", token }))}
          >
            {signedIn ? "Accept Invite" : "Continue to login"}
          </Button>
        </div>
      </div>
    </div>
  );
};
