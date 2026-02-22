import { Metadata } from "next";
import SetupAccountForm from "./_setup-account-form";

export const metadata: Metadata = {
  title: "Set Up Your Account",
};

export default function SetupAccountPage() {
  return <SetupAccountForm />;
}
