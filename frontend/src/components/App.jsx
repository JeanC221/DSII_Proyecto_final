import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CreatePerson from './CreatePerson';
import ConsultarPersonas from './ConsultarPersonas';
import EditarPersona from './EditarPersona';
import '../App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <h1>APLICACIÓN GESTIÓN DE DATOS PERSONALES</h1>
        <div className="menu">
          <h2>MENÚ PRINCIPAL</h2>
          <ul>
            <li><a href="/">Crear Personas</a></li>
            <li><a href="/consultar">Consultar Datos Personales</a></li>
            <li><a href="/consulta-natural">Consultar Datos Personales - Lenguaje Natural</a></li>
            <li><a href="/consultar">Borrar Personas</a></li>
            <li><a href="/logs">Consultar log</a></li>
          </ul>
        </div>
        <Routes>
          <Route path="/" element={<CreatePerson />} />
          <Route path="/consultar" element={<ConsultarPersonas />} />
          <Route path="/editar/:id" element={<EditarPersona />} />
          <Route path="/consulta-natural" element={<ConsultaNatural />} />
          <Route path="/logs" element={<ConsultarLogs />} />
        </Routes>
      </div>
    </Router>
  );
}

// Componente temporal para consulta en lenguaje natural
const ConsultaNatural = () => (
  <div className="consulta-natural">
    <h2>CONSULTA EN LENGUAJE NATURAL</h2>
    <div className="rag-container">
      <div className="pregunta-container">
        <label>Pregunta:</label>
        <input type="text" placeholder="Ej: ¿Cuál es el empleado más joven?" />
        <button>Consultar</button>
      </div>
      <div className="respuesta-container">
        <label>Respuesta:</label>
        <div className="respuesta-box"></div>
      </div>
    </div>
  </div>
);

// Componente temporal para logs
const ConsultarLogs = () => (
  <div className="logs-container">
    <h2>Registro de Actividades</h2>
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Acción</th>
          <th>Usuario</th>
          <th>Detalles</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td colSpan="4">Cargando registros...</td>
        </tr>
      </tbody>
    </table>
  </div>
);

export default App;