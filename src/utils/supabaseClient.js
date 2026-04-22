const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseClientPromise = null;

async function requireConfiguredClient() {
  const client = await getSupabaseClient();

  if (!client) {
    throw new Error('Supabase chưa được cấu hình. Hãy khai báo VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY.');
  }

  return client;
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export async function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;

  if (!supabaseClientPromise) {
    supabaseClientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true,
        },
      })
    );
  }

  return supabaseClientPromise;
}

export async function sendMagicLink(email, redirectTo) {
  const supabase = await requireConfiguredClient();
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
    },
  });

  if (error) throw error;
  return data;
}

export async function signOutSupabase() {
  const supabase = await requireConfiguredClient();
  const { error } = await supabase.auth.signOut();

  if (error) throw error;
}

export async function getSupabaseSession() {
  const supabase = await requireConfiguredClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) throw error;
  return data.session;
}

export async function subscribeToAuthChanges(callback) {
  const supabase = await getSupabaseClient();

  if (!supabase) {
    return () => {};
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    callback({ event, session });
  });

  return () => subscription.unsubscribe();
}

export async function savePlanToCloud({ planId, name, scene, summary, containerType }) {
  const supabase = await requireConfiguredClient();
  const payload = {
    name,
    scene,
    summary,
    container_type: containerType,
  };

  const query = planId
    ? supabase
        .from('saved_plans')
        .update(payload)
        .eq('id', planId)
        .select('id,name,summary,container_type,created_at,updated_at')
        .single()
    : supabase
        .from('saved_plans')
        .insert(payload)
        .select('id,name,summary,container_type,created_at,updated_at')
        .single();

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function listCloudPlans(limit = 20) {
  const supabase = await requireConfiguredClient();
  const { data, error } = await supabase
    .from('saved_plans')
    .select('id,name,summary,container_type,created_at,updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function loadCloudPlan(planId) {
  const supabase = await requireConfiguredClient();
  const { data, error } = await supabase
    .from('saved_plans')
    .select('id,name,scene,summary,container_type,created_at,updated_at')
    .eq('id', planId)
    .single();

  if (error) throw error;
  return data;
}
