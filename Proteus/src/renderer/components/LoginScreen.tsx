import React, { useState } from "react";
import { Button, Input, Form, Toast, Typography } from "@douyinfe/semi-ui";
import { IconUser, IconLock, IconMail } from "@douyinfe/semi-icons";
import * as api from "../services/api";

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
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#2E372E",
      }}
    >
      <div
        style={{
          width: 400,
          padding: 40,
          background: "#354E4B",
          borderRadius: 12,
          border: "1px solid #3A403B",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Title
            heading={3}
            style={{ color: "#A5BA93", marginBottom: 8 }}
          >
            Bergamot
          </Title>
          <Text style={{ color: "#749F8D" }}>
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
            prefix={<IconUser />}
            rules={[{ required: true, message: "Required" }]}
            style={{ background: "#3A403B", borderColor: "#374231" }}
          />

          {isRegister && (
            <Form.Input
              field="email"
              label="Email"
              prefix={<IconMail />}
              rules={[
                { required: true, message: "Required" },
                { type: "email", message: "Invalid email" },
              ]}
              style={{ background: "#3A403B", borderColor: "#374231" }}
            />
          )}

          <Form.Input
            field="password"
            label="Password"
            mode="password"
            prefix={<IconLock />}
            rules={[
              { required: true, message: "Required" },
              { min: 8, message: "Min 8 characters" },
            ]}
            style={{ background: "#3A403B", borderColor: "#374231" }}
          />

          <Button
            htmlType="submit"
            theme="solid"
            block
            loading={loading}
            style={{
              marginTop: 16,
              background: "#6B9362",
              borderColor: "#6B9362",
              height: 42,
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            {isRegister ? "Register" : "Log In"}
          </Button>
        </Form>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Text
            style={{ color: "#749F8D", cursor: "pointer" }}
            onClick={() => setIsRegister(!isRegister)}
          >
            {isRegister
              ? "Already have an account? Log in"
              : "Need an account? Register"}
          </Text>
        </div>
      </div>
    </div>
  );
};
