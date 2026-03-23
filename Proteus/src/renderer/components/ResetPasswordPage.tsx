import React, { useState } from "react";
import { Button, Form, Toast, Typography } from "@douyinfe/semi-ui";
import { PhIcon } from "./PhIcon";
import * as api from "../services/api";
import { routerStore } from "../stores/routerStore";

const { Title, Text } = Typography;

interface Props {
  token: string;
}

export const ResetPasswordPage: React.FC<Props> = ({ token }) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-card__header">
            <Title heading={3} className="login-card__title">Bergamot</Title>
            <Text className="login-card__subtitle">Invalid reset link</Text>
          </div>
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <PhIcon name="x-circle" size={48} weight="fill" />
            <Text style={{ display: "block", marginTop: 12 }}>
              This reset link is missing a token. Please request a new one.
            </Text>
          </div>
          <div className="login-card__toggle">
            <Text
              className="login-card__toggle-text"
              onClick={() => routerStore.openForgotPassword()}
            >
              Request new reset link
            </Text>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (values: Record<string, string>) => {
    if (values.password !== values.confirm_password) {
      Toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword(token, values.password);
      setSuccess(true);
    } catch (err: any) {
      Toast.error(err.message || "Reset failed — the link may have expired");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-card__header">
          <Title heading={3} className="login-card__title">Bergamot</Title>
          <Text className="login-card__subtitle">
            {success ? "Password updated" : "Set a new password"}
          </Text>
        </div>

        {success ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <PhIcon name="check-circle" size={48} weight="fill" />
            <Text style={{ display: "block", marginTop: 12 }}>
              Your password has been reset. You can now log in.
            </Text>
          </div>
        ) : (
          <Form onSubmit={handleSubmit} style={{ width: "100%" }}>
            <Form.Input
              field="password"
              label="New Password"
              mode="password"
              prefix={<PhIcon name="lock" />}
              rules={[
                { required: true, message: "Required" },
                { min: 8, message: "Min 8 characters" },
              ]}
              className="login-card__input"
            />
            <Form.Input
              field="confirm_password"
              label="Confirm Password"
              mode="password"
              prefix={<PhIcon name="lock" />}
              rules={[{ required: true, message: "Required" }]}
              className="login-card__input"
            />
            <Button
              htmlType="submit"
              theme="solid"
              block
              loading={loading}
              className="login-card__submit"
            >
              Reset Password
            </Button>
          </Form>
        )}

        <div className="login-card__toggle">
          <Text
            className="login-card__toggle-text"
            onClick={() => routerStore.openLogin()}
          >
            Back to login
          </Text>
        </div>
      </div>
    </div>
  );
};
