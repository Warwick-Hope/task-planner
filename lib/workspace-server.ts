import type { SupabaseClient } from '@supabase/supabase-js'

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
