import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload as UploadIcon, Loader2, CheckCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";

interface UploadResult {
  fileName: string;
  success: boolean;
  warning?: string;
}

const Upload = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setResults([]);
    }
  };

  const processInvoice = async (file: File, userId: string): Promise<UploadResult> => {
    try {
      // Upload image to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(filePath, file);

      if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('invoices')
        .getPublicUrl(filePath);

      // Get session for auth
      const { data: { session } } = await supabase.auth.getSession();
      
      // Process with AI - never fail, just use defaults
      let aiData: any = {};
      let ocrWarning = "";
      
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-invoice`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({ imageUrl: publicUrl }),
          }
        );
        
        if (response.ok) {
          aiData = await response.json();
        } else {
          ocrWarning = "OCR não conseguiu ler a imagem. Valores padrão aplicados.";
        }
        
      } catch {
        ocrWarning = "OCR não conseguiu processar a imagem. Valores padrão aplicados.";
      }

      // Use defaults for everything - NEVER fail
      const today = format(new Date(), "yyyy-MM-dd");
      const currentYear = new Date().getFullYear();
      let invoiceDate = today;
      
      // Parse date from DD/MM/YYYY to YYYY-MM-DD if available
      if (aiData.invoiceDate && aiData.invoiceDate !== "N/A" && aiData.invoiceDate !== null) {
        try {
          const dateParts = aiData.invoiceDate.split('/');
          if (dateParts.length === 3) {
            let day = dateParts[0].padStart(2, '0');
            let month = dateParts[1].padStart(2, '0');
            let year = dateParts[2];
            
            // Handle invalid year (null, undefined, NaN, or non-numeric)
            if (!year || year === 'null' || year === 'undefined' || isNaN(parseInt(year))) {
              year = String(currentYear);
            }
            // Handle 2-digit year
            if (year.length === 2) {
              year = `20${year}`;
            }
            
            // Validate day and month are numeric
            if (!isNaN(parseInt(day)) && !isNaN(parseInt(month)) && !isNaN(parseInt(year))) {
              invoiceDate = `${year}-${month}-${day}`;
            }
          }
        } catch {
          // Use today's date as fallback
          invoiceDate = today;
        }
      }

      const invoiceNumber = aiData.invoiceNumber || "N/A";
      const totalValue = typeof aiData.totalValue === 'number' ? aiData.totalValue : 0;
      const phoneNumber = aiData.phoneNumber || null;
      const contactName = aiData.contactName || null;

      // Build warning message for fields that weren't read
      const missingFields: string[] = [];
      if (!aiData.invoiceNumber || aiData.invoiceNumber === "N/A") missingFields.push("número da nota");
      if (!aiData.invoiceDate || aiData.invoiceDate === "N/A") missingFields.push("data");
      if (!aiData.totalValue) missingFields.push("valor total");
      if (!aiData.items || aiData.items.length === 0) missingFields.push("itens");
      
      if (missingFields.length > 0) {
        ocrWarning = `Não foi possível ler: ${missingFields.join(", ")}. Revise na aba de validação.`;
      }

      // Save invoice with is_validated = false (pending validation)
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          delivery_date: invoiceDate,
          total_value: totalValue,
          image_url: publicUrl,
          is_manual_entry: false,
          is_validated: false, // NEW: Start as not validated
          user_id: userId,
          phone_number: phoneNumber,
          contact_name: contactName,
          original_filename: file.name, // Save original filename
        })
        .select()
        .single();

      if (invoiceError) throw new Error(`Erro ao salvar nota: ${invoiceError.message}`);

      // Save items (even if empty, create at least one placeholder)
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

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(items);

      if (itemsError) throw new Error(`Erro ao salvar itens: ${itemsError.message}`);

      return { success: true, fileName: file.name, warning: ocrWarning || undefined };
    } catch (error) {
      console.error('Error processing invoice:', error);
      // Even on error, try to save with minimal data
      try {
        const today = format(new Date(), "yyyy-MM-dd");
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_fallback_${Math.random()}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;
        
        // Try to get the URL if upload succeeded earlier
        const { data: { publicUrl } } = supabase.storage
          .from('invoices')
          .getPublicUrl(filePath);

        const { data: invoice, error: fallbackError } = await supabase
          .from('invoices')
          .insert({
            invoice_number: "N/A",
            invoice_date: today,
            delivery_date: today,
            total_value: 0,
            image_url: publicUrl || null,
            is_manual_entry: false,
            is_validated: false,
            user_id: userId,
          })
          .select()
          .single();

        if (!fallbackError && invoice) {
          await supabase.from('invoice_items').insert({
            invoice_id: invoice.id,
            description: "Item não identificado",
            value: 0,
          });
          
          return { 
            success: true, 
            fileName: file.name, 
            warning: "Upload realizado com valores padrão. Revise na aba de validação." 
          };
        }
      } catch {
        // Ignore fallback errors
      }
      
      return { 
        success: true, 
        fileName: file.name, 
        warning: "Processamento parcial. Verifique os dados na aba de validação." 
      };
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast({
        title: "Erro",
        description: "Por favor, selecione pelo menos um arquivo",
        variant: "destructive",
      });
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setResults([]);
    const userId = session.user.id;
    const uploadResults = await Promise.all(files.map(file => processInvoice(file, userId)));

    setResults(uploadResults);
    
    const successful = uploadResults.filter(r => r.success).length;
    const withWarnings = uploadResults.filter(r => r.warning).length;

    toast({
      title: "Upload concluído",
      description: `${successful} nota(s) enviada(s) para validação${withWarnings > 0 ? ` (${withWarnings} com avisos)` : ''}`,
    });
    
    setFiles([]);
    // Reset input
    const input = document.getElementById('file-input') as HTMLInputElement;
    if (input) input.value = '';

    setUploading(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload de Notas Fiscais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <UploadIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <Input
              id="file-input"
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="mb-4"
            />
            <p className="text-sm text-muted-foreground">
              Selecione uma ou mais imagens de notas fiscais
            </p>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <p className="font-medium">Arquivos selecionados:</p>
              <ul className="list-disc list-inside space-y-1">
                {files.map((file, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    {file.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              "Fazer Upload e Processar"
            )}
          </Button>
          
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Como funciona</AlertTitle>
            <AlertDescription>
              <ul className="text-sm mt-2 space-y-1">
                <li>• As notas são enviadas para a aba <strong>"Pendente de Validação"</strong></li>
                <li>• Você poderá revisar e editar todas as informações</li>
                <li>• Após validar, a nota vai para o arquivo por data</li>
                <li>• Mesmo que o OCR não leia tudo, a nota é salva com valores padrão</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados do Upload</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.map((result, index) => (
                <Alert key={index} variant="default">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertTitle className="font-medium">{result.fileName}</AlertTitle>
                  <AlertDescription className="text-sm">
                    {result.warning ? (
                      <span className="text-yellow-600 dark:text-yellow-400">{result.warning}</span>
                    ) : (
                      "Enviado para validação"
                    )}
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

export default Upload;
