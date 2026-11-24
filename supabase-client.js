import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';
export const db = createClient('https://mgnxulbyeicgcivnsksx.supabase.co','sb_publishable_W33HJe4QWL1gwqSxgaTFmg_L8NwWdsy');
export const login=(email,password)=>db.auth.signInWithPassword({email,password});
export const logout=()=>db.auth.signOut();
export const register=(email,password)=>db.auth.signUp({email,password});
export const session=()=>db.auth.getSession();
