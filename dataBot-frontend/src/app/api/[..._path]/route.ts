import { initApiPassthrough } from "langgraph-nextjs-api-passthrough";
import { auth0 } from "@/lib/auth0";
import type { NextRequest } from "next/server";

export const { GET, POST, PUT, PATCH, DELETE, OPTIONS, runtime } =
  initApiPassthrough({
    apiUrl: process.env.LANGGRAPH_API_URL ?? "remove-me",
    apiKey: process.env.LANGSMITH_API_KEY ?? "remove-me",
    runtime: "edge",
    headers: async (_req: NextRequest): Promise<Record<string, string>> => {
      const accessToken = await auth0.getAccessToken({
        audience: process.env.AUTH0_AUDIENCE,
        scope: "openid profile email",
      });

      const token =
        typeof accessToken === "string"
          ? accessToken
          : accessToken.token;

      return token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {};
    },
  });