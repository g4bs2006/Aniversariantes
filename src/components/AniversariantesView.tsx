'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from './ui/Button'
import { StatusBadge } from './ui/Badge'
import { ScheduleModal } from './ScheduleModal'
import type { Aniversariante, StatusEnvio } from '@/types/database'

interface Item extends Aniversariante {
  envio: { status: StatusEnvio; scheduled_for: string | null } | null
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function AniversariantesView() {
  const searchParams = useSearchParams()
  const clinica = searchParams.get('clinica')

  const [mes, setMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [items, setItems] = useState<Item[]>([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalPaciente, setModalPaciente] = useState<Aniversariante | null>(null)

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

  const filtrados = items.filter((i) => i.nome.toLowerCase().includes(busca.toLowerCase()))
  const agendados = items.filter((i) => i.envio && i.envio.status !== 'canceled').length

  if (!clinica) {
    return <p className="text-sm text-slate-500">Selecione uma clínica no topo da página.</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Aniversariantes</h1>
          <p className="text-sm text-slate-500">
            {loading ? 'Carregando...' : `${filtrados.length} aniversariantes em ${MESES[parseInt(mes, 10) - 1]} · ${agendados} agendados`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            placeholder="Buscar por nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-mid)]"
          />
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-mid)]"
          >
            {MESES.map((m, idx) => (
              <option key={m} value={String(idx + 1).padStart(2, '0')}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">Nascimento</th>
              <th className="px-4 py-3">Aniversário</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtrados.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{item.nome}</td>
                <td className="px-4 py-3 text-slate-500">{item.celular || item.telefone}</td>
                <td className="px-4 py-3 text-slate-500">{item.datanascimento}</td>
                <td className="px-4 py-3 text-slate-500">{item.aniversario}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.envio?.status ?? 'none'} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant={item.envio && item.envio.status !== 'canceled' ? 'secondary' : 'primary'}
                    onClick={() => setModalPaciente(item)}
                  >
                    {item.envio && item.envio.status !== 'canceled' ? 'Reagendar' : 'Agendar mensagem'}
                  </Button>
                </td>
              </tr>
            ))}
            {!loading && filtrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nenhum aniversariante encontrado neste mês.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ScheduleModal
        open={!!modalPaciente}
        onClose={() => setModalPaciente(null)}
        clinicaSlug={clinica}
        paciente={modalPaciente}
        onScheduled={load}
      />
    </div>
  )
}
