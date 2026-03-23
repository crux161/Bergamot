import React, { useState } from "react";
import { Button, Input, Form, Toast, Typography } from "@douyinfe/semi-ui";
import { PhIcon } from "./PhIcon";
import * as api from "../services/api";
import { getConfiguredServerUrl, setServerUrl } from "../services/api";
import { getPasskeyAssertion, isPasskeySupported } from "../services/passkeys";
import { routerStore } from "../stores/routerStore";

const { Title, Text } = Typography;

interface Props {
  onLoggedIn: (user: api.UserRead) => void;
}

export const LoginScreen: React.FC<Props> = ({ onLoggedIn }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<api.StoredAccount[]>(() => api.listSavedAccounts());
  const formApiRef = React.useRef<any>(null);

  const handleLogin = async (values: Record<string, string>) => {
    setLoading(true);
    try {
      await api.login(values.username, values.password, values.otp_code);
      const user = await api.getMe();
      setMfaRequired(false);
      onLoggedIn(user);
    } catch (err: any) {
      if (err?.mfaRequired) {
        setMfaRequired(true);
        Toast.warning({ content: "Enter the 6-digit code from your authenticator app to finish signing in.", duration: 2 });
      } else if (err?.code === "invalid_mfa_code") {
        setMfaRequired(true);
        Toast.error(err.message || "Invalid authenticator code");
      } else if (err?.code === "pending_account") {
        routerStore.openPendingAccount(err.pendingEmail);
      } else if (err?.code === "authorize_ip_required") {
        Toast.info({ content: "Check your email for a sign-in approval link, then return here.", duration: 3 });
      } else {
        Toast.error(err.message || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: Record<string, string>) => {
    setLoading(true);
    try {
      await api.register({
        username: values.username,
        email: values.email,
        password: values.password,
      });
      await api.login(values.username, values.password);
      setMfaRequired(false);
      const user = await api.getMe();
      onLoggedIn(user);
    } catch (err: any) {
      Toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    if (!isPasskeySupported()) {
      Toast.warning({ content: "Passkeys are only available in a secure browser context.", duration: 2 });
      return;
    }
    setLoading(true);
    try {
      const values = formApiRef.current?.getValues?.() || {};
      const options = await api.beginPasskeyAuthentication(values.username);
      const credential = await getPasskeyAssertion(options.public_key);
      await api.finishPasskeyAuthentication(options.challenge_id, credential);
      const user = await api.getMe();
      setMfaRequired(false);
      onLoggedIn(user);
    } catch (err: any) {
      Toast.error(err.message || "Passkey sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSavedAccountSignIn = (accountKey: string) => {
    try {
      api.switchToSavedAccount(accountKey);
      window.location.reload();
    } catch (err: any) {
      Toast.error(err.message || "Failed to switch accounts");
      setSavedAccounts(api.listSavedAccounts());
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-card__header">
          <Title heading={3} className="login-card__title">
            Bergamot
          </Title>
          <Text className="login-card__subtitle">
            {isRegister ? "Create your account" : "Welcome back"}
          </Text>
        </div>

        <Form
          getFormApi={(formApi) => { formApiRef.current = formApi; }}
          onSubmit={isRegister ? handleRegister : handleLogin}
          style={{ width: "100%" }}
        >
          <Form.Input
            field="username"
            label="Username"
            prefix={<PhIcon name="user" />}
            rules={[{ required: true, message: "Required" }]}
            className="login-card__input"
          />

          {isRegister && (
            <Form.Input
              field="email"
              label="Email"
              prefix={<PhIcon name="envelope" />}
              rules={[
                { required: true, message: "Required" },
                { type: "email", message: "Invalid email" },
              ]}
              className="login-card__input"
            />
          )}

          <Form.Input
            field="password"
            label="Password"
            mode="password"
            prefix={<PhIcon name="lock" />}
            rules={[
              { required: true, message: "Required" },
              { min: 8, message: "Min 8 characters" },
            ]}
            className="login-card__input"
          />

          {!isRegister && mfaRequired && (
            <Form.Input
              field="otp_code"
              label="Authenticator Code"
              prefix={<PhIcon name="shield-check" />}
              rules={[
                { required: true, message: "Required" },
                { len: 6, message: "Enter the 6-digit code" },
              ]}
              className="login-card__input"
            />
          )}

          <Button
            htmlType="submit"
            theme="solid"
            block
            loading={loading}
            className="login-card__submit"
          >
            {isRegister ? "Register" : "Log In"}
          </Button>

          {!isRegister && (
            <Button
              theme="light"
              block
              disabled={loading || !isPasskeySupported()}
              style={{ marginTop: 10 }}
              onClick={handlePasskeyLogin}
            >
              Sign In with Passkey
            </Button>
          )}
        </Form>

        <div className="login-card__toggle">
          <Text
            className="login-card__toggle-text"
            onClick={() => { setIsRegister(!isRegister); setMfaRequired(false); }}
          >
            {isRegister
              ? "Already have an account? Log in"
              : "Need an account? Register"}
          </Text>
          {!isRegister && (
            <Text
              className="login-card__toggle-text"
              onClick={() => routerStore.openForgotPassword()}
              style={{ marginTop: 8 }}
            >
              Forgot your password?
            </Text>
          )}
        </div>

        {!isRegister && savedAccounts.length > 0 && (
          <div
            style={{
              width: "100%",
              marginTop: 18,
              paddingTop: 18,
              borderTop: "1px solid rgba(255,255,255,0.08)",
              display: "grid",
              gap: 10,
            }}
          >
            <Text strong style={{ color: "var(--text-normal)" }}>Saved Accounts</Text>
            {savedAccounts.map((account) => (
              (() => {
                const avatarUrl = account.avatar_url
                  ? (account.avatar_url.startsWith("/") ? `${account.server_url}${account.avatar_url}` : account.avatar_url)
                  : null;
                return (
                  <button
                    key={account.key}
                    type="button"
                    onClick={() => handleSavedAccountSignIn(account.key)}
                    style={{
                      width: "100%",
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 12,
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      color: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt=""
                          style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: "50%",
                            display: "grid",
                            placeItems: "center",
                            background: "rgba(107, 147, 98, 0.25)",
                            color: "#fff",
                            fontWeight: 700,
                          }}
                        >
                          {(account.display_name || account.username || "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div style={{ minWidth: 0, textAlign: "left" }}>
                        <div style={{ color: "var(--text-normal)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {account.display_name || account.username}
                        </div>
                        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                          @{account.username} · {account.server_url.replace(/^https?:\/\//, "")}
                        </div>
                      </div>
                    </div>
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Switch</span>
                  </button>
                );
              })()
            ))}
          </div>
        )}

        <ServerUrlConfig />
      </div>
    </div>
  );
};

/** Collapsible server URL config for dev/advanced use. */
const ServerUrlConfig: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(getConfiguredServerUrl());
  const current = getConfiguredServerUrl();
  const isDirty = url.replace(/\/+$/, "").trim() !== current;

  const handleSave = () => {
    const cleaned = url.replace(/\/+$/, "").trim();
    if (!cleaned) return;
    try {
      new URL(cleaned);
    } catch {
      Toast.error({ content: "Invalid URL", duration: 2 });
      return;
    }
    Toast.info({ content: "Reconnecting…", duration: 1.5 });
    setTimeout(() => setServerUrl(cleaned), 200);
  };

  if (!open) {
    return (
      <div className="login-card__server-hint" onClick={() => setOpen(true)}>
        <Text className="login-card__server-hint-text">
          <PhIcon name="gear" size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
          Server: {current}
        </Text>
      </div>
    );
  }

  return (
    <div className="login-card__server-config">
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Input
          size="small"
          value={url}
          onChange={setUrl}
          placeholder="http://localhost:8000"
          className="login-card__server-input"
          onKeyDown={(e) => e.key === "Enter" && isDirty && handleSave()}
        />
        <Button
          size="small"
          disabled={!isDirty}
          className={`login-card__server-save ${isDirty ? "login-card__server-save--dirty" : ""}`}
          onClick={handleSave}
        >
          Save
        </Button>
      </div>
      <div
        className="login-card__server-close"
        onClick={() => { setOpen(false); setUrl(current); }}
      >
        <Text className="login-card__server-hint-text">Close</Text>
      </div>
    </div>
  );
};
