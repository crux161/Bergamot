import React, { useEffect, useState } from "react";
import { Typography } from "@douyinfe/semi-ui";
import * as api from "../services/api";
import { routerStore } from "../stores/routerStore";

const { Title, Text } = Typography;

export const AuthorizeIpPage: React.FC<{ token: string }> = ({ token }) => {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Checking your sign-in request...");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing authorize-IP token.");
      return;
    }

    api.authorizeIp(token)
      .then((payload) => {
        setStatus("success");
        setMessage(
          payload.ip_address
            ? `This device at ${payload.ip_address} is now trusted. You can return to login.`
            : "This device is now trusted. You can return to login.",
        );
      })
      .catch((err: any) => {
        setStatus("error");
        setMessage(err.message || "That sign-in approval link is invalid or expired.");
      });
  }, [token]);

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-card__header">
          <Title heading={3} className="login-card__title">Bergamot</Title>
          <Text className="login-card__subtitle">
            {status === "loading" ? "Authorizing sign-in..." : status === "success" ? "Sign-in approved" : "Approval failed"}
          </Text>
        </div>
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <Text style={{ display: "block", marginTop: 12 }}>{message}</Text>
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
