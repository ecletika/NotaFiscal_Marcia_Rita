import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    // OAuth callback handler
    if (path === 'callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      if (!code) {
        throw new Error('No authorization code received');
      }

      const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-drive-sync/callback`;

      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokens = await tokenResponse.json();

      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed: ${JSON.stringify(tokens)}`);
      }

      // Return HTML that sends tokens to parent window
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Autenticação Completa</title></head>
        <body>
          <h2>Autenticação completa! Fechando...</h2>
          <script>
            window.opener.postMessage({
              type: 'google-drive-auth',
              tokens: ${JSON.stringify(tokens)}
            }, '*');
            setTimeout(() => window.close(), 1000);
          </script>
        </body>
        </html>
      `;

      return new Response(html, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }

    // Sync endpoint - list files from Google Drive folder
    if (path === 'sync') {
      const { accessToken, folderId } = await req.json();

      if (!accessToken) {
        throw new Error('Access token is required');
      }

      // Default to "NotasFiscais" folder or search for it
      let folderToSync = folderId;

      if (!folderToSync) {
        // Search for "NotasFiscais" folder
        const searchResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=name='NotasFiscais'+and+mimeType='application/vnd.google-apps.folder'&fields=files(id,name)`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        const searchData = await searchResponse.json();

        if (!searchResponse.ok) {
          throw new Error(`Failed to search folder: ${JSON.stringify(searchData)}`);
        }

        if (searchData.files && searchData.files.length > 0) {
          folderToSync = searchData.files[0].id;
        } else {
          throw new Error('Pasta "NotasFiscais" não encontrada no Google Drive');
        }
      }

      // List files in folder (only images)
      const filesResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${folderToSync}'+in+parents+and+(mimeType='image/jpeg'+or+mimeType='image/png'+or+mimeType='image/jpg')&fields=files(id,name,mimeType,modifiedTime)&orderBy=modifiedTime desc`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      const filesData = await filesResponse.json();

      if (!filesResponse.ok) {
        throw new Error(`Failed to list files: ${JSON.stringify(filesData)}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          folderId: folderToSync,
          files: filesData.files || [],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Download file endpoint
    if (path === 'download') {
      const { accessToken, fileId } = await req.json();

      if (!accessToken || !fileId) {
        throw new Error('Access token and file ID are required');
      }

      const fileResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!fileResponse.ok) {
        throw new Error(`Failed to download file: ${fileResponse.status}`);
      }

      const fileBlob = await fileResponse.blob();
      const arrayBuffer = await fileBlob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      return new Response(
        JSON.stringify({
          success: true,
          data: base64,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid endpoint' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
