import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import ChatApp from "./chat-app";

export default async function Page() {
  const session = await auth0.getSession();

  if (!session) {
    redirect("/auth/login");
  }

  return <ChatApp />;
}