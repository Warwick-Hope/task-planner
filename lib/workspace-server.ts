import type { SupabaseClient } from '@supabase/supabase-js'
import type { MemberRole, WorkspaceType } from '@/types'

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

export interface CallerWorkspace {
  id: string
  name: string
  type: WorkspaceType
  /** The caller's role in it — `restricted` cannot write. */
  role: MemberRole
}

/**
 * Every workspace this caller belongs to: their personal one, plus each
 * household.
 *
 * Phase 4.10 needed this because nothing in the app ever had to ask. The web UI
 * knows which workspace it is in from the URL, so the question "what can I
 * write to?" had no answer anywhere — and it is the first thing a connector has
 * to ask, since every other tool takes a workspace id (PLAN.md §"The tool
 * surface").
 *
 * The role comes back with it deliberately: a `restricted` member cannot create
 * tasks, and a caller that knows this can say so instead of collecting a 403.
 */
export async function listWorkspaces(
  supabase: SupabaseClient,
  userId: string
): Promise<CallerWorkspace[]> {
  const { data } = await supabase
    .from('workspace_members')
    .select('role, workspaces!inner(id, name, type)')
    .eq('user_id', userId)

  const rows = (data ?? []) as unknown as {
    role: MemberRole
    workspaces: { id: string; name: string; type: WorkspaceType }
  }[]

  return rows
    .filter(r => r.workspaces)
    .map(r => ({
      id: r.workspaces.id,
      name: r.workspaces.name,
      type: r.workspaces.type,
      role: r.role,
    }))
    // Personal first: it is the one a caller with no other information wants.
    .sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'personal' ? -1 : 1
    )
}

export interface WorkspaceCategory {
  id: string
  name: string
  colour: string
  parent_id: string | null
  sort_order: number
}

/**
 * The categories that apply in one workspace, whichever kind it is.
 *
 * The app never needed this because a page always knows which kind of workspace
 * it is on: personal categories hang off `owner_id`, household ones off
 * `workspace_id` with a null owner, and the two routes that read them each know
 * which they are. A caller holding only a workspace id — which is every
 * connector tool — does not, so the lookup has to happen somewhere, and it is
 * here rather than in the tool (PLAN.md §"The tool surface").
 *
 * Returns null when the workspace is not visible to this caller, which RLS
 * decides rather than this function.
 */
export async function listCategories(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string
): Promise<WorkspaceCategory[] | null> {
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, type')
    .eq('id', workspaceId)
    .single()

  if (!workspace) return null

  const columns = 'id, name, colour, parent_id, sort_order'

  const query =
    (workspace as { type: WorkspaceType }).type === 'personal'
      ? supabase.from('categories').select(columns).eq('owner_id', userId)
      : supabase.from('categories').select(columns).eq('workspace_id', workspaceId).is('owner_id', null)

  const { data } = await query.order('sort_order', { ascending: true })

  return (data ?? []) as WorkspaceCategory[]
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
