import { Suspense } from 'react'
import { HistoricoView } from '@/components/HistoricoView'

export default function HistoricoPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">Carregando...</p>}>
      <HistoricoView />
    </Suspense>
  )
}
