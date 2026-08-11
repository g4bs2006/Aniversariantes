'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from './ui/Button'
import { aniversarioParaExibicao } from '@/lib/format'
import type { Aniversariante } from '@/types/database'

interface TemplateOption {
  helena_template_id: string
  nome: string
  conteudo: string
  config: {
    id: string
    param_mapping: Record<string, string>
    horario_envio: string
    is_default: boolean
  } | null
}

interface ResultadoEnvio {
  nome: string
  ok: boolean
  error?: string
}

interface Props {
  clinicaSlug: string
  pacientes: Aniversariante[]
  telefoneInvalidoCount: number
  onScheduled: () => void
  onDone: () => void
}

// Painel lateral sempre visível — substitui o antigo ScheduleModal como
// fluxo de agendamento (design 2A): reflete a seleção atual da lista em vez
// de abrir por cima dela.
export function SchedulePanel({ clinicaSlug, pacientes, telefoneInvalidoCount, onScheduled, onDone }: Props) {
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [datetime, setDatetime] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultados, setResultados] = useState<ResultadoEnvio[] | null>(null)

  const emLote = pacientes.length > 1
  const primeiro = pacientes[0] ?? null
  const selectionKey = useMemo(() => pacientes.map((p) => p.id).sort().join(','), [pacientes])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/templates?clinica=${clinicaSlug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        const configured = (data.items as TemplateOption[]).filter((t) => t.config)
        setTemplates(configured)
        const def = configured.find((t) => t.config?.is_default) ?? configured[0]
        if (def) setSelectedId(def.config!.id)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [clinicaSlug])

  // Só reseta a data manual quando a seleção muda de fato — não quando
  // `resultados` está visível, pra não perder o horário digitado enquanto o
  // usuário ainda está olhando o resultado do envio anterior.
  useEffect(() => {
    setDatetime('')
  }, [selectionKey])

  const selected = templates.find((t) => t.config?.id === selectedId)

  function preview() {
    if (!selected || !primeiro || !selected.config) return selected?.conteudo ?? ''
    let out = selected.conteudo
    for (const [param, field] of Object.entries(selected.config.param_mapping)) {
      const source: Record<string, string> = {
        nome: primeiro.nome,
        primeiro_nome: primeiro.nome.split(' ')[0],
        data_nascimento: primeiro.datanascimento,
        aniversario: aniversarioParaExibicao(primeiro.aniversario),
      }
      out = out.replaceAll(`{{${param}}}`, source[field] ?? `{{${param}}}`)
    }
    return out
  }

  async function agendarUm(paciente: Aniversariante): Promise<ResultadoEnvio> {
    try {
      const res = await fetch('/api/scheduled-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinica_slug: clinicaSlug,
          template_id: selected!.config!.id,
          paciente,
          scheduling_override: !emLote && datetime ? new Date(datetime).toISOString() : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) return { nome: paciente.nome, ok: false, error: data.error ?? 'Erro ao agendar' }
      return { nome: paciente.nome, ok: true }
    } catch (e) {
      return { nome: paciente.nome, ok: false, error: (e as Error).message }
    }
  }

  async function handleConfirm() {
    if (pacientes.length === 0 || !selected?.config) return
    setSubmitting(true)
    setError(null)
    setResultados(null)
    try {
      const out: ResultadoEnvio[] = []
      for (const paciente of pacientes) out.push(await agendarUm(paciente))
      setResultados(out)
      onScheduled()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <aside className="w-[344px] shrink-0 rounded-2xl border border-slate-200 bg-white p-6">
      <span className="mb-3.5 block text-xs font-medium tracking-widest text-[var(--primary-from)] uppercase">
        O que será enviado
      </span>

      {loading && <p className="text-sm text-slate-500">Carregando modelos...</p>}
      {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      {!loading && !error && templates.length === 0 && (
        <p className="text-sm text-slate-500">
          Nenhum modelo configurado ainda. Vá em <strong>Modelos de mensagem</strong> e mapeie um template
          aprovado antes de agendar.
        </p>
      )}

      {!loading && templates.length > 0 && (
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-slate-200 bg-[var(--primary-soft)] p-4">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <strong className="text-sm font-semibold text-slate-900">{selected?.nome}</strong>
              {selected?.config?.is_default && (
                <span className="rounded-full bg-[var(--primary-from)] px-2 py-0.5 text-[11px] font-medium tracking-wide text-white">
                  PADRÃO
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-slate-600">{preview() || '—'}</p>
            {templates.length > 1 && (
              <select
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value)
                  setResultados(null)
                }}
                className="mt-3 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              >
                {templates.map((t) => (
                  <option key={t.config!.id} value={t.config!.id}>{t.nome}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-col gap-3.5">
            <Linha label="Quando" valor={emLote ? 'No dia do aniversário' : datetime ? 'Horário escolhido' : 'No dia do aniversário'} />
            <Linha label="Horário" valor={selected?.config?.horario_envio ?? '—'} />
            <Linha label="Selecionados" valor={String(pacientes.length)} />

            {!emLote && primeiro && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Data e hora manual (opcional)
                </label>
                <input
                  type="datetime-local"
                  value={datetime}
                  onChange={(e) => setDatetime(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>
            )}

            <div className="h-px bg-slate-100" />

            {telefoneInvalidoCount > 0 && (
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--status-canceled)] text-[10px] font-semibold text-[var(--status-canceled-fg)]">
                  !
                </span>
                <span className="text-xs leading-relaxed text-[var(--status-canceled-fg)]">
                  {telefoneInvalidoCount} paciente(s) com telefone inválido não puderam ser selecionados.
                </span>
              </div>
            )}

            <Button onClick={handleConfirm} disabled={pacientes.length === 0 || !selected || submitting}>
              {submitting
                ? 'Agendando...'
                : pacientes.length === 0
                  ? 'Selecione pacientes na lista'
                  : `Agendar ${pacientes.length} mensagem${pacientes.length > 1 ? 's' : ''}`}
            </Button>
            <p className="text-center text-xs text-slate-400">
              Você poderá cancelar qualquer envio até o dia anterior.
            </p>
          </div>

          {resultados && (
            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 pt-1">
              <p className="px-1 text-sm text-slate-600">
                {resultados.filter((r) => r.ok).length} de {resultados.length} agendado(s) com sucesso.
              </p>
              <div className="max-h-40 overflow-y-auto app-scroll">
                {resultados.map((r, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between border-t border-slate-100 px-2 py-1.5 text-sm first:border-t-0"
                  >
                    <span className="text-slate-700">{r.nome}</span>
                    {r.ok ? (
                      <span className="text-xs font-medium text-green-700">Agendado</span>
                    ) : (
                      <span className="text-xs font-medium text-red-600" title={r.error}>Falhou</span>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="secondary" size="sm" onClick={() => { setResultados(null); onDone() }}>
                Concluir
              </Button>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

function Linha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-500">{label}</span>
      <strong className="text-sm font-medium text-slate-900">{valor}</strong>
    </div>
  )
}
