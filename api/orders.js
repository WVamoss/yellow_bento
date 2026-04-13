import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yenteikgtvtroisrzxua.supabase.co'
const supabaseKey = 'sb_publishable_qGydgh-HW5vECnCACrNd1g_OY4pS6yw'
const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { customer_name, customer_wa, total_price, cart } = req.body;

    if (!customer_name || !customer_wa || !cart) {
      return res.status(400).json({ error: 'Incomplete data' });
    }

    try {
      const { data, error } = await supabase
        .from('orders')
        .insert([{
          customer_name,
          customer_wa,
          total_price,
          items_json: cart,
          order_status: 'pending'
        }])
        .select();

      if (error) throw error;
      return res.status(200).json({ status: 'success', order_id: data[0].id });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET for Admin or Listing
  if (req.method === 'GET') {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return res.status(200).json(orders);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
}
