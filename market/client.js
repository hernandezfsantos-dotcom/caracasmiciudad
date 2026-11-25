export { db } from '../supabase-client.js';

export function value(result) {
  if (result.error) throw result.error;
  return result.data;
}

export const money = (amount, currency) => new Intl.NumberFormat('es-VE', {
  style: 'currency', currency: currency || 'USD', currencyDisplay: 'code'
}).format(amount ?? 0);

export const date = timestamp => timestamp ? new Intl.DateTimeFormat('es-VE', {
  timeZone: 'America/Caracas', dateStyle: 'medium', timeStyle: 'short'
}).format(new Date(timestamp)) : 'Por confirmar';

export const localTime = timestamp => timestamp
  ? new Date(Date.parse(timestamp) - 4 * 3600000).toISOString().slice(0, 16)
  : '';
