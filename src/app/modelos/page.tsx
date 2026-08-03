import { Suspense } from 'react'
import { ModelosView } from '@/components/ModelosView'

export default function ModelosPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">Carregando...</p>}>
      <ModelosView />
    </Suspense>
  )
}
