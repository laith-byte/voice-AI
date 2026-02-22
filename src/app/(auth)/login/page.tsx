import { Metadata } from "next";
import LoginForm from "./_login-form";

export const metadata: Metadata = {
  title: "Log In",
};

export default function LoginPage() {
  return <LoginForm />;
}
