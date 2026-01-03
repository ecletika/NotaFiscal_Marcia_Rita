import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Euro, FileText, Plus, TrendingUp, Gift, History } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

type PeriodType = "month" | "year";

const Dashboard = () => {
  const [period, setPeriod] = useState<PeriodType>("month");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [stats, setStats] = useState({
    totalValue: 0,
    invoiceCount: 0,
    manualEntryCount: 0,
    monthlyRevenue: 0,
    projectedEarnings: 0,
    balanceReceivable: 0,
    previousMonthBalance: 0,
    corteCoseBonus: 0,
  });
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [period, selectedMonth, selectedYear]);

  const loadDashboardData = async () => {
    let startDate: Date;
    let endDate: Date;

    if (period === "month") {
      startDate = startOfMonth(new Date(selectedYear, selectedMonth, 1));
      endDate = endOfMonth(new Date(selectedYear, selectedMonth, 1));
    } else {
      startDate = startOfYear(new Date(selectedYear, 0, 1));
      endDate = endOfYear(new Date(selectedYear, 0, 1));
    }

    const startDateStr = format(startDate, "yyyy-MM-dd");
    const endDateStr = format(endDate, "yyyy-MM-dd");

    // Calculate previous month dates
    const previousMonthDate = subMonths(new Date(selectedYear, selectedMonth, 1), 1);
    const prevMonthStart = startOfMonth(previousMonthDate);
    const prevMonthEnd = endOfMonth(previousMonthDate);
    const prevMonthStr = format(previousMonthDate, "yyyy-MM");

    // Load stats - only validated invoices
    const { data: invoices } = await supabase
      .from("invoices")
      .select("*, invoice_items(*)")
      .eq("is_validated", true)
      .gte("delivery_date", startDateStr)
      .lte("delivery_date", endDateStr);

    // Load revenues - need to get all revenues
    const { data: allRevenuesForPeriod } = await supabase
      .from("revenues")
      .select("amount, revenue_date, reference_month");

    // Calculate period string for reference_month matching (YYYY-MM format)
    const periodMonthStr = period === "month" 
      ? `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`
      : null;
    
    // Filter revenues: use reference_month if set, otherwise use revenue_date
    const revenues = allRevenuesForPeriod?.filter(rev => {
      if (rev.reference_month) {
        if (period === "month") {
          return rev.reference_month === periodMonthStr;
        } else {
          return rev.reference_month.startsWith(selectedYear.toString());
        }
      } else {
        const revDate = new Date(rev.revenue_date);
        if (period === "month") {
          return revDate.getMonth() === selectedMonth && revDate.getFullYear() === selectedYear;
        } else {
          return revDate.getFullYear() === selectedYear;
        }
      }
    }) || [];

    // Load Corte & Cose debts for selected period
    const { data: periodDebts } = await supabase
      .from("corte_cose_debts")
      .select("amount")
      .gte("debt_date", startDateStr)
      .lte("debt_date", endDateStr);

    // Load ALL Corte & Cose debts from beginning for accumulated balance
    const startingDate = new Date(2024, 0, 1);
    const { data: allDebts } = await supabase
      .from("corte_cose_debts")
      .select("amount")
      .gte("debt_date", startingDate.toISOString().split('T')[0])
      .lte("debt_date", endDateStr);

    // Load ALL invoices and revenues from beginning for accumulated calculations - only validated
    const { data: allInvoices } = await supabase
      .from("invoices")
      .select("total_value")
      .eq("is_validated", true)
      .gte("delivery_date", startingDate.toISOString().split('T')[0])
      .lte("delivery_date", endDateStr);

    // Load ALL data up to end of previous month for accumulated "Saldo do Mês Anterior"
    const { data: invoicesUpToPrevMonth } = await supabase
      .from("invoices")
      .select("total_value")
      .eq("is_validated", true)
      .gte("delivery_date", startingDate.toISOString().split('T')[0])
      .lte("delivery_date", format(prevMonthEnd, "yyyy-MM-dd"));

    // All debts up to end of previous month
    const { data: debtsUpToPrevMonth } = await supabase
      .from("corte_cose_debts")
      .select("amount")
      .gte("debt_date", startingDate.toISOString().split('T')[0])
      .lte("debt_date", format(prevMonthEnd, "yyyy-MM-dd"));

    // Filter all revenues up to end of previous month
    const revenuesUpToPrevMonth = allRevenuesForPeriod?.filter(rev => {
      const effectiveDate = rev.reference_month 
        ? new Date(rev.reference_month + '-01') 
        : new Date(rev.revenue_date);
      return effectiveDate >= startingDate && effectiveDate <= prevMonthEnd;
    }) || [];
    
    // Filter all revenues up to the end of selected period
    const allRevenues = allRevenuesForPeriod?.filter(rev => {
      const effectiveDate = rev.reference_month 
        ? new Date(rev.reference_month + '-01') 
        : new Date(rev.revenue_date);
      return effectiveDate >= startingDate && effectiveDate <= endDate;
    }) || [];

    if (invoices) {
      const totalValue = invoices.reduce((sum, inv) => sum + Number(inv.total_value), 0);
      const invoiceCount = invoices.filter(inv => !inv.is_manual_entry).length;
      const manualEntryCount = invoices.filter(inv => inv.is_manual_entry).length;

      const monthlyRevenue = revenues?.reduce((sum, rev) => sum + Number(rev.amount), 0) || 0;
      
      // Calculate projected earnings: 30% of total value
      const allInvoicesTotal = allInvoices?.reduce((sum, inv) => sum + Number(inv.total_value), 0) || 0;
      const allProjectedEarnings = allInvoicesTotal * 0.30;
      const allRevenuesTotal = allRevenues?.reduce((sum, rev) => sum + Number(rev.amount), 0) || 0;
      
      // Current period projection
      const periodTotal = invoices.reduce((sum, inv) => sum + Number(inv.total_value), 0);
      const projectedEarnings = periodTotal * 0.30;
      
      // Corte & Cose debt for current period
      const corteCoseDebt = periodDebts?.reduce((sum, debt) => sum + Number(debt.amount), 0) || 0;
      
      // Total accumulated Corte & Cose debt
      const allCorteCoseDebt = allDebts?.reduce((sum, debt) => sum + Number(debt.amount), 0) || 0;
      
      // Saldo a Receber Total = Projeção de Ganhos + Dívida Corte & Cose (acumulado) - Receitas
      const balanceReceivable = allProjectedEarnings + allCorteCoseDebt - allRevenuesTotal;
      
      // Calculate accumulated balance up to end of previous month
      const invoicesTotalUpToPrevMonth = invoicesUpToPrevMonth?.reduce((sum, inv) => sum + Number(inv.total_value), 0) || 0;
      const projectionUpToPrevMonth = invoicesTotalUpToPrevMonth * 0.30;
      const revenuesUpToPrevMonthTotal = revenuesUpToPrevMonth?.reduce((sum, rev) => sum + Number(rev.amount), 0) || 0;
      const debtsUpToPrevMonthTotal = debtsUpToPrevMonth?.reduce((sum, debt) => sum + Number(debt.amount), 0) || 0;
      // Saldo acumulado até o final do mês anterior (se negativo, mostrar 0)
      const previousMonthBalance = Math.max(0, projectionUpToPrevMonth + debtsUpToPrevMonthTotal - revenuesUpToPrevMonthTotal);

      setStats({
        totalValue,
        invoiceCount,
        manualEntryCount,
        monthlyRevenue,
        projectedEarnings,
        balanceReceivable,
        previousMonthBalance,
        corteCoseBonus: corteCoseDebt,
      });

      // Load chart data for month view (weekly)
      if (period === "month" && invoices) {
        const weeklyData = [];
        const currentDate = new Date(startDate);
        let weekNumber = 1;

        while (currentDate <= endDate) {
          const weekStart = new Date(currentDate);
          const weekEnd = new Date(currentDate);
          weekEnd.setDate(weekEnd.getDate() + 6);

          if (weekEnd > endDate) {
            weekEnd.setTime(endDate.getTime());
          }

          const weekInvoices = invoices.filter(inv => {
            const invDate = new Date(inv.delivery_date);
            return invDate >= weekStart && invDate <= weekEnd;
          });

          const weekTotal = weekInvoices.reduce((sum, inv) => sum + Number(inv.total_value), 0);
          
          weeklyData.push({
            week: `Semana ${weekNumber}`,
            value: weekTotal,
          });

          currentDate.setDate(currentDate.getDate() + 7);
          weekNumber++;
        }

        setChartData(weeklyData);
      }

      // Load chart data for year view (monthly)
      if (period === "year" && invoices) {
        const monthlyData = Array.from({ length: 12 }, (_, i) => {
          const monthInvoices = invoices.filter(inv => {
            const invDate = new Date(inv.delivery_date);
            return invDate.getMonth() === i && invDate.getFullYear() === selectedYear;
          });
          const monthTotal = monthInvoices.reduce((sum, inv) => sum + Number(inv.total_value), 0);
          return {
            month: format(new Date(selectedYear, i, 1), "MMM", { locale: ptBR }),
            value: monthTotal,
          };
        });
        setChartData(monthlyData);
      }
    }
  };

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  // Get previous month name for display
  const previousMonthDate = subMonths(new Date(selectedYear, selectedMonth, 1), 1);
  const previousMonthName = format(previousMonthDate, "MMMM yyyy", { locale: ptBR });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold">Dashboard</h2>
          <div className="flex gap-2">
            <Button
              variant={period === "month" ? "default" : "outline"}
              onClick={() => setPeriod("month")}
            >
              Mensal
            </Button>
            <Button
              variant={period === "year" ? "default" : "outline"}
              onClick={() => setPeriod("year")}
            >
              Anual
            </Button>
          </div>
        </div>
        
        <div className="flex gap-2">
          {period === "month" && (
            <Select
              value={selectedMonth.toString()}
              onValueChange={(value) => setSelectedMonth(Number(value))}
            >
              <SelectTrigger className="w-[180px]">
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
          )}
          
          <Select
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(Number(value))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione o ano" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards - Row 1: Valor Total, Notas Fiscais, Entradas Manuais, Bonus Corte & Cose */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card hover:shadow-glow transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <Euro className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gradient">€ {stats.totalValue.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card className="glass-card hover:shadow-glow transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Notas Fiscais</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.invoiceCount}</div>
          </CardContent>
        </Card>

        <Card className="glass-card hover:shadow-glow transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Entradas Manuais</CardTitle>
            <Plus className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.manualEntryCount}</div>
          </CardContent>
        </Card>

        <Card className="border-bonus glass-card hover:shadow-glow transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-bonus">Bonus Corte & Cose</CardTitle>
            <Gift className="h-4 w-4 text-bonus" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bonus">€ {stats.corteCoseBonus.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              No período selecionado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards - Row 2: Receitas do Período, Projeções de Ganhos, Saldo Mês Anterior, Saldo Total */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card hover:shadow-glow transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Receitas do Período</CardTitle>
            <Euro className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">€ {stats.monthlyRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {period === "month" 
                ? format(new Date(selectedYear, selectedMonth, 1), "MMMM yyyy", { locale: ptBR })
                : selectedYear.toString()
              }
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card hover:shadow-glow transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Projeção de Ganhos</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">€ {stats.projectedEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              30% do valor total
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/50 glass-card hover:shadow-glow transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">Saldo Mês Anterior</CardTitle>
            <History className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">€ {stats.previousMonthBalance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Pendente de {previousMonthName}
            </p>
          </CardContent>
        </Card>

        <Card className="border-destructive/50 glass-card hover:shadow-glow transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-destructive">Saldo Total a Receber</CardTitle>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">€ {stats.balanceReceivable.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Projeção + Bonus - Receitas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart for monthly view (weekly) */}
      {period === "month" && chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Gráfico Semanal - {months[selectedMonth]} {selectedYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                value: {
                  label: "Valor Total",
                  color: "hsl(var(--primary))",
                },
              }}
              className="h-[400px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Chart for annual view (monthly) */}
      {period === "year" && (
        <Card>
          <CardHeader>
            <CardTitle>Gráfico Mensal - {selectedYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                value: {
                  label: "Valor Total",
                  color: "hsl(var(--primary))",
                },
              }}
              className="h-[400px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
