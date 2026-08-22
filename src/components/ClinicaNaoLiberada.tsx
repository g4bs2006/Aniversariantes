// Tela para quando a clínica tem acesso válido mas ainda não foi provisionada.
//
// Acontece no caminho normal: a aba da plataforma vale para todas as clínicas,
// então alguém pode abrir antes de a clínica ser provisionada no Clinic Control.
// Antes disto a tela dizia "Erro ao carregar clínicas" em vermelho — culpava
// quem não tem nada a consertar, porque a pessoa da clínica não pode se liberar.
//
// Deliberadamente curta: uma frase que diz o que fazer. Nada de explicar que o
// painel existe, nem de expor identificador de conta — quem lê não precisa de
// nenhuma das duas coisas para agir, e cada linha extra afasta a única que
// importa.
//
// Sem botão: a ação é humana e fora do app. Um botão que não faz nada é pior
// que nenhum.
//
// Substitui o shell inteiro, incluindo a nav: Agenda, Modelos e Histórico não
// levam a lugar nenhum sem clínica.

export function ClinicaNaoLiberada() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
        {/* O gradiente da identidade do app, uma vez só — o mesmo mark do
            header. Ancora a tela no produto sem decorar. */}
        <span className="mx-auto mb-6 block h-12 w-12 rounded-full bg-gradient-to-br from-[var(--primary-from)] via-[var(--primary-via)] to-[var(--primary-to)]" />

        <h1 className="text-lg font-semibold leading-snug text-slate-900">
          Painel ainda não liberado para esta clínica
        </h1>

        <p className="mt-3 text-[15px] leading-relaxed text-slate-500">
          Fale com quem administra a conta para liberar o acesso.
        </p>
      </div>
    </div>
  )
}
