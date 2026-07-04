import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css';

const ADMIN_API = 'http://localhost:8000/api/products';

function App() {
  const [products, setProducts] = useState([]);
  const [view, setView] = useState('list'); // 'list' | 'form'
  
  // Form values
  const [title, setTitle] = useState('');
  const [image, setImage] = useState('');
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    if (view === 'list') fetchProducts();
  }, [view]);

  const fetchProducts = async () => {
    try {
      const { data } = await axios.get(ADMIN_API);
      setProducts(data);
    } catch (err) { console.error(err); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (editId) {
      await axios.put(`${ADMIN_API}/${editId}`, { title, image });
    } else {
      await axios.post(ADMIN_API, { title, image });
    }
    setView('list');
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete product?")) {
      await axios.delete(`${ADMIN_API}/${id}`);
      fetchProducts();
    }
  };

  return (
    <div className="wrapper">
      <header className="main-header">
        <div className="brand">Company name</div>
        <div className="search-bar"><input type="text" placeholder="Search" disabled /></div>
        <div className="user-actions">Sign out</div>
      </header>

      <div className="body-container">
        <aside className="sidebar">
          <div className="menu-item active">Products</div>
        </aside>

        <main className="content">
          {view === 'list' ? (
            <div>
              <button className="btn-add" onClick={() => { setEditId(null); setTitle(''); setImage(''); setView('form'); }}>Add</button>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Image</th>
                    <th>Title</th>
                    <th>Likes</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td><img src={p.image} alt="" className="thumb" /></td>
                      <td>{p.title}</td>
                      <td>{p.likes}</td>
                      <td>
                        <button onClick={() => { setEditId(p.id); setTitle(p.title); setImage(p.image); setView('form'); }}>Edit</button>
                        <button onClick={() => handleDelete(p.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <form onSubmit={handleSave} className="admin-form">
              <div className="form-group">
                <label>Title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Image</label>
                <input type="text" value={image} onChange={e => setImage(e.target.value)} required />
              </div>
              <button type="submit" className="btn-save">Save</button>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;