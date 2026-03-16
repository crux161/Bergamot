import React, { useState } from "react";
import { Button, Input, Form, Toast, Typography } from "@douyinfe/semi-ui";
import { PhIcon } from "./PhIcon";
import * as api from "../services/api";
import { getConfiguredServerUrl, setServerUrl } from "../services/api";

const { Title, Text } = Typography;

interface Props {
  onLoggedIn: (user: api.UserRead) => void;
}

export const LoginScreen: React.FC<Props> = ({ onLoggedIn }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (values: Record<string, string>) => {
    setLoading(true);
    try {
      await api.login(values.username, values.password);
      const user = await api.getMe();
      onLoggedIn(user);
    } catch (err: any) {
      Toast.error(err.message || "Login failed");
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
      const user = await api.getMe();
      onLoggedIn(user);
    } catch (err: any) {
      Toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
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

          <Button
            htmlType="submit"
            theme="solid"
            block
            loading={loading}
            className="login-card__submit"
          >
            {isRegister ? "Register" : "Log In"}
          </Button>
        </Form>

        <div className="login-card__toggle">
          <Text
            className="login-card__toggle-text"
            onClick={() => setIsRegister(!isRegister)}
          >
            {isRegister
              ? "Already have an account? Log in"
              : "Need an account? Register"}
          </Text>
        </div>

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
