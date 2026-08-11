'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Button } from './ui/Button'
import { EmptyState } from './ui/EmptyState'
import { SchedulePanel } from './SchedulePanel'
import { useClinica } from './ClinicaProvider'
import { aniversarioParaExibicao, idadeAtual, parseAniversarioMonthDay, rotuloDia, toE164BR } from '@/lib/format'
import type { Aniversariante, StatusEnvio } from '@/types/database'

interface Item extends Aniversariante {
  envio: { status: StatusEnvio; scheduled_for: string | null } | null
  ja_passou: boolean
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

type Filtro = 'pendente' | 'agendados' | 'invalido' | 'todos'

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'pendente', label: 'Sem mensagem' },
  { key: 'agendados', label: 'Agendados' },
  { key: 'invalido', label: 'Corrigir telefone' },
  { key: 'todos', label: 'Todos' },
]

// Timezone real da clínica não chega ao client (a API pública de clínicas só
// expõe id/slug/nome) — pra rótulos de dia/idade aqui, que são só exibição
// (não decidem se algo é agendável, isso já vem calculado do servidor em
// `ja_passou`), o fuso do próprio navegador é uma aproximação razoável: quem
// usa o painel está fisicamente na clínica.
const FUSO_NAVEGADOR = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'America/Sao_Paulo'

export function AniversariantesView() {
  const { slug: clinica } = useClinica()

  const [mes, setMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [items, setItems] = useState<Item[]>([])
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('pendente')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())

  const load = useCallback(() => {
    if (!clinica) return
    setLoading(true)
    setError(null)
    fetch(`/api/aniversariantes?clinica=${clinica}&mes=${mes}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setItems(data.items ?? [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [clinica, mes])

  useEffect(() => {
    load()
  }, [load])

  // Some contatos vem sem telefone utilizável (vazio, "000000", texto colado
  // junto etc) — calculamos isso uma vez pra desabilitar seleção/agendamento.
  // `ja_passou` (vindo da API, no fuso da clínica) desabilita pelo mesmo
  // motivo: não dá pra parabenizar um aniversário que já aconteceu.
  const filtrados = useMemo(() => {
    return items
      .filter((i) => i.nome.toLowerCase().includes(busca.toLowerCase()))
      .map((i) => {
        const telefoneValido = !!toE164BR(i.celular || i.telefone || '')
        return { ...i, telefoneValido, agendavel: telefoneValido && !i.ja_passou }
      })
  }, [items, busca])

  const semMensagem = filtrados.filter((i) => i.agendavel && (!i.envio || i.envio.status === 'canceled'))
  const agendados = filtrados.filter((i) => i.envio && i.envio.status !== 'canceled')
  const invalidos = filtrados.filter((i) => !i.telefoneValido)

  const visiveis = useMemo(() => {
    if (filtro === 'pendente') return semMensagem
    if (filtro === 'agendados') return agendados
    if (filtro === 'invalido') return invalidos
    return filtrados
  }, [filtro, filtrados, semMensagem, agendados, invalidos])

  const agrupado = useMemo(() => {
    const porDia = new Map<string, typeof visiveis>()
    for (const item of visiveis) {
      const { dia } = parseAniversarioMonthDay(item.aniversario)
      const chave = String(dia).padStart(2, '0')
      porDia.set(chave, [...(porDia.get(chave) ?? []), item])
    }
    return [...porDia.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([chave, pessoas]) => {
        const { mes: mesAniv, dia: diaAniv } = parseAniversarioMonthDay(pessoas[0].aniversario)
        const agendadosNoDia = pessoas.filter((p) => p.envio && p.envio.status !== 'canceled').length
        return {
          chave,
          rotulo: rotuloDia(mesAniv, diaAniv, FUSO_NAVEGADOR),
          resumo: `${pessoas.length} aniversariante${pessoas.length > 1 ? 's' : ''}${agendadosNoDia > 0 ? `, ${agendadosNoDia} agendado${agendadosNoDia > 1 ? 's' : ''}` : ''}`,
          pessoas,
        }
      })
  }, [visiveis])

  const selecionaveis = visiveis.filter((i) => i.agendavel)
  const todosSelecionados = selecionaveis.length > 0 && selecionaveis.every((i) => selecionados.has(i.id))

  useEffect(() => {
    // Limpa seleção ao trocar de mês/busca pra não carregar seleção de outra lista.
    setSelecionados(new Set())
  }, [mes, busca])

  function toggleSelecionado(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTodos() {
    setSelecionados(todosSelecionados ? new Set() : new Set(selecionaveis.map((i) => i.id)))
  }

  const pacientesSelecionados = filtrados.filter((i) => selecionados.has(i.id))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Aniversariantes · {MESES[parseInt(mes, 10) - 1]} {new Date().getFullYear()}
          </h1>
          {loading ? (
            <p className="mt-0.5 flex items-center gap-2 text-sm text-slate-500">
              <span
                className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--primary-from)]"
                aria-hidden="true"
              />
              Buscando aniversariantes...
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-slate-500">
              {semMensagem.length} sem mensagem · {agendados.length} agendados · {invalidos.length} telefone a corrigir · {filtrados.length} no total
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            placeholder="Buscar nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-[38px] rounded-full border border-slate-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="h-[38px] rounded-full border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          >
            {MESES.map((m, idx) => (
              <option key={m} value={String(idx + 1).padStart(2, '0')}>{m}</option>
            ))}
          </select>
          <Button size="sm" onClick={toggleTodos} disabled={selecionaveis.length === 0}>
            {todosSelecionados ? 'Limpar seleção' : `Selecionar ${selecionaveis.length}`}
          </Button>
        </div>
      </div>

      <div className="flex gap-1.5">
        {FILTROS.map((f) => {
          const count = f.key === 'pendente' ? semMensagem.length : f.key === 'agendados' ? agendados.length : f.key === 'invalido' ? invalidos.length : filtrados.length
          const ativo = filtro === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={clsx(
                'rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                ativo
                  ? 'bg-[var(--primary-from)] text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              )}
            >
              {f.label} · {count}
            </button>
          )
        })}
      </div>

      {error ? (
        <EmptyState
          variant="error"
          title="Não foi possível carregar a base"
          description="A conexão com o prontuário ou a Helena falhou. Os agendamentos já confirmados não foram afetados."
          action={{ label: 'Tentar de novo', onClick: load }}
        />
      ) : (
        <div className="flex items-start gap-5">
          <div className="min-w-0 flex-1">
            {loading && (
              <div className="rounded-xl border border-slate-200 bg-white">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div key={idx} className="flex items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0">
                    <div className="h-3.5 w-3.5 animate-pulse rounded bg-slate-100" />
                    <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
                    <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
                    <div className="ml-auto h-8 w-24 animate-pulse rounded-full bg-slate-100" />
                  </div>
                ))}
              </div>
            )}

            {!loading && agrupado.length === 0 && (
              <EmptyState
                title={`${MESES[parseInt(mes, 10) - 1]} está vazio`}
                description="Nenhum paciente da base tem aniversário neste mês (ou nenhum bate com o filtro atual)."
              />
            )}

            {!loading && agrupado.map((grupo) => (
              <div key={grupo.chave} className="mb-6">
                <div className="mb-2.5 flex items-center gap-3">
                  <strong className="text-[15px] font-semibold text-slate-900">{grupo.rotulo}</strong>
                  <span className="text-sm text-slate-400">{grupo.resumo}</span>
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {grupo.pessoas.map((item) => {
                    const idade = idadeAtual(item.datanascimento, FUSO_NAVEGADOR)
                    return (
                      <div
                        key={item.id}
                        className="grid grid-cols-[26px_1fr_190px_150px_120px] items-center gap-0 border-b border-slate-100 px-4 py-3.5 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selecionados.has(item.id)}
                          onChange={() => toggleSelecionado(item.id)}
                          disabled={!item.agendavel}
                        />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[15px] font-medium text-slate-800">{item.nome}</span>
                          <span className="text-[13px] text-slate-400">
                            {idade !== null ? `faz ${idade} anos` : aniversarioParaExibicao(item.aniversario)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600">{item.celular || item.telefone || '—'}</span>
                          {!item.telefoneValido && (
                            <span className="rounded-full bg-[var(--status-canceled)] px-2 py-0.5 text-xs font-medium text-[var(--status-canceled-fg)]">
                              corrigir
                            </span>
                          )}
                        </div>
                        <div>
                          {item.envio && item.envio.status !== 'canceled' ? (
                            <span className="text-[13px] font-medium text-green-700">Agendado</span>
                          ) : item.ja_passou ? (
                            <span className="text-[13px] text-slate-400">já passou</span>
                          ) : (
                            <span className="text-[13px] text-slate-400">Sem mensagem</span>
                          )}
                        </div>
                        <div className="flex justify-end">
                          <button
                            disabled={!item.agendavel}
                            onClick={() => setSelecionados(new Set([item.id]))}
                            className={clsx(
                              'h-8 rounded-full px-3.5 text-[13px] font-semibold transition-colors',
                              !item.agendavel
                                ? 'cursor-not-allowed text-slate-300'
                                : 'bg-[var(--primary-soft)] text-[var(--primary-from)] hover:opacity-80'
                            )}
                            title={
                              !item.telefoneValido
                                ? 'Telefone inválido — não é possível enviar mensagem'
                                : item.ja_passou
                                  ? 'O aniversário já passou este ano — só dá pra agendar de hoje em diante'
                                  : undefined
                            }
                          >
                            {item.envio && item.envio.status !== 'canceled' ? 'Editar' : 'Agendar'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <SchedulePanel
            clinicaSlug={clinica}
            pacientes={pacientesSelecionados}
            telefoneInvalidoCount={invalidos.length}
            onScheduled={load}
            onDone={() => setSelecionados(new Set())}
          />
        </div>
      )}
    </div>
  )
}
