-- eclinica_token era NOT NULL desde a migration inicial, o que impediria
-- cadastrar uma clínica só-Clinicorp (sem token e-Clínica). Solta a
-- constraint da coluna e substitui por uma regra que exige as credenciais
-- certas de acordo com o sistema_prontuario escolhido.

alter table public.aniversariantes_clinicas
  alter column eclinica_token drop not null;

alter table public.aniversariantes_clinicas
  add constraint aniversariantes_clinicas_prontuario_credenciais_check
  check (
    (sistema_prontuario = 'eclinica' and eclinica_token is not null)
    or
    (sistema_prontuario = 'clinicorp' and clinicorp_usuario_api is not null and clinicorp_token_api is not null and clinicorp_subscriber_id is not null)
  );
