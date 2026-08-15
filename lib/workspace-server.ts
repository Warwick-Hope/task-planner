import type { SupabaseClient } from '@supabase/supabase-js'
import type { MemberRole } from '@/types'

export async function getPersonalWorkspaceId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('workspaces')
    .select('id')
    .eq('created_by', userId)
    .eq('type', 'personal')
    .single()
  return data?.id ?? null
}

/**
 * Ingredients hang off a meal, not a workspace, so routes under
 * /household/[id]/meals/[mealId]/ingredients scope by this linkage.
 */
export async function mealBelongsToWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
  mealId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('meals')
    .select('id')
    .eq('id', mealId)
    .eq('workspace_id', workspaceId)
    .single()
  return !!data
}

export interface RequireMemberOptions {
  /** Reject `restricted` members — use on every write route. */
  blockRestricted?: boolean
  /** Reject anyone who is not the workspace owner. */
  ownerOnly?: boolean
}

/**
 * Confirms the caller is a member of the workspace with sufficient role.
 * Returns their membership, or null when the route should respond 403.
 *
 * RLS enforces membership but not roles, so every household route calls this
 * before touching workspace data — it is the only place role is checked.
 */
export async function requireMember(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  opts: RequireMemberOptions = {}
): Promise<{ role: MemberRole } | null> {
  const { data } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single()

  if (!data) return null

  const role = data.role as MemberRole
  if (opts.ownerOnly && role !== 'owner') return null
  if (opts.blockRestricted && role === 'restricted') return null

  return { role }
}
