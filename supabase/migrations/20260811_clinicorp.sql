-- Adiciona suporte à Clinicorp como segundo provedor de prontuário e um cache
-- local de aniversariantes (necessário pra Clinicorp: a API dela só lista
-- aniversariantes por dia, não por mês — reconstruir "o mês" ao vivo exigiria
-- até 31 requests por carregamento de página. Um cron diário
-- (/api/cron/sync-clinicorp) sincroniza os dados aqui e a tela lê só do cache).

alter table public.aniversariantes_clinicas
  add column if not exists sistema_prontuario text not null default 'eclinica'
    check (sistema_prontuario in ('eclinica', 'clinicorp')),
  add column if not exists clinicorp_usuario_api text,
  add column if not exists clinicorp_token_api text,
  add column if not exists clinicorp_subscriber_id text,
  add column if not exists clinicorp_base_url text not null default 'https://api.clinicorp.com/rest/v1';

create table if not exists public.aniversariantes_pacientes_cache (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.aniversariantes_clinicas(id) on delete cascade,
  paciente_id text not null,
  nome text not null,
  telefone text,
  datanascimento text, -- "YYYY-MM-DD", normalizado no sync
  mes_aniversario int not null check (mes_aniversario between 1 and 12),
  dia_aniversario int not null check (dia_aniversario between 1 and 31),
  situacao text, -- ACTIVE/INACTIVE/DELETED (via /patient/get), null = não verificado
  synced_at timestamptz not null default now(),
  unique (clinica_id, paciente_id)
);

create index if not exists idx_aniversariantes_pacientes_cache_clinica_mes
  on public.aniversariantes_pacientes_cache(clinica_id, mes_aniversario);

-- Deny-all RLS: acesso só via service role no backend, mesmo padrão das outras.
alter table public.aniversariantes_pacientes_cache enable row level security;

-- Pra ativar a Clinicorp numa clínica já cadastrada:
--
-- update public.aniversariantes_clinicas
-- set sistema_prontuario = 'clinicorp',
--     clinicorp_usuario_api = '<USUARIO_API>',
--     clinicorp_token_api = '<TOKEN_API>',
--     clinicorp_subscriber_id = '<SUBSCRIBER_ID>'
-- where slug = '<slug-da-clinica>';
