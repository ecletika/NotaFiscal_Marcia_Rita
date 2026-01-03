import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import EntradaManual from "./pages/EntradaManual";
import NotasFiscais from "./pages/NotasFiscais";
import Receitas from "./pages/Receitas";
import Relatorios from "./pages/Relatorios";
import Backup from "./pages/Backup";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import SharedReport from "./pages/SharedReport";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/report/:id" element={<SharedReport />} />
          <Route element={<Layout><Dashboard /></Layout>} path="/" />
          <Route element={<Layout><Upload /></Layout>} path="/upload" />
          <Route element={<Layout><EntradaManual /></Layout>} path="/entrada-manual" />
          <Route element={<Layout><NotasFiscais /></Layout>} path="/notas-fiscais" />
          <Route element={<Layout><Receitas /></Layout>} path="/receitas" />
          <Route element={<Layout><Relatorios /></Layout>} path="/relatorios" />
          <Route element={<Layout><Backup /></Layout>} path="/backup" />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route element={<Layout><NotFound /></Layout>} path="*" />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
