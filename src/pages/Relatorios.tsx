import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, Euro, Download, Phone, User, CreditCard, Calendar, ChevronRight } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ReportData {
  totalInvoiceValue: number;
  totalInvoiceCount: number;
  totalManualValue: number;
  totalManualCount: number;
  itemCount: number;
  items: Array<{
    date: string;
    description: string;
    value: number;
    invoiceNumber: string;
    contactName: string | null;
    phoneNumber: string | null;
  }>;
  invoices: Array<{
    id: string;
    invoice_number: string;
    delivery_date: string;
    total_value: number;
    contact_name: string | null;
    phone_number: string | null;
    invoice_items: any[];
  }>;
  revenues?: Array<{
    id: string;
    revenue_date: string;
    amount: number;
    description: string | null;
    reference_month: string | null;
  }>;
  debts?: Array<{
    id: string;
    debt_date: string;
    amount: number;
    description: string | null;
  }>;
}

interface PaymentReportData {
  referenceMonth: string;
  invoicesTotal: number;
  projectedEarnings: number;
  debtsTotal: number;
  totalToReceive: number;
  payments: Array<{
    id: string;
    revenue_date: string;
    amount: number;
    description: string | null;
  }>;
  totalPaid: number;
  balance: number;
}

type ReportType = "complete" | "number-value" | "value-only" | "number-items-value" | "contacts" | "payments" | "payments-by-month";

const Relatorios = () => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [paymentReportData, setPaymentReportData] = useState<PaymentReportData | null>(null);
  const [selectedReportType, setSelectedReportType] = useState<ReportType | null>(null);
  const [showReportSelector, setShowReportSelector] = useState(true);
  const [paymentMonthDialogOpen, setPaymentMonthDialogOpen] = useState(false);
  const [paymentMonth, setPaymentMonth] = useState<string>("");
  const [paymentYear, setPaymentYear] = useState<string>(new Date().getFullYear().toString());
  const { toast } = useToast();

  const months = [
    { value: "01", label: "Janeiro" },
    { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" },
    { value: "04", label: "Abril" },
    { value: "05", label: "Maio" },
    { value: "06", label: "Junho" },
    { value: "07", label: "Julho" },
    { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" },
    { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" },
    { value: "12", label: "Dezembro" },
  ];

  const years = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - i).toString());

  const generatePaymentByMonthReport = async () => {
    if (!paymentMonth || !paymentYear) {
      toast({
        title: "Erro",
        description: "Por favor, selecione o mês e ano de referência",
        variant: "destructive",
      });
      return;
    }

    try {
      const referenceMonth = `${paymentYear}-${paymentMonth}`;
      const monthStart = startOfMonth(new Date(parseInt(paymentYear), parseInt(paymentMonth) - 1));
      const monthEnd = endOfMonth(new Date(parseInt(paymentYear), parseInt(paymentMonth) - 1));

      // Fetch invoices for the reference month
      const { data: invoices, error: invoiceError } = await supabase
        .from("invoices")
        .select("total_value")
        .eq("is_validated", true)
        .gte("delivery_date", format(monthStart, "yyyy-MM-dd"))
        .lte("delivery_date", format(monthEnd, "yyyy-MM-dd"));

      if (invoiceError) throw invoiceError;

      // Fetch debts for the reference month
      const { data: debts, error: debtError } = await supabase
        .from("corte_cose_debts")
        .select("amount")
        .gte("debt_date", format(monthStart, "yyyy-MM-dd"))
        .lte("debt_date", format(monthEnd, "yyyy-MM-dd"));

      if (debtError) throw debtError;

      // Fetch ALL payments that have this reference month (even if paid in later months)
      const { data: payments, error: paymentError } = await supabase
        .from("revenues")
        .select("*")
        .eq("reference_month", referenceMonth)
        .order("revenue_date", { ascending: true });

      if (paymentError) throw paymentError;

      const invoicesTotal = invoices?.reduce((sum, inv) => sum + Number(inv.total_value), 0) || 0;
      const projectedEarnings = invoicesTotal * 0.30;
      const debtsTotal = debts?.reduce((sum, d) => sum + Number(d.amount), 0) || 0;
      const totalToReceive = projectedEarnings + debtsTotal;
      const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const balance = totalToReceive - totalPaid;

      setPaymentReportData({
        referenceMonth,
        invoicesTotal,
        projectedEarnings,
        debtsTotal,
        totalToReceive,
        payments: payments || [],
        totalPaid,
        balance,
      });

      setPaymentMonthDialogOpen(false);
      setShowReportSelector(false);

      toast({
        title: "Sucesso",
        description: "Relatório de pagamentos gerado com sucesso",
      });
    } catch (error) {
      console.error('Error generating payment report:', error);
      toast({
        title: "Erro",
        description: "Falha ao gerar relatório de pagamentos",
        variant: "destructive",
      });
    }
  };

  const generateReport = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Erro",
        description: "Por favor, selecione as datas inicial e final",
        variant: "destructive",
      });
      return;
    }

    try {
      // Fetch invoices
      const { data: invoices, error } = await supabase
        .from("invoices")
        .select("*, invoice_items(*)")
        .eq("is_validated", true)
        .gte("delivery_date", startDate)
        .lte("delivery_date", endDate)
        .order("delivery_date", { ascending: false });

      if (error) throw error;

      // Fetch revenues for the period
      const { data: revenues, error: revenueError } = await supabase
        .from("revenues")
        .select("*")
        .gte("revenue_date", startDate)
        .lte("revenue_date", endDate)
        .order("revenue_date", { ascending: true });

      if (revenueError) throw revenueError;

      // Fetch debts for the period
      const { data: debts, error: debtError } = await supabase
        .from("corte_cose_debts")
        .select("*")
        .gte("debt_date", startDate)
        .lte("debt_date", endDate)
        .order("debt_date", { ascending: true });

      if (debtError) throw debtError;

      if (!invoices) {
        setReportData({
          totalInvoiceValue: 0,
          totalInvoiceCount: 0,
          totalManualValue: 0,
          totalManualCount: 0,
          itemCount: 0,
          items: [],
          invoices: [],
          revenues: revenues || [],
          debts: debts || [],
        });
        return;
      }

      const regularInvoices = invoices.filter(inv => !inv.is_manual_entry);
      const manualEntries = invoices.filter(inv => inv.is_manual_entry);

      const totalInvoiceValue = regularInvoices.reduce(
        (sum, inv) => sum + Number(inv.total_value),
        0
      );
      const totalManualValue = manualEntries.reduce(
        (sum, inv) => sum + Number(inv.total_value),
        0
      );

      const allItems = invoices.flatMap(inv =>
        inv.invoice_items.map(item => ({
          date: format(new Date(inv.delivery_date), "dd/MM/yyyy"),
          description: item.description,
          value: Number(item.value),
          invoiceNumber: inv.invoice_number,
          contactName: inv.contact_name,
          phoneNumber: inv.phone_number,
        }))
      );

      setReportData({
        totalInvoiceValue,
        totalInvoiceCount: regularInvoices.length,
        totalManualValue,
        totalManualCount: manualEntries.length,
        itemCount: allItems.length,
        items: allItems,
        invoices,
        revenues: revenues || [],
        debts: debts || [],
      });

      setShowReportSelector(false);

      toast({
        title: "Sucesso",
        description: "Relatório gerado com sucesso",
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Erro",
        description: "Falha ao gerar relatório",
        variant: "destructive",
      });
    }
  };

  const setMonthlyReport = () => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    setStartDate(format(start, "yyyy-MM-dd"));
    setEndDate(format(end, "yyyy-MM-dd"));
  };

  const setWeeklyReport = () => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    setStartDate(format(start, "yyyy-MM-dd"));
    setEndDate(format(end, "yyyy-MM-dd"));
  };

  const exportToPDF = () => {
    if (!reportData && !paymentReportData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    if (selectedReportType === "payments-by-month" && paymentReportData) {
      const monthLabel = months.find(m => m.value === paymentReportData.referenceMonth.split('-')[1])?.label || "";
      const year = paymentReportData.referenceMonth.split('-')[0];

      doc.setFontSize(18);
      doc.text("Relatório de Pagamentos por Mês", pageWidth / 2, 20, { align: "center" });
      
      doc.setFontSize(12);
      doc.text(`Mês de Referência: ${monthLabel} ${year}`, pageWidth / 2, 30, { align: "center" });
      
      doc.setFontSize(10);
      doc.text(`Total em Notas: € ${paymentReportData.invoicesTotal.toFixed(2)}`, 14, 45);
      doc.text(`Projeção de Ganho (30%): € ${paymentReportData.projectedEarnings.toFixed(2)}`, 14, 52);
      doc.text(`Dívida Corte & Cose: € ${paymentReportData.debtsTotal.toFixed(2)}`, 14, 59);
      doc.text(`Total a Receber: € ${paymentReportData.totalToReceive.toFixed(2)}`, 14, 66);
      doc.text(`Total Pago: € ${paymentReportData.totalPaid.toFixed(2)}`, 14, 73);
      doc.text(`Saldo Pendente: € ${paymentReportData.balance.toFixed(2)}`, 14, 80);

      const tableData = paymentReportData.payments.map(p => [
        format(new Date(p.revenue_date), "dd/MM/yyyy"),
        `€ ${Number(p.amount).toFixed(2)}`,
        p.description || "-",
      ]);

      autoTable(doc, {
        head: [["Data do Pagamento", "Valor", "Descrição"]],
        body: tableData,
        startY: 90,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 66, 66] },
      });

      const finalY = (doc as any).lastAutoTable.finalY || 90;
      doc.setFontSize(8);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, finalY + 10);

      doc.save(`relatorio_pagamentos_${paymentReportData.referenceMonth}.pdf`);
    } else if (reportData) {
      doc.setFontSize(18);
      doc.text("Relatório de Notas Fiscais", pageWidth / 2, 20, { align: "center" });
      
      doc.setFontSize(12);
      doc.text(`Período: ${format(new Date(startDate), "dd/MM/yyyy")} a ${format(new Date(endDate), "dd/MM/yyyy")}`, pageWidth / 2, 30, { align: "center" });
      
      doc.setFontSize(10);
      doc.text(`Total de Notas: ${reportData.totalInvoiceCount + reportData.totalManualCount}`, 14, 45);
      doc.text(`Valor Total: € ${(reportData.totalInvoiceValue + reportData.totalManualValue).toFixed(2)}`, 14, 52);

      let tableData: any[] = [];
      let columns: string[] = [];

      switch (selectedReportType) {
        case "complete":
          columns = ["Data", "Nº Nota", "Descrição", "Valor", "Contacto", "Telefone"];
          tableData = reportData.items.map(item => [
            item.date,
            item.invoiceNumber,
            item.description,
            `€ ${item.value.toFixed(2)}`,
            item.contactName || "-",
            item.phoneNumber || "-",
          ]);
          break;
        case "number-value":
          columns = ["Nº Nota", "Data", "Valor Total"];
          tableData = reportData.invoices.map(inv => [
            inv.invoice_number,
            format(new Date(inv.delivery_date), "dd/MM/yyyy"),
            `€ ${Number(inv.total_value).toFixed(2)}`,
          ]);
          break;
        case "value-only":
          columns = ["Data", "Valor"];
          tableData = reportData.invoices.map(inv => [
            format(new Date(inv.delivery_date), "dd/MM/yyyy"),
            `€ ${Number(inv.total_value).toFixed(2)}`,
          ]);
          break;
        case "number-items-value":
          columns = ["Nº Nota", "Item", "Valor Item", "Total Nota"];
          reportData.invoices.forEach(inv => {
            inv.invoice_items.forEach((item, idx) => {
              tableData.push([
                idx === 0 ? inv.invoice_number : "",
                item.description,
                `€ ${Number(item.value).toFixed(2)}`,
                idx === 0 ? `€ ${Number(inv.total_value).toFixed(2)}` : "",
              ]);
            });
          });
          break;
        case "contacts":
          columns = ["Nº Nota", "Nome", "Telefone", "Data", "Valor"];
          tableData = reportData.invoices
            .filter(inv => inv.contact_name || inv.phone_number)
            .map(inv => [
              inv.invoice_number,
              inv.contact_name || "-",
              inv.phone_number || "-",
              format(new Date(inv.delivery_date), "dd/MM/yyyy"),
              `€ ${Number(inv.total_value).toFixed(2)}`,
            ]);
          break;
        case "payments":
          {
            const totalValue = reportData.totalInvoiceValue + reportData.totalManualValue;
            const projectedEarnings = totalValue * 0.30;
            const totalDebt = (reportData.debts || []).reduce((sum, d) => sum + Number(d.amount), 0);
            const totalRevenues = (reportData.revenues || []).reduce((sum, r) => sum + Number(r.amount), 0);
            
            doc.text(`Projeção de Ganho (30%): € ${projectedEarnings.toFixed(2)}`, 14, 59);
            doc.text(`Total Dívida Corte & Cose: € ${totalDebt.toFixed(2)}`, 14, 66);
            doc.text(`Total a Receber: € ${(projectedEarnings + totalDebt).toFixed(2)}`, 14, 73);
            doc.text(`Total Pago: € ${totalRevenues.toFixed(2)}`, 14, 80);
            doc.text(`Saldo: € ${(projectedEarnings + totalDebt - totalRevenues).toFixed(2)}`, 14, 87);
            
            columns = ["Data", "Valor", "Mês Ref.", "Descrição"];
            tableData = (reportData.revenues || []).map(rev => {
              const refMonth = rev.reference_month ? format(parseISO(rev.reference_month + "-01"), "MMM/yyyy", { locale: ptBR }) : "-";
              return [
                format(new Date(rev.revenue_date), "dd/MM/yyyy"),
                `€ ${Number(rev.amount).toFixed(2)}`,
                refMonth,
                rev.description || "-",
              ];
            });
          }
          break;
      }

      autoTable(doc, {
        head: [columns],
        body: tableData,
        startY: selectedReportType === "payments" ? 95 : 60,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 66, 66] },
      });

      const finalY = (doc as any).lastAutoTable.finalY || 60;
      doc.setFontSize(8);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, finalY + 10);

      doc.save(`relatorio_${selectedReportType}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    }
    
    toast({
      title: "Sucesso",
      description: "PDF exportado com sucesso",
    });
  };

  const reportTypes = [
    { id: "complete", label: "Completo", description: "Todos os dados incluindo itens", icon: FileText },
    { id: "number-value", label: "Nota + Valor", description: "Número da nota e valor total", icon: Euro },
    { id: "value-only", label: "Apenas Valores", description: "Somente valores por data", icon: Euro },
    { id: "number-items-value", label: "Nota + Itens", description: "Nota com detalhes dos itens", icon: FileText },
    { id: "contacts", label: "Contactos", description: "Relatório de telefones e nomes", icon: Phone },
    { id: "payments", label: "Pagamentos", description: "Projeção + Dívida e pagamentos do período", icon: CreditCard },
    { id: "payments-by-month", label: "Pagamentos por Mês", description: "Ver todos os pagamentos de um mês específico", icon: Calendar },
  ];

  const handleReportSelect = (reportId: ReportType) => {
    setSelectedReportType(reportId);
    setReportData(null);
    setPaymentReportData(null);
    
    if (reportId === "payments-by-month") {
      setPaymentMonthDialogOpen(true);
    }
  };

  const resetToSelector = () => {
    setShowReportSelector(true);
    setSelectedReportType(null);
    setReportData(null);
    setPaymentReportData(null);
    setStartDate("");
    setEndDate("");
  };

  const renderReportContent = () => {
    if (selectedReportType === "payments-by-month" && paymentReportData) {
      const monthLabel = months.find(m => m.value === paymentReportData.referenceMonth.split('-')[1])?.label || "";
      const year = paymentReportData.referenceMonth.split('-')[0];

      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">
              Pagamentos - {monthLabel} {year}
            </h3>
            <Button variant="outline" onClick={resetToSelector}>
              Voltar aos Relatórios
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Total em Notas</p>
                <p className="text-lg font-bold">€ {paymentReportData.invoicesTotal.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Projeção (30%)</p>
                <p className="text-lg font-bold text-primary">€ {paymentReportData.projectedEarnings.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Dívida C&C</p>
                <p className="text-lg font-bold text-destructive">€ {paymentReportData.debtsTotal.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Total a Receber</p>
                <p className="text-lg font-bold">€ {paymentReportData.totalToReceive.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Total Pago</p>
                <p className="text-lg font-bold text-green-600">€ {paymentReportData.totalPaid.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Saldo Pendente</p>
                <p className={`text-lg font-bold ${paymentReportData.balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  € {paymentReportData.balance.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Pagamentos Realizados</CardTitle>
              <CardDescription>
                Todos os pagamentos feitos para zerar o saldo de {monthLabel} {year}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {paymentReportData.payments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum pagamento registrado para este mês
                </p>
              ) : (
                <div className="space-y-2">
                  {paymentReportData.payments.map((payment) => (
                    <div key={payment.id} className="flex justify-between items-center p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">
                          {format(new Date(payment.revenue_date), "dd/MM/yyyy")}
                        </p>
                        {payment.description && (
                          <p className="text-sm text-muted-foreground">{payment.description}</p>
                        )}
                      </div>
                      <p className="font-bold text-green-600">€ {Number(payment.amount).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}

              <Button onClick={exportToPDF} className="w-full mt-4">
                <Download className="h-4 w-4 mr-2" />
                Exportar para PDF
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (!reportData) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">
            {reportTypes.find(r => r.id === selectedReportType)?.label}
          </h3>
          <Button variant="outline" onClick={resetToSelector}>
            Voltar aos Relatórios
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Notas Fiscais</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">€ {reportData.totalInvoiceValue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {reportData.totalInvoiceCount} nota(s) fiscal(is)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Entradas Manuais</CardTitle>
              <Plus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">€ {reportData.totalManualValue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {reportData.totalManualCount} entrada(s) manual(is)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Valor Total do Período</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                € {(reportData.totalInvoiceValue + reportData.totalManualValue).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {reportData.totalInvoiceCount + reportData.totalManualCount} registro(s) • {reportData.itemCount} itens
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Prévia do Relatório</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={exportToPDF} className="w-full mb-4">
              <Download className="h-4 w-4 mr-2" />
              Exportar para PDF
            </Button>

            <div className="border rounded-lg p-4 max-h-96 overflow-auto">
              {selectedReportType === "complete" && (
                <div className="space-y-2">
                  {reportData.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{item.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.date} • Nota: {item.invoiceNumber}
                        </p>
                        {(item.contactName || item.phoneNumber) && (
                          <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                            {item.contactName && <span className="flex items-center gap-1"><User className="h-3 w-3" />{item.contactName}</span>}
                            {item.phoneNumber && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{item.phoneNumber}</span>}
                          </p>
                        )}
                      </div>
                      <p className="font-bold text-accent">€ {item.value.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}

              {selectedReportType === "number-value" && (
                <div className="space-y-2">
                  {reportData.invoices.map((inv) => (
                    <div key={inv.id} className="flex justify-between items-center p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Nota: {inv.invoice_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(inv.delivery_date), "dd/MM/yyyy")}
                        </p>
                      </div>
                      <p className="font-bold text-accent">€ {Number(inv.total_value).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}

              {selectedReportType === "value-only" && (
                <div className="space-y-2">
                  {reportData.invoices.map((inv) => (
                    <div key={inv.id} className="flex justify-between items-center p-3 border rounded-lg">
                      <p className="text-muted-foreground">
                        {format(new Date(inv.delivery_date), "dd/MM/yyyy")}
                      </p>
                      <p className="font-bold text-accent">€ {Number(inv.total_value).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}

              {selectedReportType === "number-items-value" && (
                <div className="space-y-4">
                  {reportData.invoices.map((inv) => (
                    <div key={inv.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-bold">Nota: {inv.invoice_number}</p>
                        <p className="font-bold text-accent">€ {Number(inv.total_value).toFixed(2)}</p>
                      </div>
                      <div className="space-y-1">
                        {inv.invoice_items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{item.description}</span>
                            <span>€ {Number(item.value).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedReportType === "contacts" && (
                <div className="space-y-2">
                  {reportData.invoices
                    .filter(inv => inv.contact_name || inv.phone_number)
                    .map((inv) => (
                      <div key={inv.id} className="flex justify-between items-center p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">Nota: {inv.invoice_number}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {inv.contact_name && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />{inv.contact_name}
                              </span>
                            )}
                            {inv.phone_number && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />{inv.phone_number}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="font-bold text-accent">€ {Number(inv.total_value).toFixed(2)}</p>
                      </div>
                    ))}
                  {reportData.invoices.filter(inv => inv.contact_name || inv.phone_number).length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      Nenhum contacto encontrado no período
                    </p>
                  )}
                </div>
              )}

              {selectedReportType === "payments" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-muted rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground">Projeção (30%)</p>
                      <p className="font-bold text-primary">
                        € {((reportData.totalInvoiceValue + reportData.totalManualValue) * 0.30).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Dívida C&C</p>
                      <p className="font-bold text-destructive">
                        € {(reportData.debts || []).reduce((sum, d) => sum + Number(d.amount), 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total a Receber</p>
                      <p className="font-bold">
                        € {(((reportData.totalInvoiceValue + reportData.totalManualValue) * 0.30) + (reportData.debts || []).reduce((sum, d) => sum + Number(d.amount), 0)).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Pago</p>
                      <p className="font-bold text-green-600">
                        € {(reportData.revenues || []).reduce((sum, r) => sum + Number(r.amount), 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Saldo</p>
                      <p className="font-bold">
                        € {(((reportData.totalInvoiceValue + reportData.totalManualValue) * 0.30) + (reportData.debts || []).reduce((sum, d) => sum + Number(d.amount), 0) - (reportData.revenues || []).reduce((sum, r) => sum + Number(r.amount), 0)).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold">Pagamentos Recebidos</h4>
                    {(reportData.revenues || []).length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">
                        Nenhum pagamento registrado no período
                      </p>
                    ) : (
                      (reportData.revenues || []).map((rev) => (
                        <div key={rev.id} className="flex justify-between items-center p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">
                              {format(new Date(rev.revenue_date), "dd/MM/yyyy")}
                              {rev.reference_month && (
                                <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                  Ref: {format(parseISO(rev.reference_month + "-01"), "MMM/yyyy", { locale: ptBR })}
                                </span>
                              )}
                            </p>
                            {rev.description && (
                              <p className="text-sm text-muted-foreground">{rev.description}</p>
                            )}
                          </div>
                          <p className="font-bold text-green-600">€ {Number(rev.amount).toFixed(2)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {showReportSelector ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Selecione o Tipo de Relatório</CardTitle>
              <CardDescription>
                Escolha o relatório que deseja gerar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {reportTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <Card
                      key={type.id}
                      className={`cursor-pointer transition-all hover:border-primary ${
                        selectedReportType === type.id ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => handleReportSelect(type.id as ReportType)}
                    >
                      <CardContent className="flex items-center gap-4 p-4">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{type.label}</p>
                          <p className="text-sm text-muted-foreground">{type.description}</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {selectedReportType && selectedReportType !== "payments-by-month" && (
            <Card>
              <CardHeader>
                <CardTitle>Selecione o Período</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start-date">Data Inicial</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-date">Data Final</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={setMonthlyReport} variant="outline">
                    Mês Atual
                  </Button>
                  <Button onClick={setWeeklyReport} variant="outline">
                    Semana Atual
                  </Button>
                </div>

                <Button onClick={generateReport} className="w-full">
                  Gerar Relatório
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        renderReportContent()
      )}

      <Dialog open={paymentMonthDialogOpen} onOpenChange={setPaymentMonthDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecionar Mês de Referência</DialogTitle>
            <DialogDescription>
              Escolha o mês e ano para ver todos os pagamentos realizados para quitar o saldo desse período
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mês</Label>
                <Select value={paymentMonth} onValueChange={setPaymentMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ano</Label>
                <Select value={paymentYear} onValueChange={setPaymentYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={generatePaymentByMonthReport} className="w-full">
              Gerar Relatório
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Relatorios;
