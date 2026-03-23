import React, { useEffect, useState } from "react";
import { Button, Toast, Typography } from "@douyinfe/semi-ui";
import * as api from "../services/api";
import { routerStore } from "../stores/routerStore";

const { Title, Text } = Typography;

export const PendingAccountPage: React.FC<{ email?: string | null }> = ({ email: routeEmail }) => {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    api.getPendingAccountStatus()
      .then((status) => {
        setEmail(status.email);
        setVerified(status.email_verified);
      })
      .catch(() => {
        setEmail(routeEmail || null);
      })
      .finally(() => setLoading(false));
  }, [routeEmail]);

  const handleResend = async () => {
    setResending(true);
    try {
      if (email) {
        await api.resendVerificationByEmail(email);
      } else {
        await api.resendVerification();
      }
      Toast.success({ content: "Verification email sent", duration: 1.5 });
    } catch (err: any) {
      Toast.error(err.message || "Failed to resend verification email");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-card__header">
          <Title heading={3} className="login-card__title">Bergamot</Title>
          <Text className="login-card__subtitle">
            {verified ? "Account ready" : "Pending account"}
          </Text>
        </div>

        <div style={{ textAlign: "center", padding: "16px 0", display: "grid", gap: 12 }}>
          <Text>
            {loading
              ? "Checking your account status..."
              : verified
                ? "Your email address is already verified. You can continue to sign in."
                : `We need you to verify${email ? ` ${email}` : " your email address"} before this Bergamot instance will allow sign-in.`}
          </Text>
          {!loading && !verified ? (
            <Button theme="solid" loading={resending} className="login-card__submit" onClick={handleResend}>
              Resend verification email
            </Button>
          ) : null}
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
