import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as yup from 'yup';
import api from '../config/axiosConfig';
import styles from './CreatePerson.module.css';

// Esquema de validación con Yup actualizado para caracteres españoles
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
  genero: yup
    .string()
    .oneOf(['Masculino', 'Femenino', 'No binario', 'Prefiero no reportar'], 'Opción inválida')
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
        // Eliminar espacios y guiones para validación
        const cleaned = value.replace(/[\s-]/g, '');
        return /^(\+\d{1,3})?(\d{10})$/.test(cleaned);
      }
    )
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
  const [serverError, setServerError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Limpiar el error del campo que se está modificando
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
      await schema.validate(formData, { abortEarly: false });
      
      // Limpiar datos antes de enviarlos
      const datosParaEnviar = {
        ...formData,
        primerNombre: formData.primerNombre.trim(),
        segundoNombre: formData.segundoNombre ? formData.segundoNombre.trim() : '',
        apellidos: formData.apellidos.trim(),
        correo: formData.correo.trim().toLowerCase(),
        celular: formData.celular.replace(/[\s-]/g, '') // Eliminar espacios o guiones
      };
      
      const response = await api.post('/personas', datosParaEnviar);
      
      alert('Persona creada exitosamente!');
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
        // Errores del servidor
        setServerError(error.response.data.error);
      } else {
        console.error('Error al guardar:', error);
        setServerError('Error al guardar los datos: ' + (error.message || 'Error desconocido'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card">
      <h2>GESTIÓN DE DATOS PERSONALES</h2>
      
      {serverError && (
        <div className={styles.serverError}>
          <p>{serverError}</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formRow}>
          <label htmlFor="tipoDocumento">Tipo de documento:</label>
          <select
            id="tipoDocumento"
            name="tipoDocumento"
            value={formData.tipoDocumento}
            onChange={handleChange}
            className={errors.tipoDocumento ? styles.inputError : ''}
          >
            <option value="">Seleccione</option>
            <option value="Tarjeta de identidad">Tarjeta de identidad</option>
            <option value="Cédula">Cédula</option>
          </select>
          {errors.tipoDocumento && <span className={styles.error}>{errors.tipoDocumento}</span>}
        </div>

        <div className={styles.formRow}>
          <label htmlFor="nroDocumento">Nro. Documento:</label>
          <input
            id="nroDocumento"
            type="text"
            name="nroDocumento"
            value={formData.nroDocumento}
            onChange={handleChange}
            className={errors.nroDocumento ? styles.inputError : ''}
            placeholder="Máximo 10 dígitos"
          />
          {errors.nroDocumento && <span className={styles.error}>{errors.nroDocumento}</span>}
        </div>

        <div className={styles.formRow}>
          <label htmlFor="primerNombre">Primer Nombre:</label>
          <input
            id="primerNombre"
            type="text"
            name="primerNombre"
            value={formData.primerNombre}
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
            value={formData.segundoNombre}
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
            value={formData.apellidos}
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
            value={formData.fechaNacimiento}
            onChange={handleChange}
            className={errors.fechaNacimiento ? styles.inputError : ''}
            max={new Date().toISOString().split('T')[0]} // Limita a la fecha actual
          />
          {errors.fechaNacimiento && <span className={styles.error}>{errors.fechaNacimiento}</span>}
        </div>

        <div className={styles.formRow}>
          <label htmlFor="genero">Género:</label>
          <select
            id="genero"
            name="genero"
            value={formData.genero}
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
          <label htmlFor="correo">Correo electrónico:</label>
          <input
            id="correo"
            type="email"
            name="correo"
            value={formData.correo}
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
            value={formData.celular}
            onChange={handleChange}
            className={errors.celular ? styles.inputError : ''}
            placeholder="Ej: 3001234567"
          />
          {errors.celular && <span className={styles.error}>{errors.celular}</span>}
        </div>

        <div className={styles.buttons}>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar'}
          </button>
          <button type="button" onClick={() => navigate('/consultar')} className="secondary">Cancelar</button>
        </div>
      </form>
    </div>
  );
};

export default CreatePerson;