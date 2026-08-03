import { NextResponse } from 'next/server'
import { listClinicas } from '@/lib/clinicas'

export async function GET() {
  try {
    const clinicas = await listClinicas()
    return NextResponse.json({ clinicas })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
