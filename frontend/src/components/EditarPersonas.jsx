import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import * as yup from 'yup';
import styles from './EditarPersonas.module.css';

const schema = yup.object().shape({
  correo: yup.string().email('Correo inválido')
});

const EditarPersona = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchPersona = async () => {
      try {
        const res = await axios.get(`/api/personas/${id}`);
        setFormData(res.data);
      } catch (error) {
        alert('Error al cargar datos');
      }
    };
    fetchPersona();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await schema.validate(formData, { abortEarly: false });
      await axios.put(`/api/personas/${id}`, formData);
      alert('Actualización exitosa!');
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
        <label>Correo Electrónico:</label>
        <input
          type="email"
          value={formData.correo || ''}
          onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
        />
        {errors.correo && <span className={styles.error}>{errors.correo}</span>}
      </div>
      <button type="submit">Guardar Cambios</button>
    </form>
  );
};

export default EditarPersona;