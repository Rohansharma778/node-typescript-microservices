import React, { useEffect, useState } from 'react';
import axios from 'axios'; // or just import axios from 'axios';
import axiosLib from 'axios';
import './App.css';

const MAIN_API = 'http://localhost:8001/api/products';

function App() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data } = await axiosLib.get(MAIN_API);
      setProducts(data);
    } catch (err) {
      console.error("Error fetching storefront products:", err);
    }
  };

  const handleLike = async (mongoId) => {
    try {
      // Hits the Main service like proxy endpoint
      await axiosLib.post(`${MAIN_API}/${mongoId}/like`);
      fetchProducts(); // Refresh list to get updated counts
    } catch (err) {
      console.error("Failed to like product:", err);
    }
  };

  return (
    <div className="wrapper">
      {/* Top Banner Header */}
      <header className="main-header">
        <div className="brand">Company name</div>
        <div className="search-bar">
          <input type="text" placeholder="Search" disabled />
        </div>
        <div className="user-actions">Sign out</div>
      </header>

      {/* Main Grid View */}
      <main className="storefront-content">
        <div className="card-grid">
          {products.map((product) => (
            <div key={product.id} className="product-card">
              <div className="image-wrapper">
                <img src={product.image} alt={product.title} />
              </div>
              <div className="card-footer">
                <h3>{product.title}</h3>
                <div className="action-row">
                  <button className="btn-like" onClick={() => handleLike(product.id)}>
                    Like
                  </button>
                  <span className="likes-text">{product.likes} likes</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default App;