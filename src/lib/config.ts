export const appDefaults = {
  businessName: "MST Household",
  currency: "PHP",
  timezone: "Asia/Singapore"
};

export function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
