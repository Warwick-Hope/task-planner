import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { unauthorised } from '@/lib/api'

export async function POST(_request: Request, { params }: { params: { token: string } }) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return unauthorised()

  const { data, error } = await supabase.rpc('accept_household_invitation', {
    p_token: params.token,
  })

  if (error) {
    const status = error.message.includes('not found') || error.message.includes('expired') ? 404 : 400
    return NextResponse.json({ error: error.message }, { status })
  }

  return NextResponse.json({ workspaceId: data })
}
