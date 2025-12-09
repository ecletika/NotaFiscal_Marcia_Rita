import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Euro, Plus, Trash2, MoreHorizontal, AlertTriangle, Pencil } from "lucide-react";
import { format, getDaysInMonth, startOfMonth, getDay } from "date-fns";

interface Revenue {
  id: string;
  revenue_date: string;
  amount: number;
  description: string | null;
  reference_month: string | null;
}

interface CorteCoseDebt {
  id: string;
  debt_date: string;
  amount: number;
  description: string | null;
}

const Receitas = () => {
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [debts, setDebts] = useState<CorteCoseDebt[]>([]);
  const [revenueDate, setRevenueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [referenceMonth, setReferenceMonth] = useState("");
  const [debtDate, setDebtDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [debtAmount, setDebtAmount] = useState("");
  const [debtDescription, setDebtDescription] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  
  // Edit states
  const [editingRevenue, setEditingRevenue] = useState<Revenue | null>(null);
  const [editingDebt, setEditingDebt] = useState<CorteCoseDebt | null>(null);
  const [editRevenueDate, setEditRevenueDate] = useState("");
  const [editRevenueAmount, setEditRevenueAmount] = useState("");
  const [editRevenueDescription, setEditRevenueDescription] = useState("");
  const [editRevenueReferenceMonth, setEditRevenueReferenceMonth] = useState("");
  const [editDebtDate, setEditDebtDate] = useState("");
  const [editDebtAmount, setEditDebtAmount] = useState("");
  const [editDebtDescription, setEditDebtDescription] = useState("");
  
  const { toast } = useToast();

  useEffect(() => {
    fetchRevenues();
    fetchDebts();
  }, []);

  const fetchRevenues = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("revenues")
        .select("*")
        .eq("user_id", user.id)
        .order("revenue_date", { ascending: false });

      if (error) throw error;
      setRevenues(data || []);
    } catch (error) {
      console.error("Error fetching revenues:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar receitas",
        variant: "destructive",
      });
    }
  };

  const fetchDebts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("corte_cose_debts")
        .select("*")
        .eq("user_id", user.id)
        .order("debt_date", { ascending: false });

      if (error) throw error;
      setDebts(data || []);
    } catch (error) {
      console.error("Error fetching debts:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dívidas",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!revenueDate || !amount) {
      toast({
        title: "Erro",
        description: "Por favor, preencha a data e o valor",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("revenues").insert({
        user_id: user.id,
        revenue_date: revenueDate,
        amount: parseFloat(amount),
        description: description || null,
        reference_month: referenceMonth || null,
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Receita adicionada com sucesso",
      });

      setRevenueDate(format(new Date(), "yyyy-MM-dd"));
      setAmount("");
      setDescription("");
      setReferenceMonth("");
      fetchRevenues();
    } catch (error) {
      console.error("Error adding revenue:", error);
      toast({
        title: "Erro",
        description: "Falha ao adicionar receita",
        variant: "destructive",
      });
    }
  };

  const handleDebtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!debtDate || !debtAmount) {
      toast({
        title: "Erro",
        description: "Por favor, preencha a data e o valor da dívida",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("corte_cose_debts").insert({
        user_id: user.id,
        debt_date: debtDate,
        amount: parseFloat(debtAmount),
        description: debtDescription || null,
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Dívida Corte & Cose adicionada com sucesso",
      });

      setDebtDate(format(new Date(), "yyyy-MM-dd"));
      setDebtAmount("");
      setDebtDescription("");
      fetchDebts();
    } catch (error) {
      console.error("Error adding debt:", error);
      toast({
        title: "Erro",
        description: "Falha ao adicionar dívida",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("revenues").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Receita removida com sucesso",
      });

      fetchRevenues();
    } catch (error) {
      console.error("Error deleting revenue:", error);
      toast({
        title: "Erro",
        description: "Falha ao remover receita",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDebt = async (id: string) => {
    try {
      const { error } = await supabase.from("corte_cose_debts").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Dívida removida com sucesso",
      });

      fetchDebts();
    } catch (error) {
      console.error("Error deleting debt:", error);
      toast({
        title: "Erro",
        description: "Falha ao remover dívida",
        variant: "destructive",
      });
    }
  };

  const openEditRevenue = (revenue: Revenue) => {
    setEditingRevenue(revenue);
    setEditRevenueDate(revenue.revenue_date);
    setEditRevenueAmount(revenue.amount.toString());
    setEditRevenueDescription(revenue.description || "");
    setEditRevenueReferenceMonth(revenue.reference_month || "");
  };

  const openEditDebt = (debt: CorteCoseDebt) => {
    setEditingDebt(debt);
    setEditDebtDate(debt.debt_date);
    setEditDebtAmount(debt.amount.toString());
    setEditDebtDescription(debt.description || "");
  };

  const handleUpdateRevenue = async () => {
    if (!editingRevenue || !editRevenueDate || !editRevenueAmount) {
      toast({
        title: "Erro",
        description: "Por favor, preencha a data e o valor",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("revenues")
        .update({
          revenue_date: editRevenueDate,
          amount: parseFloat(editRevenueAmount),
          description: editRevenueDescription || null,
          reference_month: editRevenueReferenceMonth || null,
        })
        .eq("id", editingRevenue.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Receita atualizada com sucesso",
      });

      setEditingRevenue(null);
      fetchRevenues();
    } catch (error) {
      console.error("Error updating revenue:", error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar receita",
        variant: "destructive",
      });
    }
  };

  const handleUpdateDebt = async () => {
    if (!editingDebt || !editDebtDate || !editDebtAmount) {
      toast({
        title: "Erro",
        description: "Por favor, preencha a data e o valor",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("corte_cose_debts")
        .update({
          debt_date: editDebtDate,
          amount: parseFloat(editDebtAmount),
          description: editDebtDescription || null,
        })
        .eq("id", editingDebt.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Dívida atualizada com sucesso",
      });

      setEditingDebt(null);
      fetchDebts();
    } catch (error) {
      console.error("Error updating debt:", error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar dívida",
        variant: "destructive",
      });
    }
  };

  const getRevenuesByDate = (date: string) => {
    return revenues.filter((rev) => rev.revenue_date === date);
  };

  const getDebtsByDate = (date: string) => {
    return debts.filter((debt) => debt.debt_date === date);
  };

  const generateCalendarDays = () => {
    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    const daysInMonth = getDaysInMonth(new Date(year, month));
    const firstDayOfMonth = startOfMonth(new Date(year, month));
    const startingDayOfWeek = getDay(firstDayOfMonth);
    
    const days = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add actual days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const years = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - 5 + i).toString());

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Adicionar Receita */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Euro className="h-5 w-5 text-primary" />
              Adicionar Receita
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="revenue-date">Data</Label>
                  <Input
                    id="revenue-date"
                    type="date"
                    value={revenueDate}
                    onChange={(e) => setRevenueDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Valor Recebido (€)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference-month">Mês de Referência (para abater dívida)</Label>
              <Select value={referenceMonth || "none"} onValueChange={(val) => setReferenceMonth(val === "none" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o mês (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {Array.from({ length: 12 }, (_, i) => {
                      const year = new Date().getFullYear();
                      return (
                        <>
                          <SelectItem key={`${year}-${i}`} value={`${year}-${String(i + 1).padStart(2, '0')}`}>
                            {months[i]} {year}
                          </SelectItem>
                          <SelectItem key={`${year - 1}-${i}`} value={`${year - 1}-${String(i + 1).padStart(2, '0')}`}>
                            {months[i]} {year - 1}
                          </SelectItem>
                        </>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição (Opcional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Adicione uma descrição..."
                />
              </div>

              <Button type="submit" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Receita
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Adicionar Dívida Corte & Cose */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Adicionar Dívida Corte & Cose
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleDebtSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="debt-date">Data</Label>
                  <Input
                    id="debt-date"
                    type="date"
                    value={debtDate}
                    onChange={(e) => setDebtDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="debt-amount">Valor (€)</Label>
                  <Input
                    id="debt-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={debtAmount}
                    onChange={(e) => setDebtAmount(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="debt-description">Descrição (Opcional)</Label>
                <Textarea
                  id="debt-description"
                  value={debtDescription}
                  onChange={(e) => setDebtDescription(e.target.value)}
                  placeholder="Adicione uma descrição..."
                />
              </div>

              <Button type="submit" variant="destructive" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Dívida Corte & Cose
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtrar por Mês</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Mês</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Ano</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o ano" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Calendário de Receitas - {months[parseInt(selectedMonth)]} {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full">
            {/* Calendar header */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                <div key={day} className="text-center font-semibold text-sm text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-2">
              {generateCalendarDays().map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }
                
                const dateStr = `${selectedYear}-${String(parseInt(selectedMonth) + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayRevenues = getRevenuesByDate(dateStr);
                const dayDebts = getDebtsByDate(dateStr);
                const allEntries = [...dayRevenues.map(r => ({ ...r, type: 'revenue' as const })), ...dayDebts.map(d => ({ ...d, type: 'debt' as const, revenue_date: d.debt_date }))];
                const displayEntries = allEntries.slice(0, 3);
                const extraCount = allEntries.length - 3;
                
                return (
                  <div
                    key={day}
                    className="aspect-square border rounded-lg p-2 bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="font-semibold text-sm mb-1">{day}</div>
                    <div className="space-y-1">
                      {displayEntries.map((entry) => (
                        <button
                          key={entry.id}
                          onClick={() => entry.type === 'debt' 
                            ? openEditDebt(debts.find(d => d.id === entry.id)!) 
                            : openEditRevenue(revenues.find(r => r.id === entry.id)!)
                          }
                          className={`w-full text-xs rounded px-1 py-0.5 truncate flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity ${
                            entry.type === 'debt' 
                              ? 'bg-destructive/10 text-destructive' 
                              : 'bg-primary/10 text-primary'
                          }`}
                        >
                          {entry.type === 'debt' ? (
                            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                          ) : (
                            <Euro className="h-3 w-3 flex-shrink-0" />
                          )}
                          <span className="truncate">€{Number(entry.amount).toFixed(0)}</span>
                        </button>
                      ))}
                      {extraCount > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-full text-xs hover:bg-primary/20"
                            >
                              <MoreHorizontal className="h-3 w-3 mr-1" />
                              +{extraCount}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80">
                            <ScrollArea className="h-[300px]">
                              <div className="space-y-2">
                                <h4 className="font-semibold mb-2">
                                  Entradas de {day}/{parseInt(selectedMonth) + 1}/{selectedYear}
                                </h4>
                                {dayRevenues.map((revenue) => (
                                  <div
                                    key={revenue.id}
                                    className="flex justify-between items-start p-2 border rounded-lg"
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <Euro className="h-4 w-4 text-primary" />
                                        <p className="font-bold">€ {Number(revenue.amount).toFixed(2)}</p>
                                      </div>
                                      {revenue.description && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {revenue.description}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex gap-1">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openEditRevenue(revenue)}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleDelete(revenue.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                                {dayDebts.map((debt) => (
                                  <div
                                    key={debt.id}
                                    className="flex justify-between items-start p-2 border border-destructive rounded-lg bg-destructive/5"
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 text-destructive" />
                                        <p className="font-bold text-destructive">€ {Number(debt.amount).toFixed(2)}</p>
                                        <span className="text-xs text-destructive">(Dívida)</span>
                                      </div>
                                      {debt.description && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {debt.description}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex gap-1">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openEditDebt(debt)}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleDeleteDebt(debt.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Revenue Dialog */}
      <Dialog open={!!editingRevenue} onOpenChange={(open) => !open && setEditingRevenue(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Euro className="h-5 w-5 text-primary" />
              Editar Receita
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-revenue-date">Data</Label>
                <Input
                  id="edit-revenue-date"
                  type="date"
                  value={editRevenueDate}
                  onChange={(e) => setEditRevenueDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-revenue-amount">Valor (€)</Label>
                <Input
                  id="edit-revenue-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editRevenueAmount}
                  onChange={(e) => setEditRevenueAmount(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-revenue-reference">Mês de Referência</Label>
              <Select value={editRevenueReferenceMonth || "none"} onValueChange={(val) => setEditRevenueReferenceMonth(val === "none" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o mês (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {Array.from({ length: 12 }, (_, i) => {
                    const year = new Date().getFullYear();
                    return (
                      <>
                        <SelectItem key={`edit-${year}-${i}`} value={`${year}-${String(i + 1).padStart(2, '0')}`}>
                          {months[i]} {year}
                        </SelectItem>
                        <SelectItem key={`edit-${year - 1}-${i}`} value={`${year - 1}-${String(i + 1).padStart(2, '0')}`}>
                          {months[i]} {year - 1}
                        </SelectItem>
                      </>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-revenue-description">Descrição (Opcional)</Label>
              <Textarea
                id="edit-revenue-description"
                value={editRevenueDescription}
                onChange={(e) => setEditRevenueDescription(e.target.value)}
                placeholder="Adicione uma descrição..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRevenue(null)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateRevenue}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Debt Dialog */}
      <Dialog open={!!editingDebt} onOpenChange={(open) => !open && setEditingDebt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Editar Dívida Corte & Cose
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-debt-date">Data</Label>
                <Input
                  id="edit-debt-date"
                  type="date"
                  value={editDebtDate}
                  onChange={(e) => setEditDebtDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-debt-amount">Valor (€)</Label>
                <Input
                  id="edit-debt-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editDebtAmount}
                  onChange={(e) => setEditDebtAmount(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-debt-description">Descrição (Opcional)</Label>
              <Textarea
                id="edit-debt-description"
                value={editDebtDescription}
                onChange={(e) => setEditDebtDescription(e.target.value)}
                placeholder="Adicione uma descrição..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDebt(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleUpdateDebt}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Receitas;
