import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import * as yup from 'yup';
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
    celular: '',
    foto: null
  });
  const [errors, setErrors] = useState({});
  const [photoPreview, setPhotoPreview] = useState(null);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErrors({...errors, foto: 'El archivo no debe superar 2MB'});
        return;
      }
      
      setFormData({ ...formData, foto: file });
      
      // Crear vista previa
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    
    try {
      await schema.validate(formData, { abortEarly: false });
      
      // Crear objeto FormData para subir archivos
      const formDataToSend = new FormData();
      Object.keys(formData).forEach(key => {
        formDataToSend.append(key, formData[key]);
      });
      
      const response = await axios.post('/api/personas', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
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
        alert('Error al guardar los datos: ' + error.message);
      }
    }
  };

  return (
    <div className={styles.container}>
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
          {errors.tipoDocumento && <span className={styles.error}>{errors.tipoDocumento}</span>}
        </div>

        <div className={styles.formRow}>
          <label>Nro. Documento:</label>
          <input
            type="text"
            name="nroDocumento"
            value={formData.nroDocumento}
            onChange={handleChange}
          />
          {errors.nroDocumento && <span className={styles.error}>{errors.nroDocumento}</span>}
        </div>

        <div className={styles.formRow}>
          <label>Primer Nombre:</label>
          <input
            type="text"
            name="primerNombre"
            value={formData.primerNombre}
            onChange={handleChange}
          />
          {errors.primerNombre && <span className={styles.error}>{errors.primerNombre}</span>}
        </div>

        <div className={styles.formRow}>
          <label>Segundo Nombre:</label>
          <input
            type="text"
            name="segundoNombre"
            value={formData.segundoNombre}
            onChange={handleChange}
          />
          {errors.segundoNombre && <span className={styles.error}>{errors.segundoNombre}</span>}
        </div>

        <div className={styles.formRow}>
          <label>Apellidos:</label>
          <input
            type="text"
            name="apellidos"
            value={formData.apellidos}
            onChange={handleChange}
          />
          {errors.apellidos && <span className={styles.error}>{errors.apellidos}</span>}
        </div>

        <div className={styles.formRow}>
          <label>Fecha de Nacimiento:</label>
          <input
            type="date"
            name="fechaNacimiento"
            value={formData.fechaNacimiento}
            onChange={handleChange}
          />
          {errors.fechaNacimiento && <span className={styles.error}>{errors.fechaNacimiento}</span>}
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
          {errors.genero && <span className={styles.error}>{errors.genero}</span>}
        </div>

        <div className={styles.formRow}>
          <label>Correo electrónico:</label>
          <input
            type="email"
            name="correo"
            value={formData.correo}
            onChange={handleChange}
          />
          {errors.correo && <span className={styles.error}>{errors.correo}</span>}
        </div>

        <div className={styles.formRow}>
          <label>Celular:</label>
          <input
            type="text"
            name="celular"
            value={formData.celular}
            onChange={handleChange}
          />
          {errors.celular && <span className={styles.error}>{errors.celular}</span>}
        </div>

        <div className={styles.formRow}>
          <label>Foto:</label>
          <input
            type="file"
            name="foto"
            accept="image/*"
            onChange={handleFileChange}
          />
          {errors.foto && <span className={styles.error}>{errors.foto}</span>}
          {photoPreview && (
            <div className={styles.photoPreview}>
              <img src={photoPreview} alt="Vista previa" />
            </div>
          )}
        </div>

        <div className={styles.buttons}>
          <button type="submit">Guardar</button>
          <button type="button" onClick={() => navigate('/consultar')}>Cancelar</button>
        </div>
      </form>
    </div>
  );
};

export default CreatePerson;