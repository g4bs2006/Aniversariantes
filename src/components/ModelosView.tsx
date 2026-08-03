'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from './ui/Button'

interface TemplateItem {
  helena_template_id: string
  nome: string
  conteudo: string
  config: {
    id: string
    param_mapping: Record<string, string>
    dia_envio: string
    horario_envio: string
    is_default: boolean
    ativo: boolean
  } | null
}

const FIELD_OPTIONS = [
  { value: 'nome', label: 'Nome completo' },
  { value: 'primeiro_nome', label: 'Primeiro nome' },
  { value: 'data_nascimento', label: 'Data de nascimento' },
  { value: 'aniversario', label: 'Dia/mês de aniversário' },
]

function extractParams(conteudo: string) {
  const matches = conteudo.matchAll(/{{\s*(\w+)\s*}}/g)
  return Array.from(new Set(Array.from(matches, (m) => m[1])))
}

function TemplateCard({
  template,
  clinicaSlug,
  onSaved,
}: {
  template: TemplateItem
  clinicaSlug: string
  onSaved: () => void
}) {
  const params = extractParams(template.conteudo)
  const [mapping, setMapping] = useState<Record<string, string>>(
    template.config?.param_mapping ?? Object.fromEntries(params.map((p) => [p, 'nome']))
  )
  const [diaEnvio, setDiaEnvio] = useState(template.config?.dia_envio ?? 'aniversario')
  const [horario, setHorario] = useState(template.config?.horario_envio ?? '09:00')
  const [isDefault, setIsDefault] = useState(template.config?.is_default ?? false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinica_slug: clinicaSlug,
          helena_template_id: template.helena_template_id,
          nome: template.nome,
          param_mapping: mapping,
          dia_envio: diaEnvio,
          horario_envio: horario,
          is_default: isDefault,
          ativo: true,
        }),
      })
      setSaved(true)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">{template.nome}</h3>
          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
            {template.conteudo || '(sem prévia de conteúdo)'}
          </p>
        </div>
        {template.config?.is_default && (
          <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700">Padrão</span>
        )}
      </div>

      {params.length === 0 ? (
        <p className="text-sm text-slate-400">Este modelo não tem variáveis para mapear.</p>
      ) : (
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          {params.map((p) => (
            <div key={p} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs font-mono text-slate-400">{`{{${p}}}`}</span>
              <select
                value={mapping[p] ?? 'nome'}
                onChange={(e) => setMapping((m) => ({ ...m, [p]: e.target.value }))}
                className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              >
                {FIELD_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Enviar
          <select
            value={diaEnvio}
            onChange={(e) => setDiaEnvio(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="aniversario">No dia do aniversário</option>
            <option value="1_dia_antes">1 dia antes</option>
            <option value="3_dias_antes">3 dias antes</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          Às
          <input
            type="time"
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          Modelo padrão de aniversário
        </label>

        <Button size="sm" onClick={handleSave} disabled={saving} className="ml-auto">
          {saving ? 'Salvando...' : saved ? 'Salvo ✓' : 'Salvar configuração'}
        </Button>
      </div>
    </div>
  )
}

export function ModelosView() {
  const searchParams = useSearchParams()
  const clinica = searchParams.get('clinica')
  const [items, setItems] = useState<TemplateItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!clinica) return
    setLoading(true)
    fetch(`/api/templates?clinica=${clinica}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setItems(data.items ?? [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [clinica])

  useEffect(() => {
    load()
  }, [load])

  if (!clinica) return <p className="text-sm text-slate-500">Selecione uma clínica no topo da página.</p>

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Modelos de mensagem</h1>
        <p className="text-sm text-slate-500">
          Templates aprovados na Helena para agendamento. Mapeie as variáveis com os dados do aniversariante.
        </p>
      </div>

      {loading && <p className="text-sm text-slate-400">Carregando templates aprovados...</p>}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      {!loading && items.length === 0 && !error && (
        <p className="text-sm text-slate-500">
          Nenhum modelo de tipo &quot;SCHEDULEDMESSAGE&quot; aprovado encontrado na Helena para esta clínica.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {items.map((t) => (
          <TemplateCard key={t.helena_template_id} template={t} clinicaSlug={clinica} onSaved={load} />
        ))}
      </div>
    </div>
  )
}
