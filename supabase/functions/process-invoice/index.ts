import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication - extract token from header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role key to verify the token
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify the JWT token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('Auth error:', userError?.message || 'No user found');
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    const { imageUrl } = await req.json();
    
    if (!imageUrl) {
      throw new Error('Image URL is required');
    }

    console.log('Processing invoice image:', imageUrl);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente especializado em extrair informações de notas fiscais e recibos.
Analise a imagem e extraia as seguintes informações:
1. Número da nota fiscal (se disponível)
2. Data da nota fiscal (formato DD/MM/YYYY)
3. Lista de itens com descrição e valor de cada item
4. Valor total
5. Número de telefone (se disponível na nota)
6. Nome do cliente/contacto (se disponível na nota)

Responda SEMPRE em formato JSON válido com esta estrutura:
{
  "invoiceNumber": "número ou null se não encontrar",
  "invoiceDate": "DD/MM/YYYY ou null se não encontrar",
  "items": [
    {"description": "descrição do item", "value": 0.00}
  ],
  "totalValue": 0.00,
  "phoneNumber": "número de telefone ou null",
  "contactName": "nome do cliente ou null"
}

IMPORTANTE: 
- Se não encontrar o número da nota, use null
- Se não conseguir identificar a data, use null
- Se não conseguir identificar o valor total, use 0.00
- Se não conseguir identificar itens, retorne array vazio []
- Se não encontrar telefone, use null
- Se não encontrar nome do cliente, use null
- Retorne APENAS o JSON, sem explicações adicionais
- NUNCA retorne erro, sempre retorne o JSON com os campos que conseguir extrair`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Por favor, extraia as informações desta nota fiscal/recibo:'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), 
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }), 
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Return default values instead of throwing error
      return new Response(
        JSON.stringify({
          invoiceNumber: null,
          invoiceDate: null,
          items: [],
          totalValue: 0,
          phoneNumber: null,
          contactName: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    console.log('AI Response:', aiResponse);
    
    // Try to parse the JSON response
    let invoiceData;
    try {
      // Remove markdown code blocks if present
      const cleanedResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      invoiceData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // Return default values instead of throwing error
      invoiceData = {
        invoiceNumber: null,
        invoiceDate: null,
        items: [],
        totalValue: 0,
        phoneNumber: null,
        contactName: null,
      };
    }

    // Ensure all required fields exist with defaults
    const safeInvoiceData = {
      invoiceNumber: invoiceData.invoiceNumber || null,
      invoiceDate: invoiceData.invoiceDate || null,
      items: Array.isArray(invoiceData.items) ? invoiceData.items : [],
      totalValue: typeof invoiceData.totalValue === 'number' ? invoiceData.totalValue : 0,
      phoneNumber: invoiceData.phoneNumber || null,
      contactName: invoiceData.contactName || null,
    };

    return new Response(
      JSON.stringify(safeInvoiceData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing invoice:', error);
    // Return default values instead of error
    return new Response(
      JSON.stringify({
        invoiceNumber: null,
        invoiceDate: null,
        items: [],
        totalValue: 0,
        phoneNumber: null,
        contactName: null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});