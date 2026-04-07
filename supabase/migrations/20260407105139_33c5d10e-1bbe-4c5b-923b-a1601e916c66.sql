
CREATE TABLE public.pushed_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mongo_order_id TEXT NOT NULL UNIQUE,
  order_number TEXT,
  customer_name TEXT,
  account_size TEXT,
  payment_method TEXT,
  pushed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pushed_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view pushed orders"
ON public.pushed_orders
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service can insert pushed orders"
ON public.pushed_orders
FOR INSERT
WITH CHECK (true);
