import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as yup from 'yup';
import api from '../config/axiosConfig';
import styles from './CreatePerson.module.css';

// Esquema de validación con Yup
const schema = yup.object().shape({
  tipoDocumento: yup
    .string()
    .oneOf(['Tarjeta de identidad', 'Cédula'], 'Tipo de documento inválido')
    .required('Campo requerido'),
  nroDocumento: yup
    .string()
    .matches(/^\d{1,10}$/, 'Debe ser un número de máximo 10 dígitos')
    .required('Campo requerido'),
  primerNombre: yup
    .string()
    .matches(/^[A-Za-z ]+$/, 'No se permiten números')
    .max(30, 'Máximo 30 caracteres')
    .required('Campo requerido'),
  segundoNombre: yup
    .string()
    .matches(/^[A-Za-z ]*$/, 'No se permiten números')
    .max(30, 'Máximo 30 caracteres'),
  apellidos: yup
    .string()
    .matches(/^[A-Za-z ]+$/, 'No se permiten números')
    .max(60, 'Máximo 60 caracteres')
    .required('Campo requerido'),
  fechaNacimiento: yup
    .date()
    .required('Campo requerido'),
  genero: yup
    .string()
    .oneOf(['Masculino', 'Femenino', 'No binario', 'Prefiero no reportar'], 'Opción inválida')
    .required('Campo requerido'),
  correo: yup
    .string()
    .email('Correo inválido')
    .required('Campo requerido'),
  celular: yup
    .string()
    .matches(/^\d{10}$/, 'Debe tener 10 dígitos')
    .required('Campo requerido')
});

const CreatePerson = () => {
  const [formData, setFormData] = useState({
    tipoDocumento: '',
    nroDocumento: '',
    primerNombre: '',
    segundoNombre: '',
    apellidos: '',
    fechaNacimiento: '',
    genero: '',
    correo: '',
    celular: ''
  });
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    
    try {
      await schema.validate(formData, { abortEarly: false });
      
      const response = await api.post('/personas', formData);
      
      alert('Persona creada exitosamente!');
      navigate('/consultar');
    } catch (error) {
      if (error.name === 'ValidationError') {
        const newErrors = {};
        error.inner?.forEach(err => {
          newErrors[err.path] = err.message;
        });
        setErrors(newErrors);
      } else {
        console.error('Error al guardar:', error);
        alert('Error al guardar los datos: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  return (
    <div className="card">
      <h2>GESTIÓN DE DATOS PERSONALES</h2>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formRow}>
          <label>Tipo de documento:</label>
          <select
            name="tipoDocumento"
            value={formData.tipoDocumento}
            onChange={handleChange}
          >
            <option value="">Seleccione</option>
            <option value="Tarjeta de identidad">Tarjeta de identidad</option>
            <option value="Cédula">Cédula</option>
          </select>
          {errors.tipoDocumento && <span className="error">{errors.tipoDocumento}</span>}
        </div>

        <div className={styles.formRow}>
          <label>Nro. Documento:</label>
          <input
            type="text"
            name="nroDocumento"
            value={formData.nroDocumento}
            onChange={handleChange}
          />
          {errors.nroDocumento && <span className="error">{errors.nroDocumento}</span>}
        </div>

        <div className={styles.formRow}>
          <label>Primer Nombre:</label>
          <input
            type="text"
            name="primerNombre"
            value={formData.primerNombre}
            onChange={handleChange}
          />
          {errors.primerNombre && <span className="error">{errors.primerNombre}</span>}
        </div>

        <div className={styles.formRow}>
          <label>Segundo Nombre:</label>
          <input
            type="text"
            name="segundoNombre"
            value={formData.segundoNombre}
            onChange={handleChange}
          />
          {errors.segundoNombre && <span className="error">{errors.segundoNombre}</span>}
        </div>

        <div className={styles.formRow}>
          <label>Apellidos:</label>
          <input
            type="text"
            name="apellidos"
            value={formData.apellidos}
            onChange={handleChange}
          />
          {errors.apellidos && <span className="error">{errors.apellidos}</span>}
        </div>

        <div className={styles.formRow}>
          <label>Fecha de Nacimiento:</label>
          <input
            type="date"
            name="fechaNacimiento"
            value={formData.fechaNacimiento}
            onChange={handleChange}
          />
          {errors.fechaNacimiento && <span className="error">{errors.fechaNacimiento}</span>}
        </div>

        <div className={styles.formRow}>
          <label>Género:</label>
          <select
            name="genero"
            value={formData.genero}
            onChange={handleChange}
          >
            <option value="">Seleccione</option>
            <option value="Masculino">Masculino</option>
            <option value="Femenino">Femenino</option>
            <option value="No binario">No binario</option>
            <option value="Prefiero no reportar">Prefiero no reportar</option>
          </select>
          {errors.genero && <span className="error">{errors.genero}</span>}
        </div>

        <div className={styles.formRow}>
          <label>Correo electrónico:</label>
          <input
            type="email"
            name="correo"
            value={formData.correo}
            onChange={handleChange}
          />
          {errors.correo && <span className="error">{errors.correo}</span>}
        </div>

        <div className={styles.formRow}>
          <label>Celular:</label>
          <input
            type="text"
            name="celular"
            value={formData.celular}
            onChange={handleChange}
          />
          {errors.celular && <span className="error">{errors.celular}</span>}
        </div>

        <div className={styles.buttons}>
          <button type="submit">Guardar</button>
          <button type="button" onClick={() => navigate('/consultar')} className="secondary">Cancelar</button>
        </div>
      </form>
    </div>
  );
};

export default CreatePerson;