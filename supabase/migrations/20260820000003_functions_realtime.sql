-- ============================================================================
-- Módulo 2 — Lógica de reservas y Realtime
--
-- * Trigger que mantiene `classes.reservas_count` (cupos en vivo).
-- * RPC `reservar_clase(p_class_id)`: valida sesión, clase vigente, reservas
--   duplicadas y cupos. El `SELECT ... FOR UPDATE` sobre la fila de la clase
--   serializa las reservas concurrentes y evita superar la capacidad
--   (condiciones de carrera). La validación NO depende del frontend.
-- * Publicación Realtime de `classes` y `bookings`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Contador de reservas confirmadas por clase (se incrementa/decrementa solo).
-- ---------------------------------------------------------------------------
create or replace function public.tg_bookings_maintain_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' and new.estado = 'confirmada') then
    update public.classes
       set reservas_count = reservas_count + 1
     where id = new.class_id;
  elsif (tg_op = 'UPDATE' and old.estado = 'confirmada' and new.estado = 'cancelada') then
    update public.classes
       set reservas_count = greatest(reservas_count - 1, 0)
     where id = new.class_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_bookings_count on public.bookings;
create trigger trg_bookings_count
  after insert or update of estado on public.bookings
  for each row execute procedure public.tg_bookings_maintain_count();

-- ---------------------------------------------------------------------------
-- RPC principal de reserva.
-- ---------------------------------------------------------------------------
create or replace function public.reservar_clase(p_class_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_capacidad integer;
  v_fecha date;
  v_ocupadas integer;
  v_booking public.bookings;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión para reservar';
  end if;

  -- Bloquea la fila de la clase: dos reservas simultáneas para la misma
  -- clase se procesan una después de la otra (evita sobre-cupo).
  select capacidad, fecha
    into v_capacidad, v_fecha
    from public.classes
   where id = p_class_id
     and activo
     for update;

  if v_capacidad is null then
    raise exception 'La clase no está disponible';
  end if;

  if v_fecha < current_date then
    raise exception 'No se puede reservar una clase que ya ocurrió';
  end if;

  -- Evita reservar dos veces la misma clase.
  if exists (
    select 1
      from public.bookings
     where user_id = v_user_id
       and class_id = p_class_id
       and estado = 'confirmada'
  ) then
    raise exception 'Ya tienes una reserva activa para esta clase';
  end if;

  -- Cupos calculados a partir de las reservas reales.
  select count(*)
    into v_ocupadas
    from public.bookings
   where class_id = p_class_id
     and estado = 'confirmada';

  if v_ocupadas >= v_capacidad then
    raise exception 'Lo sentimos, la clase está llena';
  end if;

  insert into public.bookings (user_id, class_id)
  values (v_user_id, p_class_id)
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.reservar_clase(uuid) from anon;
revoke all on function public.reservar_clase(uuid) from public;
grant execute on function public.reservar_clase(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: los clientes reciben los cambios de cupos (classes) y del estado
-- de las reservas (bookings) sin recargar la página.
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.classes;
exception
  when duplicate_object then null; -- ya estaba agregada
end $$;

do $$
begin
  alter publication supabase_realtime add table public.bookings;
exception
  when duplicate_object then null;
end $$;
