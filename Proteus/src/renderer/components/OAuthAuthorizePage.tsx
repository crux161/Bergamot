import React, { useEffect, useState } from "react";
import { Button, Typography } from "@douyinfe/semi-ui";
import * as api from "../services/api";
import { routerStore } from "../stores/routerStore";

const { Title, Text } = Typography;

interface Props {
  clientId: string;
  redirectUri: string;
  scope: string[];
  state?: string | null;
}

export const OAuthAuthorizePage: React.FC<Props> = ({ clientId, redirectUri, scope, state }) => {
  const [preview, setPreview] = useState<api.OAuthAuthorizePreviewRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signedIn = Boolean(api.getToken());

  useEffect(() => {
    if (!signedIn) {
      setLoading(false);
      setPreview(null);
      setError(null);
      return;
    }
    api.previewOAuthAuthorization(clientId, redirectUri, scope, state)
      .then((next) => setPreview(next))
      .catch((err: any) => setError(err.message || "Unable to preview authorization request"))
      .finally(() => setLoading(false));
  }, [clientId, redirectUri, scope, signedIn, state]);

  const handleApprove = async () => {
    setApproving(true);
    try {
      const result = await api.approveOAuthAuthorization({
        client_id: clientId,
        redirect_uri: redirectUri,
        scopes: scope,
        state,
        approve: true,
      });
      window.location.href = result.redirect_uri;
    } catch (err: any) {
      setError(err.message || "Authorization failed");
      setApproving(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-card__header">
          <Title heading={3} className="login-card__title">Authorize App</Title>
          <Text className="login-card__subtitle">Review the access this application is requesting.</Text>
        </div>

        {!signedIn ? (
          <div style={{ display: "grid", gap: 12 }}>
            <Text>
              Sign in to review and approve this application's requested access.
            </Text>
            <Button
              theme="solid"
              className="login-card__submit"
              onClick={() => routerStore.beginLoginFlow({ kind: "oauthAuthorize", clientId, redirectUri, scope, state })}
            >
              Continue to login
            </Button>
          </div>
        ) : loading ? (
          <Text>Loading authorization request...</Text>
        ) : error ? (
          <Text>{error}</Text>
        ) : preview ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <Text strong>{preview.application_name}</Text>
              {preview.description ? <Text style={{ display: "block", marginTop: 8 }}>{preview.description}</Text> : null}
            </div>
            <div>
              <Text strong>Redirect URI</Text>
              <Text style={{ display: "block", marginTop: 6 }}>{preview.redirect_uri}</Text>
            </div>
            <div>
              <Text strong>Requested scopes</Text>
              <Text style={{ display: "block", marginTop: 6 }}>
                {preview.requested_scopes.length > 0 ? preview.requested_scopes.join(", ") : "No additional scopes requested"}
              </Text>
            </div>
            <Button theme="solid" className="login-card__submit" loading={approving} onClick={handleApprove}>
              Authorize
            </Button>
          </div>
        ) : null}

        <div className="login-card__toggle">
          <Text
            className="login-card__toggle-text"
            onClick={() => (signedIn ? routerStore.openDmHome() : routerStore.beginLoginFlow({ kind: "oauthAuthorize", clientId, redirectUri, scope, state }))}
          >
            {signedIn ? "Back to Bergamot" : "Back to login"}
          </Text>
        </div>
      </div>
    </div>
  );
};
