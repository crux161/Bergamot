import React, { useState, useEffect } from "react";
import { Typography } from "@douyinfe/semi-ui";
import { PhIcon } from "./PhIcon";
import * as api from "../services/api";
import { routerStore } from "../stores/routerStore";

const { Title, Text } = Typography;

interface Props {
  token: string;
}

export const VerifyEmailPage: React.FC<Props> = ({ token }) => {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Missing verification token.");
      return;
    }
    api
      .verifyEmail(token)
      .then(() => setStatus("success"))
      .catch((err: any) => {
        setStatus("error");
        setErrorMessage(err.message || "Verification failed — the link may have expired.");
      });
  }, [token]);

  const icon =
    status === "loading"
      ? "circle-notch"
      : status === "success"
        ? "check-circle"
        : "x-circle";

  const heading =
    status === "loading"
      ? "Verifying..."
      : status === "success"
        ? "Email verified"
        : "Verification failed";

  const body =
    status === "loading"
      ? "Checking your verification link..."
      : status === "success"
        ? "Your email address has been confirmed. You can now log in."
        : errorMessage;

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-card__header">
          <Title heading={3} className="login-card__title">Bergamot</Title>
          <Text className="login-card__subtitle">{heading}</Text>
        </div>

        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <PhIcon
            name={icon}
            size={48}
            weight="fill"
          />
          <Text style={{ display: "block", marginTop: 12 }}>{body}</Text>
        </div>

        <div className="login-card__toggle">
          <Text
            className="login-card__toggle-text"
            onClick={() => routerStore.openLogin()}
          >
            Go to login
          </Text>
        </div>
      </div>
    </div>
  );
};
