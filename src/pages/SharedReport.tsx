import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Scissors, FileText, Euro, CreditCard, Calendar, ExternalLink, Image as ImageIcon, Loader2 } from "lucide-react";
import { SewingBackground } from "@/components/SewingBackground";

interface SharedReportData {
  id: string;
  report_type: string;
  report_title: string;
  report_data: any;
  created_at: string;
  expires_at: string;
}

const SharedReport = () => {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<SharedReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      if (!id) {
        setError("Link inválido");
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("shared_reports")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (!data) {
          setError("Relatório não encontrado ou expirado");
          setLoading(false);
          return;
        }

        // Check if expired
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          setError("Este relatório expirou");
          setLoading(false);
          return;
        }

        setReport(data);
      } catch (err) {
        console.error("Error fetching shared report:", err);
        setError("Erro ao carregar relatório");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [id]);

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

  const ProjectedEarningsBox = ({ value }: { value: number }) => (
    <div className="bg-destructive text-destructive-foreground p-4 rounded-lg border-2 border-destructive shadow-lg min-w-[180px]">
      <p className="text-xs font-medium uppercase tracking-wide opacity-90">Projeção de Ganhos</p>
      <p className="text-2xl font-bold">€ {value.toFixed(2)}</p>
      <p className="text-xs opacity-75">(30% do valor total)</p>
    </div>
  );

  const renderPaymentsByMonthReport = () => {
    const data = report!.report_data;
    const monthLabel = months.find(m => m.value === data.referenceMonth.split('-')[1])?.label || "";
    const year = data.referenceMonth.split('-')[0];

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <h3 className="text-xl font-bold font-display">
            Pagamentos - {monthLabel} {year}
          </h3>
          <ProjectedEarningsBox value={data.projectedEarnings} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="glass-card">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total em Notas</p>
              <p className="text-lg font-bold">€ {data.invoicesTotal.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Projeção (30%)</p>
              <p className="text-lg font-bold text-primary">€ {data.projectedEarnings.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Bonus C&C</p>
              <p className="text-lg font-bold text-bonus">€ {data.debtsTotal.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total a Receber</p>
              <p className="text-lg font-bold">€ {data.totalToReceive.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total Pago</p>
              <p className="text-lg font-bold text-bonus">€ {data.totalPaid.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Saldo Pendente</p>
              <p className={`text-lg font-bold ${data.balance > 0 ? 'text-orange-600' : 'text-bonus'}`}>
                € {data.balance.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display">Pagamentos Realizados</CardTitle>
            <CardDescription>
              Todos os pagamentos feitos para {monthLabel} {year}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.payments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum pagamento registrado para este mês
              </p>
            ) : (
              <div className="space-y-2">
                {data.payments.map((payment: any) => (
                  <div key={payment.id} className="flex justify-between items-center p-4 border rounded-lg bg-background/50">
                    <div>
                      <p className="font-medium">
                        {format(new Date(payment.revenue_date), "dd/MM/yyyy")}
                      </p>
                      {payment.description && (
                        <p className="text-sm text-muted-foreground">{payment.description}</p>
                      )}
                    </div>
                    <p className="font-bold text-bonus">€ {Number(payment.amount).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderGeneralReport = () => {
    const data = report!.report_data;
    const totalValue = data.totalInvoiceValue + data.totalManualValue;
    const projectedEarnings = totalValue * 0.30;
    const reportType = report!.report_type;

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <h3 className="text-xl font-bold font-display">{report!.report_title}</h3>
          <ProjectedEarningsBox value={projectedEarnings} />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Notas Fiscais</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">€ {data.totalInvoiceValue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.totalInvoiceCount} nota(s) fiscal(is)
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Entradas Manuais</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">€ {data.totalManualValue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.totalManualCount} entrada(s) manual(is)
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Geral</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">€ {totalValue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.totalInvoiceCount + data.totalManualCount} registro(s)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Items Table */}
        {data.items && data.items.length > 0 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="font-display">Itens do Relatório</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Data</th>
                      <th className="text-left p-2">Nº Nota</th>
                      <th className="text-left p-2">Descrição</th>
                      <th className="text-right p-2">Valor</th>
                      {reportType === "complete" && (
                        <>
                          <th className="text-left p-2">Contacto</th>
                          <th className="text-center p-2">Foto</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item: any, index: number) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="p-2">{item.date}</td>
                        <td className="p-2">{item.invoiceNumber}</td>
                        <td className="p-2">{item.description}</td>
                        <td className="p-2 text-right">€ {item.value.toFixed(2)}</td>
                        {reportType === "complete" && (
                          <>
                            <td className="p-2">{item.contactName || "-"}</td>
                            <td className="p-2 text-center">
                              {item.imageUrl ? (
                                <a
                                  href={item.imageUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-primary hover:text-primary/80"
                                >
                                  <ImageIcon className="h-4 w-4" />
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                "-"
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoices Summary */}
        {data.invoices && data.invoices.length > 0 && reportType !== "complete" && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="font-display">Notas Fiscais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.invoices.map((inv: any) => (
                  <div key={inv.id} className="flex justify-between items-center p-3 border rounded-lg bg-background/50">
                    <div>
                      <p className="font-medium">Nota #{inv.invoice_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(inv.delivery_date), "dd/MM/yyyy")}
                      </p>
                    </div>
                    <p className="font-bold">€ {Number(inv.total_value).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <SewingBackground>
        <div className="flex items-center justify-center min-h-screen">
          <div className="glass-card p-8 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Carregando relatório...</p>
          </div>
        </div>
      </SewingBackground>
    );
  }

  if (error) {
    return (
      <SewingBackground>
        <div className="flex items-center justify-center min-h-screen">
          <Card className="glass-card p-8 max-w-md mx-4">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <FileText className="h-8 w-8 text-destructive" />
              </div>
              <h2 className="text-xl font-bold font-display">{error}</h2>
              <p className="text-muted-foreground">
                O relatório pode ter sido removido ou o link está incorreto.
              </p>
            </div>
          </Card>
        </div>
      </SewingBackground>
    );
  }

  return (
    <SewingBackground>
      <div className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Scissors className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold font-display text-gradient">Costureira Pro</h1>
            </div>
            <p className="text-muted-foreground">Relatório Compartilhado</p>
            {report && (
              <p className="text-xs text-muted-foreground mt-2">
                Gerado em: {format(new Date(report.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </div>

          {/* Report Content */}
          {report && (
            report.report_type === "payments-by-month" 
              ? renderPaymentsByMonthReport() 
              : renderGeneralReport()
          )}
        </div>
      </div>
    </SewingBackground>
  );
};

export default SharedReport;
