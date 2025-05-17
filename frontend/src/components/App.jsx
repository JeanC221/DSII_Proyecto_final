import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import CreatePerson from './CreatePerson';
import ConsultarPersonas from './ConsultarPersonas';
import EditarPersona from './EditarPersonas';
import ConsultaNatural from './ConsultaNatural';
import ConsultarLogs from './ConsultarLogs'; // Importar el componente correctamente
import '../styles/global.css';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="header">
          <h1>APLICACIÓN GESTIÓN DE DATOS PERSONALES</h1>
        </header>
        
        <nav className="navbar">
          <div className="nav-container">
            <h2>MENÚ PRINCIPAL</h2>
            <ul className="nav-links">
              <li>
                <Link to="/" className="nav-link">
                  <i className="icon icon-add"></i>
                  Crear Personas
                </Link>
              </li>
              <li>
                <Link to="/consultar" className="nav-link">
                  <i className="icon icon-search"></i>
                  Consultar Datos Personales
                </Link>
              </li>
              <li>
                <Link to="/consulta-natural" className="nav-link">
                  <i className="icon icon-chat"></i>
                  Consultar - Lenguaje Natural
                </Link>
              </li>
              <li>
                <Link to="/logs" className="nav-link">
                  <i className="icon icon-log"></i>
                  Consultar log
                </Link>
              </li>
            </ul>
          </div>
        </nav>
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<CreatePerson />} />
            <Route path="/consultar" element={<ConsultarPersonas />} />
            <Route path="/editar/:id" element={<EditarPersona />} />
            <Route path="/consulta-natural" element={<ConsultaNatural />} />
            <Route path="/logs" element={<ConsultarLogs />} />
          </Routes>
        </main>
        
        <footer className="footer">
          <p>© 2025 - Sistema de Gestión de Datos Personales</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;