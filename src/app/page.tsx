import { Suspense } from 'react'
import { AniversariantesView } from '@/components/AniversariantesView'

export default function Home() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">Carregando...</p>}>
      <AniversariantesView />
    </Suspense>
  )
}
