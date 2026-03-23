import React, { useEffect, useState } from "react";
import { Button, Toast, Typography } from "@douyinfe/semi-ui";
import * as api from "../services/api";
import { routerStore } from "../stores/routerStore";

const { Title, Text } = Typography;

export const GiftAuthPage: React.FC<{ token: string | null }> = ({ token }) => {
  const [preview, setPreview] = useState<api.GiftCodePreviewRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const signedIn = Boolean(api.getToken());

  useEffect(() => {
    setLoading(true);
    if (!token) {
      setPreview(null);
      setLoading(false);
      return;
    }
    api.previewGift(token)
      .then(setPreview)
      .catch(() => setPreview(null))
      .finally(() => setLoading(false));
  }, [token]);

  const title = preview?.title || "Claim Gift";
  const subtitle = preview?.description || "Authenticate to attach this gift to your Bergamot account.";

  const handleClaim = async () => {
    if (!token) return;
    setClaiming(true);
    try {
      const result = await api.claimGift(token);
      Toast.success({ content: result.already_claimed ? "Gift already claimed on this account" : "Gift claimed", duration: 1.5 });
      if (result.theme) {
        routerStore.openThemeEntry(result.theme);
      } else {
        routerStore.openDmHome();
      }
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to claim gift", duration: 2 });
    } finally {
      setClaiming(false);
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
            <Text>Loading gift details...</Text>
          ) : (
            <>
              <Text>{token ? `Gift token: ${token}` : "This gift link does not include a token yet."}</Text>
              {preview?.claim_message ? <Text>{preview.claim_message}</Text> : null}
            </>
          )}
          <Button
            theme="solid"
            className="login-card__submit"
            loading={claiming}
            disabled={Boolean(preview && !preview.valid && !preview.claimed)}
            onClick={() => (signedIn ? void handleClaim() : routerStore.beginLoginFlow({ kind: "giftAuth", token }))}
          >
            {signedIn ? "Claim Gift" : "Continue to login"}
          </Button>
        </div>
      </div>
    </div>
  );
};
