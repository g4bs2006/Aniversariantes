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

interface Props {
  open: boolean
  onClose: () => void
  clinicaSlug: string
  paciente: Aniversariante | null
  onScheduled: () => void
}

export function ScheduleModal({ open, onClose, clinicaSlug, paciente, onScheduled }: Props) {
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [datetime, setDatetime] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
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

  useEffect(() => {
    if (!paciente || !open) return
    setDatetime('')
  }, [paciente, open])

  const selected = templates.find((t) => t.config?.id === selectedId)

  function preview() {
    if (!selected || !paciente || !selected.config) return selected?.conteudo ?? ''
    let out = selected.conteudo
    for (const [param, field] of Object.entries(selected.config.param_mapping)) {
      const source: Record<string, string> = {
        nome: paciente.nome,
        primeiro_nome: paciente.nome.split(' ')[0],
        data_nascimento: paciente.datanascimento,
        aniversario: aniversarioParaExibicao(paciente.aniversario),
      }
      out = out.replaceAll(`{{${param}}}`, source[field] ?? `{{${param}}}`)
    }
    return out
  }

  async function handleConfirm() {
    if (!paciente || !selected?.config) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/scheduled-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinica_slug: clinicaSlug,
          template_id: selected.config.id,
          paciente,
          scheduling_override: datetime ? new Date(datetime).toISOString() : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao agendar')
      onScheduled()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={paciente ? `Agendar parabéns · ${paciente.nome}` : 'Agendar mensagem'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!selected || submitting}>
            {submitting ? 'Agendando...' : 'Confirmar agendamento'}
          </Button>
        </>
      }
    >
      {loading && <p className="text-sm text-slate-500">Carregando modelos...</p>}
      {error && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      {!loading && templates.length === 0 && (
        <p className="text-sm text-slate-500">
          Nenhum modelo configurado ainda. Vá em <strong>Modelos de mensagem</strong> e mapeie um template
          aprovado antes de agendar.
        </p>
      )}

      {!loading && templates.length > 0 && (
        <div className="flex flex-col gap-4">
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Prévia da mensagem</label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap">
              {preview() || '—'}
            </div>
          </div>

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
        </div>
      )}
    </Modal>
  )
}
