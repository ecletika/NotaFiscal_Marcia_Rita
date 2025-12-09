import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Eye, Pencil, Trash2, Save, X, ChevronRight, Calendar, Phone, User, CheckCircle, Clock, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  delivery_date: string;
  total_value: number;
  image_url: string | null;
  is_manual_entry: boolean;
  is_validated: boolean;
  phone_number: string | null;
  contact_name: string | null;
  original_filename: string | null;
  invoice_items: any[];
}

interface YearMonth {
  year: number;
  months: number[];
}

const NotasFiscais = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [yearMonths, setYearMonths] = useState<YearMonth[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadPendingInvoices();
    loadYearMonths();
  }, []);

  useEffect(() => {
    if (selectedYear !== null && selectedMonth !== null) {
      loadInvoices();
    }
  }, [selectedYear, selectedMonth]);

  const loadPendingInvoices = async () => {
    const { data, error } = await supabase
      .from("invoices")
      .select("*, invoice_items(*)")
      .eq("is_validated", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error('Error loading pending invoices:', error);
      return;
    }

    setPendingInvoices(data || []);
  };

  const loadYearMonths = async () => {
    const { data, error } = await supabase
      .from("invoices")
      .select("delivery_date")
      .eq("is_validated", true)
      .order("delivery_date", { ascending: false });

    if (error) {
      console.error('Error loading year/months:', error);
      return;
    }

    const yearMonthMap = new Map<number, Set<number>>();
    
    data?.forEach(invoice => {
      const date = new Date(invoice.delivery_date);
      const year = date.getFullYear();
      const month = date.getMonth();
      
      if (!yearMonthMap.has(year)) {
        yearMonthMap.set(year, new Set());
      }
      yearMonthMap.get(year)!.add(month);
    });

    const result: YearMonth[] = [];
    yearMonthMap.forEach((months, year) => {
      result.push({
        year,
        months: Array.from(months).sort((a, b) => b - a),
      });
    });

    result.sort((a, b) => b.year - a.year);
    setYearMonths(result);
  };

  const loadInvoices = async () => {
    if (selectedYear === null || selectedMonth === null) return;

    const startDate = new Date(selectedYear, selectedMonth, 1);
    const endDate = new Date(selectedYear, selectedMonth + 1, 0);

    const { data, error } = await supabase
      .from("invoices")
      .select("*, invoice_items(*)")
      .eq("is_validated", true)
      .gte("delivery_date", format(startDate, "yyyy-MM-dd"))
      .lte("delivery_date", format(endDate, "yyyy-MM-dd"))
      .order("delivery_date", { ascending: false });

    if (error) {
      console.error('Error loading invoices:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar notas fiscais",
        variant: "destructive",
      });
    } else {
      setInvoices(data || []);
    }
  };

  const validateInvoice = async (invoiceId: string) => {
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ is_validated: true })
        .eq("id", invoiceId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Nota fiscal validada",
      });

      loadPendingInvoices();
      loadYearMonths();
    } catch (error) {
      console.error('Error validating invoice:', error);
      toast({
        title: "Erro",
        description: "Falha ao validar nota fiscal",
        variant: "destructive",
      });
    }
  };

  const startEditing = (invoice: Invoice) => {
    setEditingId(invoice.id);
    setEditData({
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      delivery_date: invoice.delivery_date,
      phone_number: invoice.phone_number || "",
      contact_name: invoice.contact_name || "",
      items: invoice.invoice_items.map(item => ({
        id: item.id,
        description: item.description,
        value: item.value,
      })),
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditData(null);
  };

  const saveEdit = async (invoiceId: string, isPending: boolean = false) => {
    try {
      const totalValue = editData.items.reduce(
        (sum: number, item: any) => sum + Number(item.value),
        0
      );

      await supabase
        .from("invoices")
        .update({
          invoice_number: editData.invoice_number,
          invoice_date: editData.invoice_date,
          delivery_date: editData.delivery_date,
          phone_number: editData.phone_number || null,
          contact_name: editData.contact_name || null,
          total_value: totalValue,
        })
        .eq("id", invoiceId);

      for (const item of editData.items) {
        await supabase
          .from("invoice_items")
          .update({
            description: item.description,
            value: item.value,
          })
          .eq("id", item.id);
      }

      toast({
        title: "Sucesso",
        description: "Nota fiscal atualizada",
      });

      setEditingId(null);
      setEditData(null);
      
      if (isPending) {
        loadPendingInvoices();
      } else {
        loadInvoices();
      }
    } catch (error) {
      console.error('Error saving edit:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar nota fiscal",
        variant: "destructive",
      });
    }
  };

  const deleteInvoice = async (invoiceId: string, isPending: boolean = false) => {
    if (!confirm("Tem certeza que deseja excluir esta nota fiscal?")) return;

    try {
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", invoiceId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Nota fiscal excluída",
      });

      if (isPending) {
        loadPendingInvoices();
      } else {
        loadInvoices();
        loadYearMonths();
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast({
        title: "Erro",
        description: "Falha ao excluir nota fiscal",
        variant: "destructive",
      });
    }
  };

  const addNewItem = () => {
    setEditData({
      ...editData,
      items: [
        ...editData.items,
        { id: `new-${Date.now()}`, description: "", value: 0 },
      ],
    });
  };

  const removeItem = (index: number) => {
    const newItems = editData.items.filter((_: any, i: number) => i !== index);
    setEditData({ ...editData, items: newItems });
  };

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const renderInvoiceCard = (invoice: Invoice, isPending: boolean) => (
    <Card key={invoice.id}>
      <CardContent className="pt-6">
        {editingId === invoice.id ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Número da Nota</Label>
                <Input
                  value={editData.invoice_number}
                  onChange={(e) =>
                    setEditData({ ...editData, invoice_number: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Data da Nota</Label>
                <Input
                  type="date"
                  value={editData.invoice_date}
                  onChange={(e) =>
                    setEditData({ ...editData, invoice_date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Entrega</Label>
                <Input
                  type="date"
                  value={editData.delivery_date}
                  onChange={(e) =>
                    setEditData({ ...editData, delivery_date: e.target.value })
                  }
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Nome do Contacto
                </Label>
                <Input
                  value={editData.contact_name}
                  onChange={(e) =>
                    setEditData({ ...editData, contact_name: e.target.value })
                  }
                  placeholder="Nome do cliente"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Telefone
                </Label>
                <Input
                  value={editData.phone_number}
                  onChange={(e) =>
                    setEditData({ ...editData, phone_number: e.target.value })
                  }
                  placeholder="Número de telefone"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Itens</Label>
              {editData.items.map((item: any, index: number) => (
                <div key={item.id} className="grid grid-cols-[1fr_auto_auto] gap-2">
                  <Input
                    value={item.description}
                    onChange={(e) => {
                      const newItems = [...editData.items];
                      newItems[index].description = e.target.value;
                      setEditData({ ...editData, items: newItems });
                    }}
                    placeholder="Descrição"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={item.value}
                    onChange={(e) => {
                      const newItems = [...editData.items];
                      newItems[index].value = e.target.value;
                      setEditData({ ...editData, items: newItems });
                    }}
                    placeholder="Valor"
                    className="w-32"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(index)}
                    disabled={editData.items.length <= 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addNewItem}>
                + Adicionar Item
              </Button>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => saveEdit(invoice.id, isPending)}>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
              <Button variant="outline" onClick={cancelEditing}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="font-bold text-lg">Nota: {invoice.invoice_number}</p>
                {(invoice.original_filename || invoice.image_url) && (
                  <p className="text-xs text-muted-foreground">
                    Arquivo: {invoice.original_filename || invoice.image_url?.split('/').pop()}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Entrega: {format(new Date(invoice.delivery_date), "dd/MM/yyyy")}
                </p>
                {invoice.contact_name && (
                  <p className="text-sm flex items-center gap-1 mt-1">
                    <User className="h-3 w-3" />
                    {invoice.contact_name}
                  </p>
                )}
                {invoice.phone_number && (
                  <p className="text-sm flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {invoice.phone_number}
                  </p>
                )}
                {invoice.is_manual_entry && (
                  <span className="text-xs bg-secondary px-2 py-1 rounded mt-1 inline-block">
                    Entrada Manual
                  </span>
                )}
              </div>
              <p className="text-xl font-bold text-accent">
                € {Number(invoice.total_value).toFixed(2)}
              </p>
            </div>

            <div className="space-y-2 mb-4">
              {invoice.invoice_items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.description}</span>
                  <span>€ {Number(item.value).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 flex-wrap">
              {invoice.image_url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingImage(invoice.image_url)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Ver Foto
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => startEditing(invoice)}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Button>
              {isPending && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => validateInvoice(invoice.id)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Validar
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteInvoice(invoice.id, isPending)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pendente de Validação
            {pendingInvoices.length > 0 && (
              <span className="bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full">
                {pendingInvoices.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="validated" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Validadas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {pendingInvoices.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhuma nota fiscal pendente de validação
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingInvoices.map((invoice) => renderInvoiceCard(invoice, true))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="validated" className="mt-4">
          <div className="flex gap-6">
            {/* Sidebar Navigation */}
            <Card className="w-64 shrink-0 h-fit sticky top-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Navegar por Data
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                {yearMonths.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-2">Nenhuma nota validada encontrada</p>
                ) : (
                  <div className="space-y-1">
                    {yearMonths.map((ym) => (
                      <Collapsible key={ym.year}>
                        <CollapsibleTrigger asChild>
                          <Button
                            variant={selectedYear === ym.year ? "secondary" : "ghost"}
                            className="w-full justify-between"
                            onClick={() => {
                              setSelectedYear(selectedYear === ym.year ? null : ym.year);
                              setSelectedMonth(null);
                              setInvoices([]);
                            }}
                          >
                            <span className="font-semibold">{ym.year}</span>
                            <ChevronRight className={`h-4 w-4 transition-transform ${selectedYear === ym.year ? 'rotate-90' : ''}`} />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          {selectedYear === ym.year && (
                            <div className="ml-4 space-y-1 mt-1">
                              {ym.months.map((month) => (
                                <Button
                                  key={month}
                                  variant={selectedMonth === month ? "default" : "ghost"}
                                  size="sm"
                                  className="w-full justify-start"
                                  onClick={() => setSelectedMonth(month)}
                                >
                                  {monthNames[month]}
                                </Button>
                              ))}
                            </div>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Main Content */}
            <div className="flex-1 space-y-4">
              {selectedYear !== null && selectedMonth !== null ? (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-2xl font-bold">
                      {monthNames[selectedMonth]} {selectedYear}
                    </h2>
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Pesquisar nº da nota..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  {invoices.filter(inv => 
                    searchQuery === "" || 
                    inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase())
                  ).length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        {searchQuery ? "Nenhuma nota encontrada com este número" : "Nenhuma nota fiscal encontrada para este período"}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {invoices
                        .filter(inv => 
                          searchQuery === "" || 
                          inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .map((invoice) => renderInvoiceCard(invoice, false))}
                    </div>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Selecione um ano e mês no menu lateral para visualizar as notas fiscais
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Imagem da Nota Fiscal</DialogTitle>
          </DialogHeader>
          {viewingImage && (
            <img src={viewingImage} alt="Nota Fiscal" className="w-full" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NotasFiscais;
