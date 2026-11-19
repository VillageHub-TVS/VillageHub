import { supabase } from './supabase.js';

const TABLE = 'mobile_clinics';
const COLUMNS =
  'id, clinic_name, clinic_date, start_time, end_time, location, services, insurance_required, eligibility_notes, status, created_at';

const todayInRichmond = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const nowInRichmond = () => new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Los_Angeles', hour12: false });

function notOverYet(row) {
  if (row.clinic_date !== todayInRichmond() || !row.end_time) return true;
  return row.end_time > nowInRichmond();
}

function matchesQuery(row, query) {
  if (!query) return true;
  const words = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = [row.clinic_name, row.location, row.eligibility_notes, ...(row.services ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return words.some((w) => haystack.includes(w));
}

function shape(row) {
  return { ...row, confirmed_by_staff: row.status !== 'pending_review' };
}

export async function searchMobileClinics({ query, limit = 5 } = {}) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .gte('clinic_date', todayInRichmond())
    .order('clinic_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(100);
  if (error) throw new Error(`Supabase error: ${error.message}`);
  return (data ?? [])
    .filter((r) => r.status !== 'rejected')
    .filter(notOverYet)
    .filter((r) => matchesQuery(r, query))
    .slice(0, Math.min(Number(limit) || 5, 10))
    .map(shape);
}

export async function getMobileClinic({ id }) {
  const { data, error } = await supabase.from(TABLE).select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error(`Supabase error: ${error.message}`);
  return data ? shape(data) : null;
}
