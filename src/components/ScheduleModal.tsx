'use client'

import { useEffect, useState } from 'react'
import { Modal } from './ui/Modal'
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
  open: boolean
  onClose: () => void
  clinicaSlug: string
  pacientes: Aniversariante[] | null
  onScheduled: () => void
}

export function ScheduleModal({ open, onClose, clinicaSlug, pacientes, onScheduled }: Props) {
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [datetime, setDatetime] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultados, setResultados] = useState<ResultadoEnvio[] | null>(null)

  const emLote = (pacientes?.length ?? 0) > 1
  const primeiro = pacientes?.[0] ?? null

  useEffect(() => {
    if (!open) return
    setError(null)
    setResultados(null)
    setDatetime('')
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
  }, [open, clinicaSlug])

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
          // Data manual só faz sentido pra um paciente por vez — em lote,
          // cada um usa a data do próprio aniversário.
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
    if (!pacientes || pacientes.length === 0 || !selected?.config) return
    setSubmitting(true)
    setError(null)
    try {
      const out: ResultadoEnvio[] = []
      for (const paciente of pacientes) {
        out.push(await agendarUm(paciente))
      }
      setResultados(out)
      onScheduled()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleFechar() {
    setResultados(null)
    onClose()
  }

  const titulo = resultados
    ? 'Resultado do agendamento'
    : emLote
      ? `Agendar parabéns · ${pacientes!.length} pacientes`
      : primeiro
        ? `Agendar parabéns · ${primeiro.nome}`
        : 'Agendar mensagem'

  return (
    <Modal
      open={open}
      onClose={handleFechar}
      title={titulo}
      footer={
        resultados ? (
          <Button onClick={handleFechar}>Fechar</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={handleFechar}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={!selected || submitting}>
              {submitting
                ? 'Agendando...'
                : emLote
                  ? `Confirmar agendamento (${pacientes!.length})`
                  : 'Confirmar agendamento'}
            </Button>
          </>
        )
      }
    >
      {resultados && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-600">
            {resultados.filter((r) => r.ok).length} de {resultados.length} agendado(s) com sucesso.
          </p>
          <div className="max-h-64 overflow-y-auto app-scroll rounded-lg border border-slate-200">
            {resultados.map((r, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm last:border-b-0"
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
        </div>
      )}

      {!resultados && loading && <p className="text-sm text-slate-500">Carregando modelos...</p>}
      {!resultados && error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      {!resultados && !loading && templates.length === 0 && (
        <p className="text-sm text-slate-500">
          Nenhum modelo configurado ainda. Vá em <strong>Modelos de mensagem</strong> e mapeie um template
          aprovado antes de agendar.
        </p>
      )}

      {!resultados && !loading && templates.length > 0 && (
        <div className="flex flex-col gap-4">
          {emLote && (
            <p className="rounded-lg bg-slate-50 p-2 text-sm text-slate-600">
              Cada paciente recebe a mensagem no horário padrão do próprio aniversário — não dá pra escolher
              uma data única pra todo mundo.
            </p>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Modelo de mensagem</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-mid)]"
            >
              {templates.map((t) => (
                <option key={t.config!.id} value={t.config!.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Prévia da mensagem {emLote && <span className="font-normal text-slate-400">(exemplo com {primeiro?.nome})</span>}
            </label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap">
              {preview() || '—'}
            </div>
          </div>

          {!emLote && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Data e hora do envio <span className="font-normal text-slate-400">(padrão: dia do aniversário)</span>
              </label>
              <input
                type="datetime-local"
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-mid)]"
              />
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
