-- ============================================================================
-- Módulo 2 — Seed inicial
--
-- * Planes del Módulo 1 (frontend-web/src/data/gymData.js) persistidos en BD.
-- * Función `generar_clases(p_semanas)`: crea las sesiones de las próximas
--   N semanas a partir de la plantilla semanal del Módulo 1 (weeklyClasses).
--   Es idempotente: puede ejecutarse varias veces sin duplicar clases.
--   Para extender el calendario cuando pasen las semanas, volver a ejecutar:
--     select public.generar_clases(6);
-- ============================================================================

insert into public.plans (codigo, nombre, descripcion, precio, duracion_dias)
values
  ('basico',   'Plan Básico',   'Para empezar tu transformación', 180.00, 30),
  ('completo', 'Plan Completo', 'El favorito de nuestros socios', 240.00, 30),
  ('premium',  'Plan Premium',  'Experiencia integral',           300.00, 30)
on conflict (codigo) do nothing;

create or replace function public.generar_clases(p_semanas integer default 6)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dia date := current_date;
  v_fin date := current_date + (p_semanas * 7);
  v_count integer := 0;
  v_insertados integer;
begin
  -- Plantilla semanal (igual a weeklyClasses de gymData.js):
  -- dow: 0=domingo, 1=lunes ... 6=sábado
  while v_dia < v_fin loop
    insert into public.classes (nombre, entrenador, fecha, hora_inicio, hora_fin, capacidad)
    select
      t.nombre,
      t.entrenador,
      v_dia,
      t.hora,
      t.hora + interval '1 hour',
      t.capacidad
    from (values
      -- Lunes y miércoles
      ('CrossFit',  'Jorge Ramírez', time '07:00', 16, 1),
      ('Spinning',  'Ana Torres',    time '09:00', 20, 1),
      ('Funcional', 'Carlos Pérez',  time '18:00', 24, 1),
      ('Yoga',      'María López',   time '20:00', 18, 1),
      ('CrossFit',  'Jorge Ramírez', time '07:00', 16, 3),
      ('Spinning',  'Ana Torres',    time '09:00', 20, 3),
      ('Funcional', 'Carlos Pérez',  time '18:00', 24, 3),
      ('Yoga',      'María López',   time '20:00', 18, 3),
      -- Martes y jueves
      ('Yoga',      'María López',   time '07:00', 18, 2),
      ('Zumba',     'Ana Torres',    time '09:00', 30, 2),
      ('CrossFit',  'Jorge Ramírez', time '18:00', 16, 2),
      ('Spinning',  'Ana Torres',    time '20:00', 20, 2),
      ('Yoga',      'María López',   time '07:00', 18, 4),
      ('Zumba',     'Ana Torres',    time '09:00', 30, 4),
      ('CrossFit',  'Jorge Ramírez', time '18:00', 16, 4),
      ('Spinning',  'Ana Torres',    time '20:00', 20, 4),
      -- Viernes
      ('Funcional', 'Carlos Pérez',  time '07:00', 24, 5),
      ('Spinning',  'Ana Torres',    time '09:00', 20, 5),
      ('Funcional', 'Carlos Pérez',  time '18:00', 24, 5),
      ('Yoga',      'María López',   time '20:00', 18, 5),
      -- Sábado
      ('Open Gym',  'Staff',         time '09:00', 40, 6),
      ('Spinning',  'Ana Torres',    time '10:30', 20, 6)
    ) as t(nombre, entrenador, hora, capacidad, dow)
    where extract(dow from v_dia) = t.dow
    on conflict (nombre, fecha, hora_inicio) do nothing;

    get diagnostics v_insertados = row_count;
    v_count := v_count + v_insertados;
    v_dia := v_dia + 1;
  end loop;

  return v_count;
end;
$$;

-- Genera el calendario inicial (6 semanas desde hoy).
select public.generar_clases(6);
