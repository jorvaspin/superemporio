const sessionCookie = 'superemporio_admin_session';

type Env = { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string };

export type AdminIdentity = { userId: string; role: 'owner' | 'operator'; accessToken: string };

function config(env: Env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) throw new Error('ADMIN_AUTH_NOT_CONFIGURED');
  return { url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY };
}

export async function getAdminIdentity(accessToken: string, env: Env): Promise<AdminIdentity | null> {
  try {
    const { url, anonKey } = config(env);
    const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` } });
    if (!userResponse.ok) return null;
    const user = await userResponse.json() as { id?: string };
    if (!user.id) return null;
    const memberResponse = await fetch(`${url}/rest/v1/admin_members?select=role,active&user_id=eq.${encodeURIComponent(user.id)}&active=eq.true`, { headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` } });
    if (!memberResponse.ok) return null;
    const members = await memberResponse.json() as { role: 'owner' | 'operator'; active: boolean }[];
    const member = members[0];
    return member?.active ? { userId: user.id, role: member.role, accessToken } : null;
  } catch { return null; }
}

export { sessionCookie };
