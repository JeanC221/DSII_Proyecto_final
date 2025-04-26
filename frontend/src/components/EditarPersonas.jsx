import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as yup from 'yup';
import api from '../config/axiosConfig';
import styles from './EditarPersonas.module.css';

const schema = yup.object().shape({
  primerNombre: yup
    .string()
    .matches(/^[A-Za-z ]+$/, 'No se permiten números')
    .max(30, 'Máximo 30 caracteres')
    .required('Campo requerido'),
  apellidos: yup
    .string()
    .matches(/^[A-Za-z ]+$/, 'No se permiten números')
    .max(60, 'Máximo 60 caracteres')
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

const EditarPersona = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    primerNombre: '',
    segundoNombre: '',
    apellidos: '',
    celular: '',
    correo: ''
  });
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchPersona = async () => {
      try {
        const res = await api.get(`/api/personas/${id}`);
        
        // Formatear la fecha para el input de tipo date
        let formattedData = {...res.data};
        if (formattedData.fechaNacimiento && formattedData.fechaNacimiento.seconds) {
          const date = new Date(formattedData.fechaNacimiento.seconds * 1000);
          formattedData.fechaNacimiento = date.toISOString().split('T')[0];
        }
        
        setFormData(formattedData);
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar datos:', error);
        alert('Error al cargar datos');
        navigate('/consultar');
      }
    };
    fetchPersona();
  }, [id, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await schema.validate(formData, { abortEarly: false });
      await api.put(`/api/personas/${id}`, formData);
      alert('Actualización exitosa!');
      navigate('/consultar');
    } catch (error) {
      if (error.name === 'ValidationError') {
        const newErrors = {};
        error.inner?.forEach(err => {
          newErrors[err.path] = err.message;
        });
        setErrors(newErrors);
      } else {
        console.error('Error al actualizar:', error);
        alert('Error al actualizar: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  if (loading) {
    return <div className={styles.loading}>Cargando...</div>;
  }

  return (
    <div className={styles.container}>
      <h2>Editar Datos Personales</h2>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formRow}>
          <label>Primer Nombre:</label>
          <input
            type="text"
            name="primerNombre"
            value={formData.primerNombre || ''}
            onChange={handleChange}
          />
          {errors.primerNombre && <span className="error">{errors.primerNombre}</span>}
        </div>

        <div className={styles.formRow}>
          <label>Segundo Nombre:</label>
          <input
            type="text"
            name="segundoNombre"
            value={formData.segundoNombre || ''}
            onChange={handleChange}
          />
        </div>

        <div className={styles.formRow}>
          <label>Apellidos:</label>
          <input
            type="text"
            name="apellidos"
            value={formData.apellidos || ''}
            onChange={handleChange}
          />
          {errors.apellidos && <span className="error">{errors.apellidos}</span>}
        </div>

        <div className={styles.formRow}>
          <label>Fecha de Nacimiento:</label>
          <input
            type="date"
            name="fechaNacimiento"
            value={formData.fechaNacimiento || ''}
            onChange={handleChange}
          />
        </div>

        <div className={styles.formRow}>
          <label>Correo Electrónico:</label>
          <input
            type="email"
            name="correo"
            value={formData.correo || ''}
            onChange={handleChange}
          />
          {errors.correo && <span className="error">{errors.correo}</span>}
        </div>

        <div className={styles.formRow}>
          <label>Celular:</label>
          <input
            type="text"
            name="celular"
            value={formData.celular || ''}
            onChange={handleChange}
          />
          {errors.celular && <span className="error">{errors.celular}</span>}
        </div>

        <div className={styles.buttons}>
          <button type="submit">Guardar Cambios</button>
          <button type="button" onClick={() => navigate('/consultar')} className="secondary">Cancelar</button>
        </div>
      </form>
    </div>
  );
};

export default EditarPersona;