create table if not exists public.operational_expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text not null,
  amount numeric(10, 2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('efectivo', 'tarjeta', 'transferencia', 'qr')),
  expense_date date not null default current_date,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_operational_expenses_date
  on public.operational_expenses (expense_date desc);

alter table public.operational_expenses enable row level security;

drop policy if exists "Admin lee egresos operativos" on public.operational_expenses;
create policy "Admin lee egresos operativos"
  on public.operational_expenses for select
  to authenticated
  using ((auth.jwt() ->> 'email') = 'admin@ironforge.com');

drop policy if exists "Admin registra egresos operativos" on public.operational_expenses;
create policy "Admin registra egresos operativos"
  on public.operational_expenses for insert
  to authenticated
  with check (
    (auth.jwt() ->> 'email') = 'admin@ironforge.com'
    and created_by = auth.uid()
  );

