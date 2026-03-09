import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CloudDownload, Check, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

interface SyncResult {
  fileName: string;
  success: boolean;
  error?: string;
}

const GoogleDriveSync = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [results, setResults] = useState<SyncResult[]>([]);
  const { toast } = useToast();

  const handleAuth = () => {
    const clientId = "95631819036-a6oc8uvd28thar5a3f9vf3cat21ch6cl.apps.googleusercontent.com";
    const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-sync/callback`;
    const scope = "https://www.googleapis.com/auth/drive.readonly";
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scope)}&` +
      `access_type=offline&` +
      `prompt=consent`;

    const authWindow = window.open(authUrl, "Google Drive Auth", "width=600,height=700");

    const messageHandler = (event: MessageEvent) => {
      if (event.data.type === "google-drive-auth" && event.data.tokens) {
        setAccessToken(event.data.tokens.access_token);
        setIsAuthenticated(true);
        toast({
          title: "Conectado!",
          description: "Autenticação com Google Drive concluída",
        });
        window.removeEventListener("message", messageHandler);
      }
    };

    window.addEventListener("message", messageHandler);
  };

  const handleSync = async () => {
    if (!accessToken) {
      toast({
        title: "Erro",
        description: "Você precisa autenticar primeiro",
        variant: "destructive",
      });
      return;
    }

    setSyncing(true);
    setResults([]);

    try {
      // List files from NotasFiscais folder
      const { data: { session } } = await supabase.auth.getSession();
      
      const syncResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-sync/sync`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ accessToken }),
        }
      );

      const syncData = await syncResponse.json();

      if (!syncResponse.ok) {
        throw new Error(syncData.error || "Erro ao listar arquivos");
      }

      setFiles(syncData.files);

      if (syncData.files.length === 0) {
        toast({
          title: "Nenhum arquivo encontrado",
          description: "Não há imagens na pasta NotasFiscais",
        });
        setSyncing(false);
        return;
      }

      toast({
        title: "Arquivos encontrados",
        description: `${syncData.files.length} imagem(ns) na pasta NotasFiscais`,
      });

      // Download and process each file
      const syncResults: SyncResult[] = [];

      for (const file of syncData.files) {
        try {
          const downloadResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-sync/download`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session?.access_token}`,
              },
              body: JSON.stringify({ accessToken, fileId: file.id }),
            }
          );

          const downloadData = await downloadResponse.json();

          if (!downloadResponse.ok) {
            throw new Error(downloadData.error || "Erro ao baixar arquivo");
          }

          // Convert base64 to blob
          const byteCharacters = atob(downloadData.data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: file.mimeType });
          const fileObj = new File([blob], file.name, { type: file.mimeType });

          // Process invoice (reuse Upload logic)
          const userId = session!.user.id;
          const fileExt = file.name.split(".").pop();
          const fileName = `${Date.now()}_${Math.random()}.${fileExt}`;
          const filePath = `${userId}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("invoices")
            .upload(filePath, fileObj);

          if (uploadError) throw new Error(uploadError.message);

          const { data: { publicUrl } } = supabase.storage
            .from("invoices")
            .getPublicUrl(filePath);

          // Process with AI
          let aiData: any = {};
          try {
            const processResponse = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-invoice`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({ imageUrl: publicUrl }),
              }
            );
            
            if (processResponse.ok) {
              aiData = await processResponse.json();
            }
          } catch {
            // Use defaults if AI fails
          }

          const today = format(new Date(), "yyyy-MM-dd");
          const invoiceDate = aiData.invoiceDate || today;
          const invoiceNumber = aiData.invoiceNumber || "N/A";
          const totalValue = typeof aiData.totalValue === "number" ? aiData.totalValue : 0;

          const { data: invoice, error: invoiceError } = await supabase
            .from("invoices")
            .insert({
              invoice_number: invoiceNumber,
              invoice_date: invoiceDate,
              delivery_date: invoiceDate,
              total_value: totalValue,
              image_url: publicUrl,
              is_manual_entry: false,
              is_validated: false,
              user_id: userId,
              original_filename: file.name,
            })
            .select()
            .single();

          if (invoiceError) throw new Error(invoiceError.message);

          const items = aiData.items && aiData.items.length > 0
            ? aiData.items.map((item: any) => ({
                invoice_id: invoice.id,
                description: item.description || "Item não identificado",
                value: item.value || 0,
              }))
            : [{
                invoice_id: invoice.id,
                description: "Item não identificado",
                value: totalValue,
              }];

          await supabase.from("invoice_items").insert(items);

          syncResults.push({ fileName: file.name, success: true });

        } catch (error) {
          console.error(`Error processing ${file.name}:`, error);
          syncResults.push({
            fileName: file.name,
            success: false,
            error: error instanceof Error ? error.message : "Erro desconhecido",
          });
        }
      }

      setResults(syncResults);

      const successful = syncResults.filter((r) => r.success).length;
      toast({
        title: "Sincronização concluída",
        description: `${successful} de ${syncResults.length} arquivo(s) importado(s)`,
      });

    } catch (error) {
      console.error("Sync error:", error);
      toast({
        title: "Erro na sincronização",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Sincronização com Google Drive</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isAuthenticated ? (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Como funciona</AlertTitle>
                <AlertDescription>
                  <ul className="text-sm mt-2 space-y-1">
                    <li>• Conecte sua conta do Google Drive</li>
                    <li>• Buscaremos automaticamente a pasta <strong>"NotasFiscais"</strong></li>
                    <li>• Todas as imagens serão importadas e processadas</li>
                    <li>• As notas vão para validação, igual ao upload manual</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <Button onClick={handleAuth} className="w-full">
                <CloudDownload className="mr-2 h-4 w-4" />
                Conectar ao Google Drive
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <Check className="h-4 w-4 text-green-500" />
                <AlertTitle>Conectado ao Google Drive</AlertTitle>
                <AlertDescription>
                  Pronto para sincronizar a pasta "NotasFiscais"
                </AlertDescription>
              </Alert>

              <Button
                onClick={handleSync}
                disabled={syncing}
                className="w-full"
              >
                {syncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <CloudDownload className="mr-2 h-4 w-4" />
                    Sincronizar Agora
                  </>
                )}
              </Button>

              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="font-medium">
                    Arquivos encontrados: {files.length}
                  </p>
                  <div className="text-sm text-muted-foreground max-h-40 overflow-y-auto space-y-1">
                    {files.map((file) => (
                      <div key={file.id}>• {file.name}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados da Sincronização</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {results.map((result, index) => (
                <Alert
                  key={index}
                  variant={result.success ? "default" : "destructive"}
                >
                  {result.success ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertTitle className="font-medium">
                    {result.fileName}
                  </AlertTitle>
                  <AlertDescription className="text-sm">
                    {result.success
                      ? "Importado com sucesso"
                      : result.error || "Erro desconhecido"}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GoogleDriveSync;
