-- Projeto Supabase: Clinic Control (jggfnfxdtfqeqyvxufgu), schema public.
-- Tabelas prefixadas com "aniversariantes_" para não se confundir com o
-- schema de automacao_clinicas já existente no mesmo projeto/schema.

create extension if not exists "pgcrypto";

create table if not exists public.aniversariantes_clinicas (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nome text not null,
  eclinica_token text not null,
  eclinica_base_url text not null default 'https://eclinica.app/api/v2',
  helena_token text not null,
  helena_channel_id text,
  helena_from text,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now()
);

create table if not exists public.aniversariantes_templates (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.aniversariantes_clinicas(id) on delete cascade,
  helena_template_id text not null,
  nome text not null,
  param_mapping jsonb not null default '{}'::jsonb,
  dia_envio text not null default 'aniversario'
    check (dia_envio in ('aniversario', '1_dia_antes', '3_dias_antes')),
  horario_envio text not null default '09:00',
  is_default boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinica_id, helena_template_id)
);

create table if not exists public.aniversariantes_envios (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.aniversariantes_clinicas(id) on delete cascade,
  template_id uuid references public.aniversariantes_templates(id) on delete set null,
  paciente_id_eclinica text not null,
  paciente_nome text not null,
  paciente_telefone text not null,
  data_nascimento text,
  ano int not null,
  scheduled_message_id text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'processed', 'sent', 'delivered', 'read', 'canceled', 'failed')),
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  unique (clinica_id, paciente_id_eclinica, ano)
);

create index if not exists idx_aniversariantes_envios_clinica on public.aniversariantes_envios(clinica_id);
create index if not exists idx_aniversariantes_templates_clinica on public.aniversariantes_templates(clinica_id);

-- Deny-all RLS: acesso só via service role no backend (mesmo padrão do Contact-Calendar).
alter table public.aniversariantes_clinicas enable row level security;
alter table public.aniversariantes_templates enable row level security;
alter table public.aniversariantes_envios enable row level security;

-- Seed de clinicas: NAO versionar tokens reais neste arquivo.
-- A clinica "Oral Foz" ja foi inserida manualmente via MCP/SQL editor com as
-- credenciais reais (nao commitadas). Para replicar em outro ambiente, rode:
--
-- insert into public.aniversariantes_clinicas (slug, nome, eclinica_token, helena_token, helena_channel_id)
-- values ('oral-foz', 'Oral Foz', '<ECLINICA_TOKEN>', '<HELENA_TOKEN>', '<HELENA_CHANNEL_ID>')
-- on conflict (slug) do nothing;
