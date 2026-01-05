import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, addDays, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link2, Trash2, Copy, Check, ExternalLink, Clock, AlertTriangle, RefreshCw } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SharedReport {
  id: string;
  report_type: string;
  report_title: string;
  created_at: string;
  expires_at: string | null;
}

const LinksCompartilhados = () => {
  const [links, setLinks] = useState<SharedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [extendId, setExtendId] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState("7");
  const { toast } = useToast();

  const fetchLinks = async () => {
    try {
      const { data, error } = await supabase
        .from("shared_reports")
        .select("id, report_type, report_title, created_at, expires_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLinks(data || []);
    } catch (error) {
      console.error("Error fetching links:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar links",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const copyLink = async (id: string) => {
    const url = `${window.location.origin}/report/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      toast({
        title: "Copiado!",
        description: "Link copiado para a área de transferência",
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({
        title: "Erro",
        description: "Falha ao copiar link",
        variant: "destructive",
      });
    }
  };

  const deleteLink = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("shared_reports")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      setLinks(links.filter((l) => l.id !== deleteId));
      toast({
        title: "Eliminado",
        description: "Link removido com sucesso",
      });
    } catch (error) {
      console.error("Error deleting link:", error);
      toast({
        title: "Erro",
        description: "Falha ao eliminar link",
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  const extendLink = async () => {
    if (!extendId) return;

    try {
      const newExpiry = addDays(new Date(), parseInt(extendDays));
      
      const { error } = await supabase
        .from("shared_reports")
        .update({ expires_at: newExpiry.toISOString() })
        .eq("id", extendId);

      if (error) throw error;

      setLinks(links.map((l) => 
        l.id === extendId ? { ...l, expires_at: newExpiry.toISOString() } : l
      ));
      
      toast({
        title: "Atualizado",
        description: `Link válido por mais ${extendDays} dias`,
      });
    } catch (error) {
      console.error("Error extending link:", error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar validade",
        variant: "destructive",
      });
    } finally {
      setExtendId(null);
    }
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return isPast(new Date(expiresAt));
  };

  const getExpiryStatus = (expiresAt: string | null) => {
    if (!expiresAt) return { text: "Sem expiração", color: "text-muted-foreground" };
    
    const expiryDate = new Date(expiresAt);
    if (isPast(expiryDate)) {
      return { text: "Expirado", color: "text-destructive" };
    }
    
    return {
      text: `Expira ${formatDistanceToNow(expiryDate, { addSuffix: true, locale: ptBR })}`,
      color: "text-muted-foreground"
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Links Compartilhados
          </CardTitle>
          <CardDescription>
            Gerencie os links de relatórios que você compartilhou
          </CardDescription>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum link compartilhado ainda</p>
              <p className="text-sm mt-2">
                Gere links nos Relatórios para aparecerem aqui
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {links.map((link) => {
                const expired = isExpired(link.expires_at);
                const expiryStatus = getExpiryStatus(link.expires_at);
                
                return (
                  <div
                    key={link.id}
                    className={`p-4 border rounded-lg transition-colors ${
                      expired ? "bg-destructive/5 border-destructive/20" : "bg-background/50 hover:bg-background/80"
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{link.report_title}</p>
                          {expired && (
                            <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Expirado
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm">
                          <span className="text-muted-foreground">
                            Criado em {format(new Date(link.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          <span className={`flex items-center gap-1 ${expiryStatus.color}`}>
                            <Clock className="h-3 w-3" />
                            {expiryStatus.text}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyLink(link.id)}
                          className="gap-1"
                        >
                          {copiedId === link.id ? (
                            <Check className="h-4 w-4 text-bonus" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                          <span className="hidden sm:inline">Copiar</span>
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/report/${link.id}`, "_blank")}
                          className="gap-1"
                        >
                          <ExternalLink className="h-4 w-4" />
                          <span className="hidden sm:inline">Abrir</span>
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setExtendId(link.id)}
                          className="gap-1"
                        >
                          <RefreshCw className="h-4 w-4" />
                          <span className="hidden sm:inline">Renovar</span>
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteId(link.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Link</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja eliminar este link? Qualquer pessoa com o link deixará de conseguir aceder ao relatório.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteLink} className="bg-destructive hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Extend Expiry Dialog */}
      <AlertDialog open={!!extendId} onOpenChange={() => setExtendId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renovar Validade do Link</AlertDialogTitle>
            <AlertDialogDescription>
              Escolha por quantos dias o link ficará ativo a partir de hoje.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={extendDays} onValueChange={setExtendDays}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 dia</SelectItem>
                <SelectItem value="3">3 dias</SelectItem>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="14">14 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="60">60 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={extendLink}>
              Renovar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LinksCompartilhados;
