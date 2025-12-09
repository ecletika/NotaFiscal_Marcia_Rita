import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Upload as UploadIcon, Phone, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Item {
  description: string;
  quantity: string;
  value: string;
}

const EntradaManual = () => {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [contactName, setContactName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: "1", value: "" }]);
  const [observations, setObservations] = useState("");
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
      }
    });
  }, []);

  const addItem = () => {
    setItems([...items, { description: "", quantity: "1", value: "" }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof Item, value: string) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const value = parseFloat(item.value) || 0;
      return sum + (quantity * value);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive",
      });
      return;
    }

    if (!invoiceNumber || !invoiceDate || items.length === 0) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const totalValue = calculateTotal();
      let imageUrl = null;

      // Upload image if provided
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('invoices')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('invoices')
          .getPublicUrl(fileName);

        imageUrl = urlData.publicUrl;
      }

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          delivery_date: deliveryDate || invoiceDate,
          total_value: totalValue,
          is_manual_entry: true,
          is_validated: true, // Manual entries are already validated
          observations,
          image_url: imageUrl,
          user_id: userId,
          contact_name: contactName || null,
          phone_number: phoneNumber || null,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      const itemsData = items.map(item => {
        const quantity = parseFloat(item.quantity) || 0;
        const unitValue = parseFloat(item.value) || 0;
        return {
          invoice_id: invoice.id,
          description: item.description,
          value: quantity * unitValue,
        };
      });

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsData);

      if (itemsError) throw itemsError;

      toast({
        title: "Sucesso",
        description: "Entrada manual salva com sucesso",
      });

      // Reset form
      setInvoiceNumber("");
      setInvoiceDate("");
      setDeliveryDate("");
      setContactName("");
      setPhoneNumber("");
      setItems([{ description: "", quantity: "1", value: "" }]);
      setObservations("");
      setImageFile(null);
      
      navigate("/notas-fiscais");
    } catch (error) {
      console.error('Error saving manual entry:', error);
      toast({
        title: "Erro",
        description: "Falha ao salvar entrada manual",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Entrada Manual</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoice-number">Número da Nota *</Label>
                <Input
                  id="invoice-number"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Ex: 12345"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice-date">Data da Nota *</Label>
                <Input
                  id="invoice-date"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => {
                    setInvoiceDate(e.target.value);
                    if (!deliveryDate) setDeliveryDate(e.target.value);
                  }}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="delivery-date">Data de Entrega *</Label>
                <Input
                  id="delivery-date"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact-name" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Nome do Contacto (Opcional)
                </Label>
                <Input
                  id="contact-name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Nome do cliente"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone-number" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Telefone (Opcional)
                </Label>
                <Input
                  id="phone-number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Número de telefone"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Itens *</Label>
                <Button type="button" onClick={addItem} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Item
                </Button>
              </div>

              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr,auto,auto,auto] gap-4 items-end">
                  <div className="space-y-2">
                    <Label htmlFor={`description-${index}`}>Descrição</Label>
                    <Input
                      id={`description-${index}`}
                      value={item.description}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                      placeholder="Descrição do item"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`quantity-${index}`}>Quantidade</Label>
                    <Input
                      id={`quantity-${index}`}
                      type="number"
                      step="1"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", e.target.value)}
                      placeholder="1"
                      required
                      className="w-24"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`value-${index}`}>Valor Unit. (€)</Label>
                    <Input
                      id={`value-${index}`}
                      type="number"
                      step="0.01"
                      value={item.value}
                      onChange={(e) => updateItem(index, "value", e.target.value)}
                      placeholder="0.00"
                      required
                      className="w-32"
                    />
                  </div>

                  {items.length > 1 && (
                    <Button
                      type="button"
                      onClick={() => removeItem(index)}
                      size="icon"
                      variant="destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="text-lg font-bold">
                Valor Total: € {calculateTotal().toFixed(2)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observations">Observações</Label>
              <Textarea
                id="observations"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Observações adicionais (opcional)"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">Foto (opcional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
                {imageFile && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setImageFile(null)}
                  >
                    Remover
                  </Button>
                )}
              </div>
              {imageFile && (
                <p className="text-sm text-muted-foreground">
                  {imageFile.name}
                </p>
              )}
            </div>

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Salvando..." : "Salvar Entrada"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default EntradaManual;