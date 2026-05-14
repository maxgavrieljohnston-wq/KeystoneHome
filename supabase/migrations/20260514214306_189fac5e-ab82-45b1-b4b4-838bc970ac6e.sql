ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS pdf_token text UNIQUE;
CREATE INDEX IF NOT EXISTS plans_pdf_token_idx ON public.plans(pdf_token);