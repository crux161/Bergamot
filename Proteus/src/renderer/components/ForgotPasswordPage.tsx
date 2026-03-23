import React, { useState } from "react";
import { Button, Form, Toast, Typography } from "@douyinfe/semi-ui";
import { PhIcon } from "./PhIcon";
import * as api from "../services/api";
import { routerStore } from "../stores/routerStore";

const { Title, Text } = Typography;

export const ForgotPasswordPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (values: Record<string, string>) => {
    setLoading(true);
    try {
      await api.forgotPassword(values.email);
      setSuccess(true);
    } catch (err: any) {
      Toast.error(err.message || "Something went wrong");
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
            {success ? "Check your email" : "Forgot your password?"}
          </Text>
        </div>

        {success ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <PhIcon name="check-circle" size={48} weight="fill" />
            <Text style={{ display: "block", marginTop: 12 }}>
              If an account with that email exists, we've sent a password reset link.
            </Text>
          </div>
        ) : (
          <Form onSubmit={handleSubmit} style={{ width: "100%" }}>
            <Form.Input
              field="email"
              label="Email Address"
              prefix={<PhIcon name="envelope" />}
              rules={[
                { required: true, message: "Required" },
                { type: "email", message: "Invalid email" },
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
              Send Reset Link
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
