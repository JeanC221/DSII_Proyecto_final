import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CreatePerson from './components/CreatePerson';
import ConsultarPersonas from './components/ConsultarPersonas';
import EditarPersona from './components/EditarPersona';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <h1>Gestión de Datos Personales</h1>
        <Routes>
          <Route path="/" element={<CreatePerson />} />
          <Route path="/consultar" element={<ConsultarPersonas />} />
          <Route path="/editar/:id" element={<EditarPersona />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;