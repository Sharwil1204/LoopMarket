export async function api(path: string, options: RequestInit = {}) {
  const response = await fetch('/api' + path, {
    credentials: 'same-origin',
    ...options,
    headers: options.body instanceof FormData ? options.headers : {'Content-Type': 'application/json', ...options.headers},
  });

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    if (response.status === 503) {
      throw new Error('Service temporarily unavailable (503). Database configuration may still be provisioning.');
    }
    if (response.status === 500) {
      throw new Error('A server error occurred (500). Please check server logs or database connectivity.');
    }
    if (!response.ok) {
      throw new Error(`Request failed (${response.status}): ${text.slice(0, 150) || 'Unknown server response'}`);
    }
    throw new Error('Invalid response received from server.');
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}.`);
  }
  return data;
}

export const post = (path: string, data: any = {}) => api(path, {method: 'POST', body: JSON.stringify(data)});
export const currency = (n: number) => new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: n % 1 ? 2 : 0}).format(n);
export const when = (value: string, options: Intl.DateTimeFormatOptions = {dateStyle: 'medium'}) => new Intl.DateTimeFormat('en-IN', {timeZone: 'Asia/Kolkata', ...options}).format(new Date(value.length === 10 ? value + 'T12:00:00Z' : value));
export const dayNow = () => new Date(Date.now() + 19800000).toISOString().slice(0, 10);
export const label = (s: string) => s.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
export const price = (item: any) => item.type === 'giveaway' ? 'Free' : currency(item.price) + (item.type === 'rent' ? ` / ${item.rental_unit}` : '');
export const categories = ['Books', 'Electronics', 'Hostel Items', 'Stationery', 'Clothing', 'Sports', 'Lab Equipment', 'Furniture', 'Others'];
export const conditions = ['New', 'Like New', 'Good', 'Used'];
