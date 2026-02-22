import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Search, CheckCircle, Pencil, Save, X, ChevronDown, ChevronUp, FolderOpen,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface GroupInvoice {
  id: string;
  invoice_id: string;
  invoice_number: string;
  total_value: number;
  delivery_date: string;
}

interface InvoiceGroup {
  id: string;
  name: string;
  total_value: number;
  is_completed: boolean;
  created_at: string;
  invoices: GroupInvoice[];
}

const AgrupamentoNotas = () => {
  const [groups, setGroups] = useState<InvoiceGroup[]>([]);
  const [newGroupDialogOpen, setNewGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupTotal, setNewGroupTotal] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [addInvoiceGroupId, setAddInvoiceGroupId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupTotal, setEditGroupTotal] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    const { data: groupsData, error } = await supabase
      .from("invoice_groups")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading groups:", error);
      return;
    }

    const groupsWithInvoices: InvoiceGroup[] = [];
    for (const group of groupsData || []) {
      const { data: items } = await supabase
        .from("invoice_group_items")
        .select("id, invoice_id")
        .eq("group_id", group.id);

      const invoices: GroupInvoice[] = [];
      for (const item of items || []) {
        const { data: inv } = await supabase
          .from("invoices")
          .select("invoice_number, total_value, delivery_date")
          .eq("id", item.invoice_id)
          .single();

        if (inv) {
          invoices.push({
            id: item.id,
            invoice_id: item.invoice_id,
            invoice_number: inv.invoice_number,
            total_value: Number(inv.total_value),
            delivery_date: inv.delivery_date,
          });
        }
      }

      groupsWithInvoices.push({
        id: group.id,
        name: group.name,
        total_value: Number(group.total_value),
        is_completed: group.is_completed,
        created_at: group.created_at,
        invoices,
      });
    }

    setGroups(groupsWithInvoices);
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) {
      toast({ title: "Erro", description: "Nome do grupo é obrigatório", variant: "destructive" });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("invoice_groups").insert({
      user_id: user.id,
      name: newGroupName.trim(),
      total_value: Number(newGroupTotal) || 0,
    });

    if (error) {
      toast({ title: "Erro", description: "Falha ao criar grupo", variant: "destructive" });
      return;
    }

    toast({ title: "Sucesso", description: "Grupo criado" });
    setNewGroupName("");
    setNewGroupTotal("");
    setNewGroupDialogOpen(false);
    loadGroups();
  };

  const deleteGroup = async (groupId: string) => {
    if (!confirm("Tem certeza que deseja excluir este grupo?")) return;

    const { error } = await supabase.from("invoice_groups").delete().eq("id", groupId);
    if (error) {
      toast({ title: "Erro", description: "Falha ao excluir grupo", variant: "destructive" });
      return;
    }

    toast({ title: "Sucesso", description: "Grupo excluído" });
    loadGroups();
  };

  const toggleComplete = async (group: InvoiceGroup) => {
    const { error } = await supabase
      .from("invoice_groups")
      .update({ is_completed: !group.is_completed })
      .eq("id", group.id);

    if (error) {
      toast({ title: "Erro", description: "Falha ao atualizar grupo", variant: "destructive" });
      return;
    }

    toast({ title: "Sucesso", description: group.is_completed ? "Grupo reaberto" : "Grupo concluído" });
    loadGroups();
  };

  const searchInvoices = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 1) {
      setSearchResults([]);
      return;
    }

    const { data } = await supabase
      .from("invoices")
      .select("id, invoice_number, total_value, delivery_date")
      .eq("is_validated", true)
      .ilike("invoice_number", `%${query}%`)
      .limit(10);

    setSearchResults(data || []);
  };

  const addInvoiceToGroup = async (groupId: string, invoiceId: string) => {
    const { error } = await supabase.from("invoice_group_items").insert({
      group_id: groupId,
      invoice_id: invoiceId,
    });

    if (error) {
      if (error.code === "23505") {
        toast({ title: "Aviso", description: "Nota já está neste grupo", variant: "destructive" });
      } else {
        toast({ title: "Erro", description: "Falha ao adicionar nota", variant: "destructive" });
      }
      return;
    }

    toast({ title: "Sucesso", description: "Nota adicionada ao grupo" });
    setSearchQuery("");
    setSearchResults([]);
    loadGroups();
  };

  const removeInvoiceFromGroup = async (itemId: string) => {
    const { error } = await supabase.from("invoice_group_items").delete().eq("id", itemId);

    if (error) {
      toast({ title: "Erro", description: "Falha ao remover nota", variant: "destructive" });
      return;
    }

    toast({ title: "Sucesso", description: "Nota removida do grupo" });
    loadGroups();
  };

  const startEditGroup = (group: InvoiceGroup) => {
    setEditingGroupId(group.id);
    setEditGroupName(group.name);
    setEditGroupTotal(group.total_value.toString());
  };

  const saveEditGroup = async (groupId: string) => {
    const { error } = await supabase
      .from("invoice_groups")
      .update({ name: editGroupName, total_value: Number(editGroupTotal) || 0 })
      .eq("id", groupId);

    if (error) {
      toast({ title: "Erro", description: "Falha ao atualizar grupo", variant: "destructive" });
      return;
    }

    toast({ title: "Sucesso", description: "Grupo atualizado" });
    setEditingGroupId(null);
    loadGroups();
  };

  const toggleExpanded = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const getPartialValue = (invoices: GroupInvoice[]) =>
    invoices.reduce((sum, inv) => sum + inv.total_value * 0.30, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">AG Nota</h2>
        <Button onClick={() => setNewGroupDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Grupo
        </Button>
      </div>

      {groups.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum grupo criado ainda. Clique em "Novo Grupo" para começar.</p>
          </CardContent>
        </Card>
      )}

      {groups.map(group => {
        const partialValue = getPartialValue(group.invoices);
        const balance = group.total_value - partialValue;

        return (
          <Card key={group.id} className={group.is_completed ? "opacity-60" : ""}>
            <Collapsible open={expandedGroups.has(group.id)} onOpenChange={() => toggleExpanded(group.id)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        {expandedGroups.has(group.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                    {editingGroupId === group.id ? (
                      <div className="flex gap-2 items-center flex-1">
                        <Input value={editGroupName} onChange={e => setEditGroupName(e.target.value)} className="max-w-[200px]" />
                        <Input type="number" step="0.01" value={editGroupTotal} onChange={e => setEditGroupTotal(e.target.value)} className="max-w-[150px]" placeholder="Valor total" />
                        <Button size="icon" variant="ghost" onClick={() => saveEditGroup(group.id)}><Save className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditingGroupId(null)}><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {group.name}
                          {group.is_completed && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Concluído</span>}
                        </CardTitle>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEditGroup(group)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => toggleComplete(group)} title={group.is_completed ? "Reabrir" : "Concluir"}>
                      <CheckCircle className={`h-4 w-4 ${group.is_completed ? "text-green-600" : ""}`} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteGroup(group.id)} title="Excluir">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* Summary row */}
                <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Valor Total:</span>
                    <span className="ml-2 font-bold">€ {group.total_value.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valor Parcial (30%):</span>
                    <span className="ml-2 font-bold text-primary">€ {partialValue.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Saldo:</span>
                    <span className={`ml-2 font-bold ${balance > 0 ? "text-destructive" : "text-green-600"}`}>
                      € {balance.toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CollapsibleContent>
                <CardContent className="pt-2">
                  {/* Add invoice section */}
                  <div className="mb-4 p-3 border rounded-lg bg-muted/30">
                    <div className="flex gap-2 items-center mb-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Pesquisar número da nota..."
                        value={addInvoiceGroupId === group.id ? searchQuery : ""}
                        onFocus={() => setAddInvoiceGroupId(group.id)}
                        onChange={e => {
                          setAddInvoiceGroupId(group.id);
                          searchInvoices(e.target.value);
                        }}
                        className="flex-1"
                      />
                    </div>
                    {addInvoiceGroupId === group.id && searchResults.length > 0 && (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {searchResults.map(inv => (
                          <div key={inv.id} className="flex justify-between items-center p-2 hover:bg-muted rounded text-sm cursor-pointer" onClick={() => addInvoiceToGroup(group.id, inv.id)}>
                            <span>Nota {inv.invoice_number}</span>
                            <span className="font-medium">€ {Number(inv.total_value).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Invoices list */}
                  {group.invoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma nota adicionada</p>
                  ) : (
                    <div className="space-y-2">
                      {group.invoices.map(inv => (
                        <div key={inv.id} className="flex justify-between items-center p-2 border rounded">
                          <div className="text-sm">
                            <span className="font-medium">Nota {inv.invoice_number}</span>
                            <span className="text-muted-foreground ml-2">€ {inv.total_value.toFixed(2)}</span>
                            <span className="text-muted-foreground ml-2 text-xs">(30%: € {(inv.total_value * 0.30).toFixed(2)})</span>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => removeInvoiceFromGroup(inv.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}

                      <div className="border-t pt-2 mt-2 flex justify-between text-sm font-bold">
                        <span>Total Notas (30%):</span>
                        <span className="text-primary">€ {partialValue.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}

      {/* New Group Dialog */}
      <Dialog open={newGroupDialogOpen} onOpenChange={setNewGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Grupo</Label>
              <Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Ex: Cliente X - Janeiro" />
            </div>
            <div className="space-y-2">
              <Label>Valor Total do Grupo</Label>
              <Input type="number" step="0.01" value={newGroupTotal} onChange={e => setNewGroupTotal(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewGroupDialogOpen(false)}>Cancelar</Button>
            <Button onClick={createGroup}>Criar Grupo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgrupamentoNotas;
