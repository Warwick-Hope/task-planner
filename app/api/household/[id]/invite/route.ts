import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { requireMember } from '@/lib/workspace-server'
import { unauthorised, forbidden, parseJson, badBody, requestOrigin } from '@/lib/api'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return unauthorised()

  const membership = await requireMember(supabase, params.id, user.id, { ownerOnly: true })
  if (!membership) {
    return NextResponse.json({ error: 'Only the owner can invite members' }, { status: 403 })
  }

  const body = await parseJson<{ email?: unknown; role?: unknown }>(request)
  if (!body) return badBody()

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const role = body.role === 'restricted' ? 'restricted' : 'adult'

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }

  // Duplicate-member check is enforced in the accept_household_invitation DB function
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

  const { error } = await supabase.from('household_invitations').insert({
    workspace_id: params.id,
    email,
    role,
    token,
    expires_at: expiresAt,
    created_by: user.id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Absolute: this link is copied into a message and opened elsewhere.
  const inviteUrl = `${requestOrigin(request)}/invite/${token}`

  return NextResponse.json({ token, inviteUrl, expiresAt })
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return unauthorised()

  const membership = await requireMember(supabase, params.id, user.id, { ownerOnly: true })
  if (!membership) return forbidden()

  const { data: invitations } = await supabase
    .from('household_invitations')
    .select('id, email, role, expires_at, accepted_at, created_at')
    .eq('workspace_id', params.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ invitations: invitations ?? [] })
}
