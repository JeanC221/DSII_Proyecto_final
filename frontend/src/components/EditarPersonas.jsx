import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as yup from 'yup';
import api from '../config/axiosConfig';
import { dateToInputValue } from '../utils/dateUtils';
import styles from './EditarPersonas.module.css';

const schema = yup.object().shape({
  primerNombre: yup
    .string()
    .matches(
      /^[A-Za-zÁáÉéÍíÓóÚúÜüÑñ\s']+$/, 
      'Solo se permiten letras, espacios y apóstrofes'
    )
    .max(30, 'Máximo 30 caracteres')
    .required('Campo requerido'),
  segundoNombre: yup
    .string()
    .matches(
      /^[A-Za-zÁáÉéÍíÓóÚúÜüÑñ\s']*$/, 
      'Solo se permiten letras, espacios y apóstrofes'
    )
    .max(30, 'Máximo 30 caracteres'),
  apellidos: yup
    .string()
    .matches(
      /^[A-Za-zÁáÉéÍíÓóÚúÜüÑñ\s'-]+$/, 
      'Solo se permiten letras, espacios, guiones y apóstrofes'
    )
    .max(60, 'Máximo 60 caracteres')
    .required('Campo requerido'),
  fechaNacimiento: yup
    .date()
    .max(new Date(), 'La fecha no puede ser futura')
    .test(
      'edad-minima',
      'La persona debe tener al menos 1 año de edad',
      (value) => {
        if (!value) return false;
        const minDate = new Date();
        minDate.setFullYear(minDate.getFullYear() - 1);
        return value <= minDate;
      }
    )
    .required('Campo requerido'),
  correo: yup
    .string()
    .email('Formato de correo inválido')
    .required('Campo requerido'),
  celular: yup
    .string()
    .test(
      'celular-valido',
      'El celular debe tener 10 dígitos. Formato: XXXXXXXXXX',
      (value) => {
        if (!value) return false;
        const cleaned = value.replace(/[\s-]/g, '');
        return /^(\+\d{1,3})?(\d{10})$/.test(cleaned);
      }
    )
    .required('Campo requerido')
});

const EditarPersona = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    primerNombre: '',
    segundoNombre: '',
    apellidos: '',
    fechaNacimiento: '',
    correo: '',
    celular: '',
    genero: ''
  });
  const [originalData, setOriginalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchPersona = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/personas/${id}`);
        
        let formattedData = {...res.data};
        formattedData.fechaNacimiento = dateToInputValue(formattedData.fechaNacimiento);
        
        setFormData(formattedData);
        setOriginalData(formattedData);
        setLoading(false);
      } catch (error) {
        console.error('Error al cargar datos:', error);
        setServerError('Error al cargar datos de la persona');
        setLoading(false);
        setTimeout(() => navigate('/consultar'), 3000);
      }
    };
    fetchPersona();
  }, [id, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    if (errors[name]) {
      setErrors({ ...errors, [name]: null });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setServerError(null);
    setIsSubmitting(true);
    
    try {
      const changedFields = {};
      for (const key in formData) {
        if (formData[key] !== originalData[key]) {
          changedFields[key] = formData[key];
        }
      }
      
      if (Object.keys(changedFields).length === 0) {
        setServerError('No se han realizado cambios');
        setIsSubmitting(false);
        return;
      }
      
      await schema.validate(formData, { 
        abortEarly: false,
        context: { isUpdate: true }
      });
      
      const datosParaEnviar = {
        ...changedFields,
        primerNombre: changedFields.primerNombre ? changedFields.primerNombre.trim() : undefined,
        segundoNombre: changedFields.segundoNombre ? changedFields.segundoNombre.trim() : undefined,
        apellidos: changedFields.apellidos ? changedFields.apellidos.trim() : undefined,
        correo: changedFields.correo ? changedFields.correo.trim().toLowerCase() : undefined,
        celular: changedFields.celular ? changedFields.celular.replace(/[\s-]/g, '') : undefined
      };
      
      await api.put(`/personas/${id}`, datosParaEnviar);
      alert('Actualización exitosa!');
      navigate('/consultar');
    } catch (error) {
      setIsSubmitting(false);
      
      if (error.name === 'ValidationError') {
        const newErrors = {};
        error.inner?.forEach(err => {
          newErrors[err.path] = err.message;
        });
        setErrors(newErrors);
      } else if (error.response?.data?.error) {
        setServerError(error.response.data.error);
      } else {
        console.error('Error al actualizar:', error);
        setServerError('Error al actualizar: ' + (error.message || 'Error desconocido'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/consultar');
  };

  if (loading) {
    return <div className={styles.loading}>Cargando datos...</div>;
  }

  return (
    <div className="card">
      <h2>Editar Datos Personales</h2>
      
      {serverError && (
        <div className={styles.serverError}>
          <p>{serverError}</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formRow}>
          <label htmlFor="primerNombre">Primer Nombre:</label>
          <input
            id="primerNombre"
            type="text"
            name="primerNombre"
            value={formData.primerNombre || ''}
            onChange={handleChange}
            className={errors.primerNombre ? styles.inputError : ''}
            placeholder="Ej: María, José"
          />
          {errors.primerNombre && <span className={styles.error}>{errors.primerNombre}</span>}
        </div>

        <div className={styles.formRow}>
          <label htmlFor="segundoNombre">Segundo Nombre: <span className={styles.optional}>(Opcional)</span></label>
          <input
            id="segundoNombre"
            type="text"
            name="segundoNombre"
            value={formData.segundoNombre || ''}
            onChange={handleChange}
            className={errors.segundoNombre ? styles.inputError : ''}
          />
          {errors.segundoNombre && <span className={styles.error}>{errors.segundoNombre}</span>}
        </div>

        <div className={styles.formRow}>
          <label htmlFor="apellidos">Apellidos:</label>
          <input
            id="apellidos"
            type="text"
            name="apellidos"
            value={formData.apellidos || ''}
            onChange={handleChange}
            className={errors.apellidos ? styles.inputError : ''}
            placeholder="Ej: García Pérez, Rodríguez-Martínez"
          />
          {errors.apellidos && <span className={styles.error}>{errors.apellidos}</span>}
        </div>

        <div className={styles.formRow}>
          <label htmlFor="fechaNacimiento">Fecha de Nacimiento:</label>
          <input
            id="fechaNacimiento"
            type="date"
            name="fechaNacimiento"
            value={formData.fechaNacimiento || ''}
            onChange={handleChange}
            className={errors.fechaNacimiento ? styles.inputError : ''}
            max={new Date().toISOString().split('T')[0]}
          />
          {errors.fechaNacimiento && <span className={styles.error}>{errors.fechaNacimiento}</span>}
        </div>
        
        <div className={styles.formRow}>
          <label htmlFor="genero">Género:</label>
          <select
            id="genero"
            name="genero"
            value={formData.genero || ''}
            onChange={handleChange}
            className={errors.genero ? styles.inputError : ''}
          >
            <option value="">Seleccione</option>
            <option value="Masculino">Masculino</option>
            <option value="Femenino">Femenino</option>
            <option value="No binario">No binario</option>
            <option value="Prefiero no reportar">Prefiero no reportar</option>
          </select>
          {errors.genero && <span className={styles.error}>{errors.genero}</span>}
        </div>

        <div className={styles.formRow}>
          <label htmlFor="correo">Correo Electrónico:</label>
          <input
            id="correo"
            type="email"
            name="correo"
            value={formData.correo || ''}
            onChange={handleChange}
            className={errors.correo ? styles.inputError : ''}
            placeholder="ejemplo@dominio.com"
          />
          {errors.correo && <span className={styles.error}>{errors.correo}</span>}
        </div>

        <div className={styles.formRow}>
          <label htmlFor="celular">Celular:</label>
          <input
            id="celular"
            type="text"
            name="celular"
            value={formData.celular || ''}
            onChange={handleChange}
            className={errors.celular ? styles.inputError : ''}
            placeholder="Ej: 3001234567"
          />
          {errors.celular && <span className={styles.error}>{errors.celular}</span>}
        </div>

        <div className={styles.buttons}>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
          </button>
          <button type="button" onClick={handleCancel} className="secondary">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditarPersona;