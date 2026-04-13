import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yenteikgtvtroisrzxua.supabase.co'
const supabaseKey = 'sb_publishable_qGydgh-HW5vECnCACrNd1g_OY4pS6yw'
const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, id, status } = req.query;

  try {
    if (action === 'update_order') {
      const { error } = await supabase
        .from('orders')
        .update({ order_status: status })
        .eq('id', id);
      if (error) throw error;
      return res.status(200).json({ status: 'success' });
    }

    if (action === 'delete_order') {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return res.status(200).json({ status: 'success' });
    }

    if (action === 'toggle_menu') {
      // First get current status
      const { data: item } = await supabase.from('menu_items').select('is_active').eq('id', id).single();
      const { error } = await supabase
        .from('menu_items')
        .update({ is_active: !item.is_active })
        .eq('id', id);
      if (error) throw error;
      return res.status(200).json({ status: 'success' });
    }

    if (action === 'stats') {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: sales } = await supabase
        .from('orders')
        .select('total_price')
        .neq('order_status', 'cancelled')
        .gte('created_at', today);
      
      const { count: pending } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('order_status', 'pending');

      const { count: total } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      const todayTotal = sales.reduce((sum, row) => sum + row.total_price, 0);

      return res.status(200).json({
        today_sales: todayTotal,
        pending_count: pending,
        total_orders: total
      });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
