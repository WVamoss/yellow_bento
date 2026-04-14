import React, { useState, useEffect, useRef } from 'react';
import './index.css';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  image: string;
  category: string;
  is_active: any; 
  options_type: string;
}

interface CartItem extends MenuItem {
  cartKey: string;
  quantity: number;
  selectedOptions?: string;
}

const STATIC_QRIS = "00020101021126650013ID.CO.BCA.WWW011893600014000265739502150008850026573950303UMI51440014ID.CO.QRIS.WWW0215ID10243580761890303UMI5204581453033605802ID5912yellow bento6008SIDOARJO61056121662070703A016304E76D";

// Dynamic API URL for Vercel Serverless Functions
const API_BASE_URL = '/api';
const MENU_API = `${API_BASE_URL}/menu`;
const ORDERS_API = `${API_BASE_URL}/orders`;
const ADMIN_API = `${API_BASE_URL}/admin`;

function calculateCRC16(data: string) {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    let charCode = data.charCodeAt(i);
    crc ^= charCode;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x0001) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc >>= 1;
      }
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

function generateDynamicQRIS(amount: number) {
  let qris = STATIC_QRIS.substring(0, STATIC_QRIS.length - 4);
  const amountStr = amount.toString();
  const amountTag = "54" + amountStr.length.toString().padStart(2, '0') + amountStr;
  
  if (qris.includes("54")) {
    qris = qris.replace(/54\d{2}\d+/, amountTag);
  } else {
    const pos = qris.indexOf("5802ID");
    qris = qris.substring(0, pos) + amountTag + qris.substring(pos);
  }
  
  return qris + calculateCRC16(qris);
}

function App() {
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Core States
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerWA, setCustomerWA] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');

  // Auth States
  const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem('admin_session') === 'active');
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // States for variety options
  const [configItem, setConfigItem] = useState<MenuItem | null>(null);
  const [selLevel, setSelLevel] = useState('0');
  const [selToppings, setSelToppings] = useState<Record<string, number>>({});
  const [selVariant, setSelVariant] = useState('Beef');

  // Header Scroll Effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch Menu
  useEffect(() => {
    fetch(MENU_API)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setMenuItems(data);
      })
      .catch(err => console.error("Failed to fetch menu:", err));
  }, []);

  const handleAddToCartClick = (item: MenuItem) => {
    if (item.options_type !== 'none' && item.options_type !== null) {
      setConfigItem(item);
      setSelLevel('0');
      setSelToppings({});
      setSelVariant(item.options_type === 'burger_variant' ? 'Beef' : '');
      setIsOptionsOpen(true);
    } else {
      addToCart(item, '');
    }
  };

  const updateToppingQty = (t: string, delta: number) => {
    setSelToppings(prev => {
      const newQty = (prev[t] || 0) + delta;
      if (newQty <= 0) {
        const next = { ...prev };
        delete next[t];
        return next;
      }
      return { ...prev, [t]: newQty };
    });
  };

  const confirmOptions = () => {
    if (!configItem) return;
    let optStr = "";
    if (configItem.options_type === 'kuah_level') {
      optStr = `Level ${selLevel}`;
      const tops = Object.entries(selToppings).map(([n, q]) => `${n} x${q}`).join(', ');
      if (tops) optStr += ` + ${tops}`;
    } else if (configItem.options_type === 'gorengan_topping') {
      optStr = Object.keys(selToppings).join(', ');
    } else if (configItem.options_type === 'burger_variant') {
      optStr = selVariant;
    }
    addToCart(configItem, optStr);
    setIsOptionsOpen(false);
  };

  const addToCart = (item: MenuItem, options: string) => {
    const cartKey = `${item.id}-${options}`;
    setCart(prev => {
      const existing = prev.find(i => i.cartKey === cartKey);
      if (existing) {
        return prev.map(i => i.cartKey === cartKey ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, cartKey, quantity: 1, selectedOptions: options }];
    });
    setIsCartOpen(true);
  };

  const updateQty = (key: string, delta: number) => {
    setCart(prev => prev.map(i => i.cartKey === key ? { ...i, quantity: i.quantity + delta } : i).filter(i => i.quantity > 0));
  };

  const totalPrice = cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);

  const confirmOrder = () => {
    if (!customerName || !customerWA) return alert('Mohon isi nama dan nomor WhatsApp Anda');
    const orderList = cart.map(i => `- ${i.name} ${i.selectedOptions ? `(${i.selectedOptions})` : ''} [${i.quantity}x]`).join('%0A');
    const message = `Halo Yellow Bento 99!%0A%0ASaya ingin memesan:%0A${orderList}%0A%0ATotal: *Rp ${totalPrice.toLocaleString('id-ID')}*%0A%0ANama: ${customerName}%0AWA: ${customerWA}%0A%0ASaya sudah melihat QRIS di web. Mohon konfirmasi pesanannya ya!`;
    
    fetch(ORDERS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: customerName, customer_wa: customerWA, total_price: totalPrice, cart: cart })
    }).finally(() => window.open(`https://wa.me/6281217774299?text=${message}`, '_blank'));
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple verification (can be moved to API later for more security)
    if (loginUser === 'admin' && loginPass === 'admin123') {
      localStorage.setItem('admin_session', 'active');
      setIsAuthenticated(true);
    } else {
      alert('Username atau Password salah!');
    }
  };

  const logout = () => {
    localStorage.removeItem('admin_session');
    setIsAuthenticated(false);
    window.location.href = '/';
  };

  const AdminDashboard = () => {
    const [orders, setOrders] = useState<any[]>([]);
    const [stats, setStats] = useState<any>({ today_sales: 0, pending_count: 0, total_orders: 0 });

    useEffect(() => {
      fetch(ORDERS_API).then(r => r.json()).then(setOrders);
      fetch(`${ADMIN_API}?action=stats`).then(r => r.json()).then(setStats);
    }, []);

    const updateStatus = async (id: number, status: string) => {
      await fetch(`${ADMIN_API}?action=update_order&id=${id}&status=${status}`);
      fetch(ORDERS_API).then(r => r.json()).then(setOrders);
      fetch(`${ADMIN_API}?action=stats`).then(r => r.json()).then(setStats);
    };

    const toggleMenu = async (id: number) => {
      await fetch(`${ADMIN_API}?action=toggle_menu&id=${id}`);
      fetch(MENU_API).then(r => r.json()).then(setMenuItems);
    };

    const deleteOrder = async (id: number) => {
      if (!confirm('Hapus order?')) return;
      await fetch(`${ADMIN_API}?action=delete_order&id=${id}`);
      fetch(ORDERS_API).then(r => r.json()).then(setOrders);
    };

    return (
      <div className="admin-dashboard glass" style={{ padding: '2rem', maxWidth: '1200px', margin: '2rem auto', borderRadius: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontFamily: 'Playfair Display', fontSize: '2rem' }}>Admin Center</h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
             <button onClick={() => window.location.href='/'} className="category-chip active">Lihat Toko</button>
             <button onClick={logout} className="category-chip" style={{ background: '#FEE2E2', color: '#DC2626', border: 'none' }}>Logout</button>
          </div>
        </div>

        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <div className="stat-card glass" style={{ padding: '1.5rem', borderRadius: '20px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B' }}>PENJUALAN HARI INI</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>Rp {stats.today_sales?.toLocaleString('id-ID')}</div>
          </div>
          <div className="stat-card glass" style={{ padding: '1.5rem', borderRadius: '20px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B' }}>ORDER PENDING</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.pending_count}</div>
          </div>
          <div className="stat-card glass" style={{ padding: '1.5rem', borderRadius: '20px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B' }}>TOTAL ORDER</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.total_orders}</div>
          </div>
        </div>

        <div className="glass" style={{ padding: '1.5rem', borderRadius: '24px', overflowX: 'auto', marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Pesanan Terbaru</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #EEE' }}>
                <th style={{ padding: '1rem' }}>Customer</th>
                <th style={{ padding: '1rem' }}>Total</th>
                <th style={{ padding: '1rem' }}>Status</th>
                <th style={{ padding: '1rem' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o: any) => (
                <tr key={o.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 700 }}>{o.customer_name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#10B981' }}>{o.customer_wa}</div>
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 700 }}>Rp {o.total_price.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ padding: '0.4rem 0.8rem', borderRadius: '50px', fontSize: '0.7rem', fontWeight: 800, background: o.order_status === 'pending' ? '#FEF3C7' : '#D1FAE5', color: o.order_status === 'pending' ? '#D97706' : '#059669' }}>
                      {o.order_status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                    {o.order_status === 'pending' && <button onClick={() => updateStatus(o.id, 'processing')} className="category-chip">⚙️</button>}
                    {o.order_status === 'processing' && <button onClick={() => updateStatus(o.id, 'completed')} className="category-chip active">✓</button>}
                    <button onClick={() => deleteOrder(o.id)} className="category-chip" style={{ color: 'red' }}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="glass" style={{ padding: '1.5rem', borderRadius: '24px' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Kelola Stok Menu</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {menuItems.map(item => (
              <div key={item.id} className="glass" style={{ padding: '1rem', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: item.is_active ? 1 : 0.5 }}>
                <span style={{ fontWeight: 700 }}>{item.name}</span>
                <button onClick={() => toggleMenu(item.id)} className={`category-chip ${item.is_active ? 'active' : ''}`}>
                  {item.is_active ? 'Tersedia' : 'Habis'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const AdminLoginPage = () => (
    <div className="login-page">
      <div className="login-card glass animate-up">
        <img src="/assets/logo.jpg" alt="Logo" style={{ width: '80px', borderRadius: '50%', marginBottom: '2rem' }} />
        <h2 style={{ fontFamily: 'Playfair Display', marginBottom: '0.5rem' }}>Login Admin</h2>
        <p style={{ color: '#64748B', marginBottom: '2rem' }}>Kelola pesanan Yellow Bento 99</p>
        <form onSubmit={handleLogin} style={{ width: '100%' }}>
          <div className="input-group">
            <label>Username</label>
            <input type="text" value={loginUser} onChange={e => setLoginUser(e.target.value)} placeholder="Username admin" />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="••••••••" />
          </div>
          <button type="submit" className="add-btn">MASUK SEKARANG</button>
        </form>
        <a href="/" style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: '#94A3B8', textDecoration: 'none' }}>← Kembali ke Toko</a>
      </div>
    </div>
  );

  const isAdminRoute = window.location.search === '?admin=true';
  const categories = ['Semua', ...Array.from(new Set(menuItems.map(i => i.category))).filter(Boolean)];

  return (
    <div className="app">
      {isAdminRoute ? (isAuthenticated ? <AdminDashboard /> : <AdminLoginPage />) : (
        <>
          <div className={`overlay ${(isCartOpen || isModalOpen || isOptionsOpen) ? 'open' : ''}`} onClick={() => { setIsCartOpen(false); setIsModalOpen(false); setIsOptionsOpen(false); }}></div>

          <header className={scrolled ? 'scrolled' : ''}>
            <div className="container header-container">
              <a href="/" className="logo-container">
                <img src="/assets/logo.jpg" alt="Logo" className="logo-img" />
                <span className="brand-name">Yellow Bento 99</span>
              </a>
              <nav className="nav-links">
                <a href="#" className="nav-link">Beranda</a>
                <a href="#menu" className="nav-link">Daftar Menu</a>
                <a href="#testi" className="nav-link">Testimoni</a>
                <a href="#location" className="nav-link">Info Lokasi</a>
              </nav>
              <button onClick={() => setIsCartOpen(true)} className="add-btn" style={{ margin: 0, padding: '0.6rem 1.6rem', width: 'auto', borderRadius: '50px', background: 'var(--brand-yellow)', color: 'var(--brand-dark)' }}>
                🛒 <b>{cart.reduce((s, i) => s + i.quantity, 0)}</b>
              </button>
            </div>
          </header>

          <main>
            <section className="hero">
              <div className="hero-bg-accent"></div>
              <div className="container hero-grid">
                <div className="hero-content">
                  <div className="hero-badge">✨ Kelezatan Autentik</div>
                  <h1>
                    <span>Bento Premium,</span>
                    <span style={{ color: 'var(--brand-orange)' }}>Citarasa Sempurna.</span>
                  </h1>
                  <p>Menghadirkan perpaduan bento berkualitas tinggi yang diracik dengan bumbu rahasia autentik. Pilihan utama untuk pengalaman kuliner yang istimewa setiap harinya.</p>
                  <div className="hero-btns" style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                    <a href="#menu" className="add-btn" style={{ width: 'auto', padding: '1.2rem 2.5rem', textDecoration: 'none' }}>🍽️ Eksplorasi Menu</a>
                    <a href="#location" className="add-btn" style={{ width: 'auto', padding: '1.2rem 2.5rem', textDecoration: 'none', background: 'white', color: 'var(--brand-dark)', border: '1px solid #DDD' }}>📍 Lokasi Kami</a>
                  </div>
                </div>
                <div className="hero-image-container">
                  <img src="/assets/hero_platter.png" alt="Hero Platter" className="hero-main-img" onError={(e) => e.currentTarget.src = "/assets/menu/mix-tempura.jpg"} />
                  <div className="hero-floating-card f-card-1 animate-float">
                    <div style={{ background: '#FFF7ED', padding: '0.5rem', borderRadius: '12px' }}>🍱</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.8rem' }}>Favorit Pelanggan</div>
                      <div style={{ color: '#94A3B8', fontSize: '0.7rem' }}>Kualitas Terjamin</div>
                    </div>
                  </div>
                  <div className="hero-floating-card f-card-2 animate-float" style={{ animationDelay: '2s' }}>
                    <div style={{ background: '#F0FDF4', padding: '0.5rem', borderRadius: '12px' }}>⭐</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.8rem' }}>Higiene Terjaga</div>
                      <div style={{ color: '#94A3B8', fontSize: '0.7rem' }}>Bahan Terpilih</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="features-section">
              <div className="container">
                <div className="features-grid">
                  <div className="feature-item">
                    <div className="feature-icon">💎</div>
                    <h3>Bahan Terpilih</h3>
                    <p>Kualitas bahan segar harian untuk menjaga cita rasa otentik bento kami.</p>
                  </div>
                  <div className="feature-item">
                    <div className="feature-icon">✨</div>
                    <h3>Dapur Higienis</h3>
                    <p>Proses pengolahan bersih dan mengutamakan kualitas sanitasi dapur.</p>
                  </div>
                  <div className="feature-item">
                    <div className="feature-icon">🔥</div>
                    <h3>Inovasi Rasa</h3>
                    <p>Resep inovatif yang menggabungkan tradisi bento dengan selera modern.</p>
                  </div>
                  <div className="feature-item">
                    <div className="feature-icon">⚡</div>
                    <h3>Layanan Cepat</h3>
                    <p>Layanan pesan tanpa antri lewat web yang terintegrasi langsung.</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="menu-section" id="menu">
              <div className="container">
                <div className="section-title">
                  <span>KARTU MENU</span>
                  <h2>Eksplorasi Menu Utama</h2>
                  <div className="category-container" style={{ marginTop: '2.5rem' }}>
                    {categories.map(c => (
                      <button key={c} className={`category-chip ${selectedCategory === c ? 'active' : ''}`} onClick={() => setSelectedCategory(c)}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="menu-grid">
                  {menuItems
                    .filter(i => selectedCategory === 'Semua' || i.category === selectedCategory)
                    .sort((a, b) => {
                      const activeA = (a.is_active === "1" || a.is_active === true) ? 1 : 0;
                      const activeB = (b.is_active === "1" || b.is_active === true) ? 1 : 0;
                      return activeB - activeA;
                    })
                    .map(item => {
                      let finalImg = item.image;
                      if (!finalImg || finalImg === "null" || finalImg === "") {
                        finalImg = "/assets/menu/cornribs.jpg";
                      }
                      const status = (item.is_active === "1" || item.is_active === true);

                      return (
                        <div key={item.id} className="menu-card">
                          <div className="card-img-wrapper">
                            <img src={finalImg} alt={item.name} className="card-img" onError={(e) => e.currentTarget.src = "/assets/menu/cornribs.jpg"} />
                            {!status && <div className="sold-out-overlay">STOK HABIS</div>}
                          </div>
                          <div className="card-content">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <h3 style={{ fontSize: '1.2rem', fontFamily: 'Playfair Display, serif' }}>{item.name}</h3>
                              <div className="card-price">Rp {Number(item.price).toLocaleString('id-ID')}</div>
                            </div>
                            <button className="add-btn" onClick={() => handleAddToCartClick(item)} disabled={!status} style={!status ? { opacity: 0.5 } : {}}>
                              {!status ? 'Habis' : '+ Tambah Pesanan'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </section>

            <section className="story-section" id="story">
              <div className="container story-grid">
                <div className="story-image">
                  <img src="/assets/kitchen_story.jpg" alt="Kitchen" style={{ width: '100%', height: '500px', objectFit: 'cover', borderRadius: '32px' }} onError={(e) => e.currentTarget.src = "/assets/menu/mix-tempura.jpg"} />
                </div>
                <div className="story-content">
                  <div className="hero-badge">Tentang Kami</div>
                  <h3>Kisah di Balik Setiap Rasa</h3>
                  <p style={{ color: '#64748B', fontSize: '1.1rem', lineHeight: '1.8' }}>
                    Yellow Bento 99 hadir dari ambisi kami untuk menyajikan hidangan berkualitas yang dapat dinikmati semua kalangan di Sidoarjo. Kami percaya dedikasi adalah kunci utama kelezatan.
                  </p>
                  <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem' }}>
                    <div><div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--brand-yellow)' }}>2020</div>Tahun Berdiri</div>
                    <div><div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--brand-yellow)' }}>5.0k+</div>Pelanggan</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="testi-section" id="testi">
              <div className="container">
                <h2 style={{ textAlign: 'center', marginBottom: '3rem', fontFamily: 'Playfair Display' }}>Apa Kata Pelanggan?</h2>
                <div className="testi-grid slider" ref={scrollRef}>
                   <div className="testi-card">
                      <div className="stars">⭐⭐⭐⭐⭐</div>
                      <p>"Niatnya mau beli seblak, tapi liat menu bento nya jadi pengen nyoba... Bento nya enak bgt!"</p>
                      <div className="testi-user"><h4>Naila Alfi</h4><span>Google Review</span></div>
                   </div>
                   <div className="testi-card">
                      <div className="stars">⭐⭐⭐⭐⭐</div>
                      <p>"Seblak rekomend, enak murah yang jual ramah pol... menunya banyak banget!"</p>
                      <div className="testi-user"><h4>Syntia</h4><span>Google Review</span></div>
                   </div>
                </div>
              </div>
            </section>

            <section className="story-section" id="location" style={{ background: '#F8FAFC' }}>
              <div className="container">
                <div className="section-title">
                  <span>INFO LOKASI</span>
                  <h2>Kunjungi Toko Kami</h2>
                </div>
                <div style={{ borderRadius: '32px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', height: '450px', marginTop: '3rem' }}>
                  <iframe 
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15827.288277207604!2d112.6713437!3d-7.37365625!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2dd7e3e9d80d2267%3A0xc682245b77465664!2sYellow%20Bento%2099!5e0!3m2!1sid!2sid!4v1712999000000!5m2!1sid!2sid" 
                    width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" 
                  ></iframe>
                </div>
                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                  <p style={{ fontWeight: 800 }}>Jl. Raya Panjunan No. 20, Sukodono - Sidoarjo</p>
                </div>
              </div>
            </section>
          </main>

          <footer>
            <div className="container">
          <div className="footer-grid">
            <div className="footer-logo">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                 <img src="/assets/logo.jpg" alt="Logo" style={{ width: '50px', borderRadius: '50%' }} />
                 <h2 style={{ margin: 0, color: 'white' }}>Yellow Bento 99</h2>
              </div>
              <p style={{ lineHeight: 1.8 }}>Pusat bento & gorengan kekinian nomor 1 di Sukodono dengan cita rasa premium dan harga yang tetap ramah di kantong.</p>
            </div>

            <div>
              <h4 style={{ color: 'white', marginBottom: '2rem' }}>Alamat Toko</h4>
              <div className="footer-info-item">
                <span>📍</span>
                <div>
                  <div style={{ fontWeight: 800, color: 'white' }}>Lokasi Utama:</div>
                  Jl. Raya Panjunan No. 20, Sukodono - Sidoarjo
                </div>
              </div>
              <div className="footer-info-item">
                <span>📱</span>
                <div>
                   <div style={{ fontWeight: 800, color: 'white' }}>WhatsApp:</div>
                   0812-1777-4299
                </div>
              </div>
              <div className="footer-info-item">
                <span>🕒</span>
                <div>
                   <div style={{ fontWeight: 800, color: 'white' }}>Buka:</div>
                   13.30 - 21.00 WIB
                </div>
              </div>
            </div>

            <div>
              <h4 style={{ color: 'white', marginBottom: '2rem' }}>Social & Marketplace</h4>
              <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>Cek promo terbaru kami di platform favorit Anda:</p>
              <div className="market-grid">
                <a href="https://www.google.com/maps/dir/?api=1&destination=Yellow+Bento+99+Sukodono+Sidoarjo" target="_blank" className="market-item">
                  <span>📍</span> Maps
                </a>
                <a href="https://www.instagram.com/yellowbento99" target="_blank" className="market-item">
                  <span>📸</span> IG
                </a>
                <a href="https://wa.me/6281217774299" target="_blank" className="market-item">
                   <span>💬</span> WA
                </a>
                <a href="https://shopee.co.id/yellowbento" target="_blank" className="market-item">
                  <span>🛍️</span> Shopee
                </a>
              </div>
            </div>
          </div>
              <div className="bottom-bar">
                <p>© 2024 Yellow Bento 99. All rights reserved.</p>
              </div>
            </div>
          </footer>
        </>
      )}

      {/* OVERLAYS & MODALS */}
      <div className={`modal ${isOptionsOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ fontFamily: 'Playfair Display' }}>Pilih Varian</h2>
          <button onClick={() => setIsOptionsOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem' }}>✕</button>
        </div>
        {configItem && (
          <div>
            <h3 style={{ marginBottom: '1.5rem' }}>{configItem.name}</h3>
            {configItem.options_type === 'kuah_level' && (
              <>
                <div className="option-sub">Level Pedas</div>
                <div className="options-grid">
                  {['0', '1', '2', '3'].map(l => (
                    <div key={l} className={`option-pill ${selLevel === l ? 'active' : ''}`} onClick={() => setSelLevel(l)}>Level {l}</div>
                  ))}
                </div>
                <div className="option-sub" style={{ marginTop: '1.5rem' }}>Topping Extra</div>
                 <div className="options-grid">
                    {['Bakso', 'Sosis', 'Siomay', 'Dumpling', 'Telor', 'Ceker'].map(t => (
                      <div key={t} className={`option-pill ${selToppings[t] ? 'active' : ''}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                         <span onClick={() => updateToppingQty(t, selToppings[t] ? -99 : 1)} style={{ flex: 1, cursor: 'pointer' }}>{t}</span>
                         {selToppings[t] > 0 && (
                           <div className="qty-mini" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'white', padding: '2px 8px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                             <button onClick={(e) => { e.stopPropagation(); updateToppingQty(t, -1); }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 900, padding: '0 4px' }}>−</button>
                             <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>{selToppings[t]}</span>
                             <button onClick={(e) => { e.stopPropagation(); updateToppingQty(t, 1); }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 900, padding: '0 4px' }}>+</button>
                           </div>
                         )}
                      </div>
                    ))}
                 </div>
              </>
            )}
            {configItem.options_type === 'burger_variant' && (
              <div className="options-grid">
                {['Beef', 'Chicken'].map(v => (
                  <div key={v} className={`option-pill ${selVariant === v ? 'active' : ''}`} onClick={() => setSelVariant(v)}>{v}</div>
                ))}
              </div>
            )}
            <button className="add-btn" onClick={confirmOptions} style={{ marginTop: '2rem' }}>Konfirmasi & Tambah</button>
          </div>
        )}
      </div>

      <div className={`cart-sidebar ${isCartOpen ? 'open' : ''}`}>
        <div style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
            <h2>Keranjang</h2>
            <button onClick={() => setIsCartOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem' }}>✕</button>
          </div>
          {cart.map(item => (
            <div key={item.cartKey} style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '1rem' }}>
               <div style={{ flex: 1 }}>
                  <h4>{item.name}</h4>
                  <p style={{ fontSize: '0.75rem', color: 'orange', fontWeight: 700 }}>{item.selectedOptions}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                    <div className="quantity-controls">
                       <button onClick={() => updateQty(item.cartKey, -1)}>−</button>
                       <span>{item.quantity}</span>
                       <button onClick={() => updateQty(item.cartKey, 1)}>+</button>
                    </div>
                    <span style={{ fontWeight: 800 }}>Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                  </div>
               </div>
            </div>
          ))}
          {cart.length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 900, marginBottom: '2rem' }}><span>TOTAL</span><span>Rp {totalPrice.toLocaleString('id-ID')}</span></div>
              <button className="add-btn" onClick={() => { setIsCartOpen(false); setCheckoutStep(1); setIsModalOpen(true); }}>Checkout Sekarang</button>
            </div>
          )}
        </div>
      </div>

      <div className={`modal ${isModalOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <h2 style={{ fontFamily: 'Playfair Display' }}>{checkoutStep === 1 ? 'Data Pemesan' : 'Pembayaran QRIS'}</h2>
          <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem' }}>✕</button>
        </div>
        {checkoutStep === 1 ? (
          <div>
            <div className="input-group"><label>Nama</label><input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} /></div>
            <div className="input-group" style={{ marginTop: '1rem' }}><label>WhatsApp</label><input type="text" value={customerWA} onChange={e => setCustomerWA(e.target.value)} /></div>
            <button className="add-btn" onClick={() => setCheckoutStep(2)} style={{ marginTop: '2rem' }}>Lanjut Pembayaran</button>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(generateDynamicQRIS(totalPrice))}`} alt="QRIS" className="qris-img" />
            <h3 style={{ fontSize: '2rem', marginTop: '1.5rem', color: 'var(--brand-orange)' }}>Rp {totalPrice.toLocaleString('id-ID')}</h3>
            <button className="add-btn wa-btn" onClick={confirmOrder} style={{ marginTop: '2rem' }}>Konfirmasi Pesanan via WA</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
