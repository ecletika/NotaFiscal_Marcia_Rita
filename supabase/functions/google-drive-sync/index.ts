import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

function base64UrlDecode(input: string) {
  // base64url -> base64
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/") +
    "==".slice(0, (4 - (input.length % 4)) % 4);
  return atob(base64);
}

function safeGetAppOriginFromState(state: string | null) {
  if (!state) return null;
  try {
    const decoded = base64UrlDecode(state);
    console.log("[callback] decoded state:", decoded);
    const parsed = JSON.parse(decoded);
    const appOrigin = String(parsed?.appOrigin ?? "");
    console.log("[callback] appOrigin:", appOrigin);

    // Prevent open-redirect: only allow HTTPS origins on known domains.
    if (!/^https:\/\//i.test(appOrigin)) return null;
    const hostname = new URL(appOrigin).hostname.toLowerCase();
    const allowed =
      hostname.endsWith(".lovable.app") ||
      hostname.endsWith(".lovableproject.com") ||
      hostname.endsWith(".supabase.co") ||
      hostname === "localhost";
    if (!allowed) return null;

    return appOrigin;
  } catch (err) {
    console.error("[callback] state parse error:", err);
    return null;
  }
}

function callbackHtml(opts: { appOrigin: string; code: string; state: string | null }) {
  const { appOrigin, code, state } = opts;

  const redirectTo = `${appOrigin}/google-drive?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state ?? "")}`;

  const lsPayload = {
    type: "google_drive_oauth",
    code,
    state: state ?? "",
    ts: Date.now(),
  };

  return `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Autenticação concluída</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; }
  </style>
</head>
<body>
  <h2>Autenticação concluída.</h2>
  <p>Você pode fechar esta janela e voltar para o app.</p>

  <script>
    (function () {
      // Write code to localStorage so the main app (even inside an iframe) can pick it up.
      try {
        localStorage.setItem("gd_oauth_result", ${JSON.stringify(JSON.stringify(lsPayload))});
      } catch (_) {}

      // Also try postMessage in case opener is accessible.
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(${JSON.stringify(lsPayload)}, "*");
          setTimeout(function() { window.close(); }, 300);
          return;
        }
      } catch (_) {}

      // Auto-close after saving to localStorage
      setTimeout(function() {
        try { window.close(); } catch(_) {}
      }, 1000);
    })();
  </script>
</body>
</html>`;



serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    // -------------------------
    // OAuth callback (public)
    // -------------------------
    if (path === "callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");

      if (!code) {
        return new Response("Missing code", {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
        });
      }

      const appOrigin = safeGetAppOriginFromState(state);

      // If we can't safely redirect, show a minimal page instead of leaking tokens.
      if (!appOrigin) {
        const html = `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Autenticação concluída</title>
</head>
<body>
  <h2>Autenticação concluída.</h2>
  <p>Volte para a aba do app para continuar.</p>
</body>
</html>`;
        return new Response(html, {
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
        });
      }

      const html = callbackHtml({ appOrigin, code, state });
      return new Response(html, {
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Everything below requires being called from the app (authenticated)
    const authHeader = req.headers.get("authorization") ?? "";
    const hasBearer = /^Bearer\s+.+/i.test(authHeader);

    if (!hasBearer) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    // -------------------------
    // Exchange code -> tokens
    // -------------------------
    if (path === "token") {
      const { code } = await req.json();

      if (!code) {
        return json({ error: "Code is required" }, { status: 400 });
      }

      const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
      const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
      const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-drive-sync/callback`;

      if (!clientId || !clientSecret) {
        return json({
          error:
            "Google OAuth credentials are not configured (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET).",
        }, { status: 500 });
      }

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokens = await tokenResponse.json();

      if (!tokenResponse.ok) {
        return json({ error: "Token exchange failed", details: tokens }, { status: 400 });
      }

      return json({ success: true, tokens });
    }

    // -------------------------
    // Get user info
    // -------------------------
    if (path === "userinfo") {
      const { accessToken } = await req.json();

      if (!accessToken) {
        return json({ error: "Access token is required" }, { status: 400 });
      }

      const userInfoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const userInfoData = await userInfoResponse.json();

      if (!userInfoResponse.ok) {
        return json({ error: "Failed to get user info", details: userInfoData }, { status: 400 });
      }

      return json({ success: true, userInfo: userInfoData });
    }

    // List folders
    // -------------------------
    if (path === "folders") {
      const { accessToken } = await req.json();

      if (!accessToken) {
        return json({ error: "Access token is required" }, { status: 400 });
      }

      const foldersResponse = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder'&fields=files(id,name)&orderBy=name",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const foldersData = await foldersResponse.json();

      if (!foldersResponse.ok) {
        return json({ error: "Failed to list folders", details: foldersData }, { status: 400 });
      }

      return json({ success: true, folders: foldersData.files || [] });
    }

    // -------------------------
    // Sync: list image files
    // -------------------------
    if (path === "sync") {
      const { accessToken, folderId } = await req.json();

      if (!accessToken) {
        return json({ error: "Access token is required" }, { status: 400 });
      }

      if (!folderId) {
        return json({ error: "Folder ID is required" }, { status: 400 });
      }

      const filesResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+(mimeType='image/jpeg'+or+mimeType='image/png'+or+mimeType='image/jpg')&fields=files(id,name,mimeType,modifiedTime)&orderBy=modifiedTime desc`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const filesData = await filesResponse.json();

      if (!filesResponse.ok) {
        return json({ error: "Failed to list files", details: filesData }, { status: 400 });
      }

      return json({ success: true, folderId, files: filesData.files || [] });
    }

    // -------------------------
    // Download file
    // -------------------------
    if (path === "download") {
      const { accessToken, fileId } = await req.json();

      if (!accessToken || !fileId) {
        return json({ error: "Access token and file ID are required" }, { status: 400 });
      }

      const fileResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!fileResponse.ok) {
        return json({ error: "Failed to download file", status: fileResponse.status }, { status: 400 });
      }

      const fileBlob = await fileResponse.blob();
      const arrayBuffer = await fileBlob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      return json({ success: true, data: base64 });
    }

    return json({ error: "Invalid endpoint" }, { status: 400 });
  } catch (error) {
    console.error("Error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
});
