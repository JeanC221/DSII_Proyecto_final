import React from 'react';
import ReactDOM from 'react-dom';
import './styles/global.css';
import './index.css';
import App from './components/App';

// Usando el método tradicional de renderizado para React 17
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);