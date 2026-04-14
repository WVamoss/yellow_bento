import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yenteikgtvtroisrzxua.supabase.co'
const supabaseKey = 'sb_publishable_qGydgh-HW5vECnCACrNd1g_OY4pS6yw'
const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  console.log('Fetching menu items from Supabase...');

  try {
    const { data: menu_items, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('is_active', { ascending: false })
      .order('category', { ascending: true })
      .order('id', { ascending: false });

    if (error) throw error;
    console.log('Successfully fetched', menu_items.length, 'items');
    return res.status(200).json(menu_items);
  } catch (err) {
    console.error('Supabase Error:', err.message);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
