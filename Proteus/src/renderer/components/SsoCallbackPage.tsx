import React, { useEffect, useState } from "react";
import { Typography } from "@douyinfe/semi-ui";
import * as api from "../services/api";
import { routerStore } from "../stores/routerStore";

const { Title, Text } = Typography;

interface Props {
  provider: string;
  code: string;
  state?: string | null;
  onLoggedIn: (user: api.UserRead) => void;
}

export const SsoCallbackPage: React.FC<Props> = ({ provider, code, state, onLoggedIn }) => {
  const [message, setMessage] = useState("Completing sign-in...");

  useEffect(() => {
    if (!provider || !code) {
      setMessage("Missing provider or callback code.");
      return;
    }
    api.finishSsoCallback(provider, code, state)
      .then(() => api.getMe())
      .then((user) => {
        setMessage("Signed in successfully. Redirecting...");
        onLoggedIn(user);
      })
      .catch((err: any) => {
        setMessage(err.message || "The SSO callback could not be completed.");
      });
  }, [code, onLoggedIn, provider, state]);

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-card__header">
          <Title heading={3} className="login-card__title">Bergamot</Title>
          <Text className="login-card__subtitle">Single Sign-On</Text>
        </div>
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <Text>{message}</Text>
        </div>
        <div className="login-card__toggle">
          <Text className="login-card__toggle-text" onClick={() => routerStore.openLogin()}>
            Back to login
          </Text>
        </div>
      </div>
    </div>
  );
};
