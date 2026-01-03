import { ReactNode, useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Upload, FileText, PlusCircle, BarChart3, LogOut, DollarSign, Database, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";
import { User } from "@supabase/supabase-js";
import { SewingBackground } from "./SewingBackground";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session && location.pathname !== "/auth") {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/upload", icon: Upload, label: "Upload" },
    { to: "/entrada-manual", icon: PlusCircle, label: "Entrada Manual" },
    { to: "/notas-fiscais", icon: FileText, label: "Notas Fiscais" },
    { to: "/receitas", icon: DollarSign, label: "Receitas" },
    { to: "/relatorios", icon: BarChart3, label: "Relatórios" },
    { to: "/backup", icon: Database, label: "Backup" },
  ];

  return (
    <SewingBackground>
      <div className="min-h-screen">
        {/* Header */}
        <header className="border-b glass-card sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Scissors className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-gradient">Gestor de Notas Fiscais</h1>
            </div>
            {user && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground hidden sm:block">{user.email}</span>
                <Button variant="outline" size="sm" onClick={handleLogout} className="hover:shadow-glow transition-all">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* Navigation */}
        <nav className="border-b glass-card sticky top-[73px] z-40">
          <div className="container mx-auto px-4">
            <div className="flex space-x-1 overflow-x-auto">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-all whitespace-nowrap rounded-t-lg",
                      isActive
                        ? "text-primary border-b-2 border-primary bg-primary/5"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">{children}</main>
      </div>
    </SewingBackground>
  );
};
