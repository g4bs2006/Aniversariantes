'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from './ui/Button'
import { StatusBadge } from './ui/Badge'
import { ScheduleModal } from './ScheduleModal'
import { CLINICA_SLUG } from '@/lib/constants'
import { aniversarioParaExibicao, toE164BR } from '@/lib/format'
import type { Aniversariante, StatusEnvio } from '@/types/database'

interface Item extends Aniversariante {
  envio: { status: StatusEnvio; scheduled_for: string | null } | null
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function AniversariantesView() {
  const clinica = CLINICA_SLUG

  const [mes, setMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [items, setItems] = useState<Item[]>([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalPacientes, setModalPacientes] = useState<Aniversariante[] | null>(null)
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
  const filtrados = useMemo(() => {
    return items
      .filter((i) => i.nome.toLowerCase().includes(busca.toLowerCase()))
      .map((i) => ({ ...i, telefoneValido: !!toE164BR(i.celular || i.telefone || '') }))
  }, [items, busca])

  const agendados = items.filter((i) => i.envio && i.envio.status !== 'canceled').length
  const selecionaveis = filtrados.filter((i) => i.telefoneValido)
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

  function abrirAgendamentoEmLote() {
    const pacientes = filtrados.filter((i) => selecionados.has(i.id))
    if (pacientes.length > 0) setModalPacientes(pacientes)
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

      {selecionados.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50 px-4 py-2.5">
          <p className="text-sm font-medium text-purple-800">{selecionados.size} selecionado(s)</p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelecionados(new Set())}>Limpar seleção</Button>
            <Button size="sm" onClick={abrirAgendamentoEmLote}>Agendar selecionados</Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={todosSelecionados}
                  onChange={toggleTodos}
                  disabled={selecionaveis.length === 0}
                  aria-label="Selecionar todos"
                />
              </th>
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
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selecionados.has(item.id)}
                    onChange={() => toggleSelecionado(item.id)}
                    disabled={!item.telefoneValido}
                  />
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">{item.nome}</td>
                <td className="px-4 py-3 text-slate-500">
                  {item.celular || item.telefone || '—'}
                  {!item.telefoneValido && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      telefone inválido
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">{item.datanascimento}</td>
                <td className="px-4 py-3 text-slate-500">{aniversarioParaExibicao(item.aniversario)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.envio?.status ?? 'none'} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant={item.envio && item.envio.status !== 'canceled' ? 'secondary' : 'primary'}
                    onClick={() => setModalPacientes([item])}
                    disabled={!item.telefoneValido}
                    title={!item.telefoneValido ? 'Telefone inválido — não é possível enviar mensagem' : undefined}
                  >
                    {item.envio && item.envio.status !== 'canceled' ? 'Reagendar' : 'Agendar mensagem'}
                  </Button>
                </td>
              </tr>
            ))}
            {!loading && filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Nenhum aniversariante encontrado neste mês.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ScheduleModal
        open={!!modalPacientes}
        onClose={() => setModalPacientes(null)}
        clinicaSlug={clinica}
        pacientes={modalPacientes}
        onScheduled={() => {
          load()
          setSelecionados(new Set())
        }}
      />
    </div>
  )
}
