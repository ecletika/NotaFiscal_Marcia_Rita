CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: corte_cose_debts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.corte_cose_debts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    debt_date date NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    description text NOT NULL,
    value numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_number text NOT NULL,
    invoice_date date NOT NULL,
    total_value numeric(10,2) DEFAULT 0 NOT NULL,
    image_url text,
    is_manual_entry boolean DEFAULT false,
    observations text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_id uuid NOT NULL,
    delivery_date date NOT NULL,
    phone_number text,
    contact_name text,
    is_validated boolean DEFAULT true NOT NULL,
    original_filename text
);


--
-- Name: revenues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revenues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    revenue_date date NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reference_month text
);


--
-- Name: corte_cose_debts corte_cose_debts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.corte_cose_debts
    ADD CONSTRAINT corte_cose_debts_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: revenues revenues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revenues
    ADD CONSTRAINT revenues_pkey PRIMARY KEY (id);


--
-- Name: idx_invoice_items_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_items_invoice_id ON public.invoice_items USING btree (invoice_id);


--
-- Name: idx_invoices_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_date ON public.invoices USING btree (invoice_date);


--
-- Name: corte_cose_debts update_corte_cose_debts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_corte_cose_debts_updated_at BEFORE UPDATE ON public.corte_cose_debts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: invoices update_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: revenues update_revenues_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_revenues_updated_at BEFORE UPDATE ON public.revenues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: corte_cose_debts Users can delete their own debts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own debts" ON public.corte_cose_debts FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: invoice_items Users can delete their own invoice items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own invoice items" ON public.invoice_items FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.invoices
  WHERE ((invoices.id = invoice_items.invoice_id) AND (invoices.user_id = auth.uid())))));


--
-- Name: invoices Users can delete their own invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own invoices" ON public.invoices FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: revenues Users can delete their own revenues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own revenues" ON public.revenues FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: corte_cose_debts Users can insert their own debts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own debts" ON public.corte_cose_debts FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: invoice_items Users can insert their own invoice items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own invoice items" ON public.invoice_items FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.invoices
  WHERE ((invoices.id = invoice_items.invoice_id) AND (invoices.user_id = auth.uid())))));


--
-- Name: invoices Users can insert their own invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own invoices" ON public.invoices FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: revenues Users can insert their own revenues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own revenues" ON public.revenues FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: corte_cose_debts Users can update their own debts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own debts" ON public.corte_cose_debts FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: invoice_items Users can update their own invoice items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own invoice items" ON public.invoice_items FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.invoices
  WHERE ((invoices.id = invoice_items.invoice_id) AND (invoices.user_id = auth.uid())))));


--
-- Name: invoices Users can update their own invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own invoices" ON public.invoices FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: revenues Users can update their own revenues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own revenues" ON public.revenues FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: corte_cose_debts Users can view their own debts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own debts" ON public.corte_cose_debts FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: invoice_items Users can view their own invoice items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own invoice items" ON public.invoice_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.invoices
  WHERE ((invoices.id = invoice_items.invoice_id) AND (invoices.user_id = auth.uid())))));


--
-- Name: invoices Users can view their own invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own invoices" ON public.invoices FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: revenues Users can view their own revenues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own revenues" ON public.revenues FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: corte_cose_debts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.corte_cose_debts ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: revenues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.revenues ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


