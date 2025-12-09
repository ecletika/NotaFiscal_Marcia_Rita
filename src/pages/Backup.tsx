import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Database, Loader2, Upload, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BackupData {
  export_date: string;
  user_email: string;
  data: {
    invoices: any[];
    revenues: any[];
    corte_cose_debts?: any[];
  };
  summary: {
    total_invoices: number;
    total_revenues: number;
    total_invoice_items: number;
    total_corte_cose_debts?: number;
  };
}

const Backup = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [backupToRestore, setBackupToRestore] = useState<BackupData | null>(null);
  const [restoreProgress, setRestoreProgress] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportAllData = async () => {
    setIsExporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Fetch all invoices with items
      const { data: invoices, error: invoicesError } = await supabase
        .from("invoices")
        .select(`*, invoice_items (*)`)
        .eq("user_id", user.id)
        .order("invoice_date", { ascending: false });

      if (invoicesError) throw invoicesError;

      // Fetch all revenues
      const { data: revenues, error: revenuesError } = await supabase
        .from("revenues")
        .select("*")
        .eq("user_id", user.id)
        .order("revenue_date", { ascending: false });

      if (revenuesError) throw revenuesError;

      // Fetch all Corte & Cose debts
      const { data: debts, error: debtsError } = await supabase
        .from("corte_cose_debts")
        .select("*")
        .eq("user_id", user.id)
        .order("debt_date", { ascending: false });

      if (debtsError) throw debtsError;

      // Create backup object
      const backup: BackupData = {
        export_date: new Date().toISOString(),
        user_email: user.email || "",
        data: {
          invoices: invoices || [],
          revenues: revenues || [],
          corte_cose_debts: debts || [],
        },
        summary: {
          total_invoices: invoices?.length || 0,
          total_revenues: revenues?.length || 0,
          total_invoice_items: invoices?.reduce((sum, inv) => sum + (inv.invoice_items?.length || 0), 0) || 0,
          total_corte_cose_debts: debts?.length || 0,
        }
      };

      // Convert to JSON and download
      const dataStr = JSON.stringify(backup, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Backup exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar backup:", error);
      toast.error("Erro ao exportar backup");
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string) as BackupData;
        
        // Validate backup structure
        if (!backup.data || !backup.data.invoices || !backup.data.revenues) {
          toast.error("Arquivo de backup inválido");
          return;
        }

        setBackupToRestore(backup);
        setShowConfirmDialog(true);
      } catch {
        toast.error("Erro ao ler arquivo de backup");
      }
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const restoreBackup = async () => {
    if (!backupToRestore) return;
    
    setIsRestoring(true);
    setShowConfirmDialog(false);
    setRestoreProgress("Iniciando restauração...");
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Step 1: Get all existing invoices to delete their items
      setRestoreProgress("Removendo dados existentes...");
      
      const { data: existingInvoices } = await supabase
        .from("invoices")
        .select("id")
        .eq("user_id", user.id);

      // Delete invoice_items for each existing invoice
      if (existingInvoices && existingInvoices.length > 0) {
        for (const inv of existingInvoices) {
          await supabase.from("invoice_items").delete().eq("invoice_id", inv.id);
        }
      }

      // Delete existing invoices
      await supabase.from("invoices").delete().eq("user_id", user.id);
      
      // Delete existing revenues
      await supabase.from("revenues").delete().eq("user_id", user.id);
      
      // Delete existing debts
      await supabase.from("corte_cose_debts").delete().eq("user_id", user.id);

      // Step 2: Restore invoices one by one
      setRestoreProgress(`Restaurando ${backupToRestore.data.invoices.length} notas fiscais...`);
      
      for (let i = 0; i < backupToRestore.data.invoices.length; i++) {
        const invoice = backupToRestore.data.invoices[i];
        const { invoice_items, id: _oldId, user_id: _oldUserId, ...invoiceData } = invoice;
        
        setRestoreProgress(`Restaurando nota fiscal ${i + 1} de ${backupToRestore.data.invoices.length}...`);
        
        const { data: newInvoice, error: invoiceError } = await supabase
          .from("invoices")
          .insert({
            ...invoiceData,
            user_id: user.id,
          })
          .select()
          .single();

        if (invoiceError) {
          console.error("Erro ao restaurar nota fiscal:", invoiceError);
          throw new Error(`Erro ao restaurar nota fiscal: ${invoiceError.message}`);
        }

        // Restore invoice items
        if (invoice_items && invoice_items.length > 0) {
          const itemsToInsert = invoice_items.map((item: any) => {
            const { id: _itemId, invoice_id: _oldInvoiceId, ...itemData } = item;
            return {
              ...itemData,
              invoice_id: newInvoice.id,
            };
          });

          const { error: itemsError } = await supabase
            .from("invoice_items")
            .insert(itemsToInsert);

          if (itemsError) {
            console.error("Erro ao restaurar itens:", itemsError);
            throw new Error(`Erro ao restaurar itens: ${itemsError.message}`);
          }
        }
      }

      // Step 3: Restore revenues
      if (backupToRestore.data.revenues.length > 0) {
        setRestoreProgress(`Restaurando ${backupToRestore.data.revenues.length} receitas...`);
        
        const revenuesToInsert = backupToRestore.data.revenues.map((rev: any) => {
          const { id: _oldId, user_id: _oldUserId, ...revData } = rev;
          return {
            ...revData,
            user_id: user.id,
          };
        });

        const { error: revenuesError } = await supabase
          .from("revenues")
          .insert(revenuesToInsert);

        if (revenuesError) {
          console.error("Erro ao restaurar receitas:", revenuesError);
          throw new Error(`Erro ao restaurar receitas: ${revenuesError.message}`);
        }
      }

      // Step 4: Restore Corte & Cose debts
      if (backupToRestore.data.corte_cose_debts && backupToRestore.data.corte_cose_debts.length > 0) {
        setRestoreProgress(`Restaurando ${backupToRestore.data.corte_cose_debts.length} dívidas...`);
        
        const debtsToInsert = backupToRestore.data.corte_cose_debts.map((debt: any) => {
          const { id: _oldId, user_id: _oldUserId, ...debtData } = debt;
          return {
            ...debtData,
            user_id: user.id,
          };
        });

        const { error: debtsError } = await supabase
          .from("corte_cose_debts")
          .insert(debtsToInsert);

        if (debtsError) {
          console.error("Erro ao restaurar dívidas:", debtsError);
          throw new Error(`Erro ao restaurar dívidas: ${debtsError.message}`);
        }
      }

      setRestoreProgress("");
      toast.success("Backup restaurado com sucesso!");
    } catch (error) {
      console.error("Erro ao restaurar backup:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro ao restaurar backup: ${errorMessage}`);
    } finally {
      setIsRestoring(false);
      setBackupToRestore(null);
      setRestoreProgress("");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Backup de Dados</h1>
        <p className="text-muted-foreground mt-2">
          Exporte ou restaure todos os seus dados em formato JSON
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Export Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Exportar Base de Dados
            </CardTitle>
            <CardDescription>
              Faça o download de todos os seus dados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h3 className="font-semibold text-sm">O backup incluirá:</h3>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Todas as notas fiscais</li>
                <li>• Todos os itens das notas fiscais</li>
                <li>• Todas as receitas registradas</li>
                <li>• Todas as dívidas Corte & Cose</li>
              </ul>
            </div>

            <Button 
              onClick={exportAllData} 
              disabled={isExporting}
              className="w-full"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Backup (JSON)
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Restore Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Restaurar Base de Dados
            </CardTitle>
            <CardDescription>
              Restaure seus dados a partir de um backup
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Atenção!
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    A restauração irá substituir todos os dados existentes pelos dados do backup.
                  </p>
                </div>
              </div>
            </div>

            <Input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              disabled={isRestoring}
              className="cursor-pointer"
            />

            {isRestoring && (
              <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-sm">{restoreProgress || "Restaurando backup..."}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Restauração</AlertDialogTitle>
            <AlertDialogDescription>
              {backupToRestore && (
                <div className="space-y-2">
                  <p>Você está prestes a restaurar um backup com:</p>
                  <ul className="list-disc list-inside text-sm">
                    <li>{backupToRestore.summary.total_invoices} nota(s) fiscal(is)</li>
                    <li>{backupToRestore.summary.total_invoice_items} item(ns) de notas</li>
                    <li>{backupToRestore.summary.total_revenues} receita(s)</li>
                    <li>{backupToRestore.summary.total_corte_cose_debts || 0} dívida(s) Corte & Cose</li>
                  </ul>
                  <p className="font-medium text-destructive mt-2">
                    Isso irá substituir todos os seus dados atuais!
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={restoreBackup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Backup;
