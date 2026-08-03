'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from './ui/Button'
import { StatusBadge } from './ui/Badge'
import type { Envio } from '@/types/database'

export function HistoricoView() {
  const searchParams = useSearchParams()
  const clinica = searchParams.get('clinica')
  const [items, setItems] = useState<Envio[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!clinica) return
    setLoading(true)
    fetch(`/api/historico?clinica=${clinica}`)
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

  async function handleCancel(id: string) {
    if (!clinica) return
    setCancelingId(id)
    try {
      const res = await fetch(`/api/scheduled-message/${id}/cancel?clinica=${clinica}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCancelingId(null)
    }
  }

  if (!clinica) return <p className="text-sm text-slate-500">Selecione uma clínica no topo da página.</p>

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Histórico de envios</h1>
        <p className="text-sm text-slate-500">Todas as mensagens de aniversário agendadas para esta clínica.</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Paciente</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">Data/hora do envio</th>
              <th className="px-4 py-3">Ano</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{item.paciente_nome}</td>
                <td className="px-4 py-3 text-slate-500">{item.paciente_telefone}</td>
                <td className="px-4 py-3 text-slate-500">
                  {item.scheduled_for ? new Date(item.scheduled_for).toLocaleString('pt-BR') : '—'}
                </td>
                <td className="px-4 py-3 text-slate-500">{item.ano}</td>
                <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                <td className="px-4 py-3 text-right">
                  {item.status === 'scheduled' && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleCancel(item.id)}
                      disabled={cancelingId === item.id}
                    >
                      {cancelingId === item.id ? 'Cancelando...' : 'Cancelar'}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nenhum envio registrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
