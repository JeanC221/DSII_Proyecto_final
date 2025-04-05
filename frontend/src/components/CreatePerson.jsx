import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import * as yup from 'yup';
import styles from './CreatePerson.module.css';

// Esquema de validación con Yup
const schema = yup.object().shape({
  primerNombre: yup
    .string()
    .matches(/^[A-Za-z ]+$/, 'No se permiten números')
    .max(30, 'Máximo 30 caracteres')
    .required('Campo requerido'),
  celular: yup
    .string()
    .matches(/^\d{10}$/, 'Debe tener 10 dígitos')
});

const CreatePerson = () => {
  const [formData, setFormData] = useState({
    primerNombre: '',
    apellidos: '',
    celular: '',
    correo: ''
  });
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await schema.validate(formData, { abortEarly: false });
      await axios.post('/api/personas', formData);
      alert('Persona creada exitosamente!');
      navigate('/consultar');
    } catch (error) {
      const newErrors = {};
      error.inner?.forEach(err => {
        newErrors[err.path] = err.message;
      });
      setErrors(newErrors);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div>
        <label>Primer Nombre:</label>
        <input
          type="text"
          value={formData.primerNombre}
          onChange={(e) => setFormData({ ...formData, primerNombre: e.target.value })}
        />
        {errors.primerNombre && <span className={styles.error}>{errors.primerNombre}</span>}
      </div>
      {/* Repetir para otros campos */}
      <button type="submit">Guardar</button>
    </form>
  );
};

export default CreatePerson;