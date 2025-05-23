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
  const [currentStep, setCurrentStep] = useState(1);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Limpiar el error del campo que se está modificando
    if (errors[name]) {
      setErrors({ ...errors, [name]: null });
    }
    setServerError(null);
  };

  const validateStep = async (step) => {
    try {
      const fieldsToValidate = getFieldsForStep(step);
      const stepData = {};
      fieldsToValidate.forEach(field => {
        stepData[field] = formData[field];
      });
      
      await schema.pick(fieldsToValidate).validate(stepData, { abortEarly: false });
      return true;
    } catch (error) {
      if (error.name === 'ValidationError') {
        const newErrors = {};
        error.inner?.forEach(err => {
          newErrors[err.path] = err.message;
        });
        setErrors({ ...errors, ...newErrors });
      }
      return false;
    }
  };

  const getFieldsForStep = (step) => {
    switch(step) {
      case 1: return ['tipoDocumento', 'nroDocumento'];
      case 2: return ['primerNombre', 'segundoNombre', 'apellidos'];
      case 3: return ['fechaNacimiento', 'genero'];
      case 4: return ['correo', 'celular'];
      default: return [];
    }
  };

  const nextStep = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
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
      
      // Mostrar mensaje de éxito
      navigate('/consultar', { 
        state: { 
          message: `¡Persona registrada exitosamente! ${datosParaEnviar.primerNombre} ${datosParaEnviar.apellidos}`,
          type: 'success'
        }
      });
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
        console.error('Error al guardar:', error);
        setServerError('Error al guardar los datos: ' + (error.message || 'Error desconocido'));
      }
    }
  };

  const getStepTitle = (step) => {
    switch(step) {
      case 1: return 'Información de Documento';
      case 2: return 'Nombres y Apellidos';
      case 3: return 'Información Personal';
      case 4: return 'Datos de Contacto';
      default: return '';
    }
  };

  const getStepIcon = (step) => {
    switch(step) {
      case 1: return '🆔';
      case 2: return '👤';
      case 3: return '📅';
      case 4: return '📞';
      default: return '';
    }
  };

  const isStepCompleted = (step) => {
    const fields = getFieldsForStep(step);
    return fields.every(field => {
      const value = formData[field];
      return value && value.toString().trim() !== '';
    });
  };

  const renderStepContent = () => {
    switch(currentStep) {
      case 1:
        return (
          <div className={styles.stepContent}>
            <div className={styles.formGroup}>
              <label htmlFor="tipoDocumento">
                <span className={styles.fieldIcon}>📋</span>
                Tipo de documento *
              </label>
              <select
                id="tipoDocumento"
                name="tipoDocumento"
                value={formData.tipoDocumento}
                onChange={handleChange}
                className={errors.tipoDocumento ? styles.inputError : ''}
              >
                <option value="">Seleccione el tipo de documento</option>
                <option value="Tarjeta de identidad">Tarjeta de identidad</option>
                <option value="Cédula">Cédula</option>
              </select>
              {errors.tipoDocumento && <span className={styles.errorText}>{errors.tipoDocumento}</span>}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="nroDocumento">
                <span className={styles.fieldIcon}>🔢</span>
                Número de documento *
              </label>
              <input
                id="nroDocumento"
                type="text"
                name="nroDocumento"
                value={formData.nroDocumento}
                onChange={handleChange}
                className={errors.nroDocumento ? styles.inputError : ''}
                placeholder="Ingrese el número de documento (máximo 10 dígitos)"
                maxLength="10"
              />
              {errors.nroDocumento && <span className={styles.errorText}>{errors.nroDocumento}</span>}
            </div>
          </div>
        );

      case 2:
        return (
          <div className={styles.stepContent}>
            <div className={styles.formGroup}>
              <label htmlFor="primerNombre">
                <span className={styles.fieldIcon}>✍️</span>
                Primer nombre *
              </label>
              <input
                id="primerNombre"
                type="text"
                name="primerNombre"
                value={formData.primerNombre}
                onChange={handleChange}
                className={errors.primerNombre ? styles.inputError : ''}
                placeholder="Ej: María, José, Ana"
                maxLength="30"
              />
              {errors.primerNombre && <span className={styles.errorText}>{errors.primerNombre}</span>}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="segundoNombre">
                <span className={styles.fieldIcon}>✍️</span>
                Segundo nombre <span className={styles.optional}>(Opcional)</span>
              </label>
              <input
                id="segundoNombre"
                type="text"
                name="segundoNombre"
                value={formData.segundoNombre}
                onChange={handleChange}
                className={errors.segundoNombre ? styles.inputError : ''}
                placeholder="Segundo nombre (opcional)"
                maxLength="30"
              />
              {errors.segundoNombre && <span className={styles.errorText}>{errors.segundoNombre}</span>}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="apellidos">
                <span className={styles.fieldIcon}>👥</span>
                Apellidos *
              </label>
              <input
                id="apellidos"
                type="text"
                name="apellidos"
                value={formData.apellidos}
                onChange={handleChange}
                className={errors.apellidos ? styles.inputError : ''}
                placeholder="Ej: García Pérez, Rodríguez-Martínez"
                maxLength="60"
              />
              {errors.apellidos && <span className={styles.errorText}>{errors.apellidos}</span>}
            </div>
          </div>
        );

      case 3:
        return (
          <div className={styles.stepContent}>
            <div className={styles.formGroup}>
              <label htmlFor="fechaNacimiento">
                <span className={styles.fieldIcon}>📅</span>
                Fecha de nacimiento *
              </label>
              <input
                id="fechaNacimiento"
                type="date"
                name="fechaNacimiento"
                value={formData.fechaNacimiento}
                onChange={handleChange}
                className={errors.fechaNacimiento ? styles.inputError : ''}
                max={new Date().toISOString().split('T')[0]}
              />
              {errors.fechaNacimiento && <span className={styles.errorText}>{errors.fechaNacimiento}</span>}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="genero">
                <span className={styles.fieldIcon}>⚧</span>
                Género *
              </label>
              <select
                id="genero"
                name="genero"
                value={formData.genero}
                onChange={handleChange}
                className={errors.genero ? styles.inputError : ''}
              >
                <option value="">Seleccione el género</option>
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="No binario">No binario</option>
                <option value="Prefiero no reportar">Prefiero no reportar</option>
              </select>
              {errors.genero && <span className={styles.errorText}>{errors.genero}</span>}
            </div>
          </div>
        );

      case 4:
        return (
          <div className={styles.stepContent}>
            <div className={styles.formGroup}>
              <label htmlFor="correo">
                <span className={styles.fieldIcon}>✉️</span>
                Correo electrónico *
              </label>
              <input
                id="correo"
                type="email"
                name="correo"
                value={formData.correo}
                onChange={handleChange}
                className={errors.correo ? styles.inputError : ''}
                placeholder="ejemplo@dominio.com"
              />
              {errors.correo && <span className={styles.errorText}>{errors.correo}</span>}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="celular">
                <span className={styles.fieldIcon}>📱</span>
                Número de celular *
              </label>
              <input
                id="celular"
                type="tel"
                name="celular"
                value={formData.celular}
                onChange={handleChange}
                className={errors.celular ? styles.inputError : ''}
                placeholder="Ej: 3001234567"
                maxLength="13"
              />
              {errors.celular && <span className={styles.errorText}>{errors.celular}</span>}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      {/* Header Section */}
      <div className={styles.headerSection}>
        <div className={styles.titleContainer}>
          <h2>
            <span className={styles.titleIcon}>➕</span>
            Registrar Nueva Persona
          </h2>
          <p className={styles.subtitle}>
            Complete la información para registrar una nueva persona en el sistema
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className={styles.progressContainer}>
        <div className={styles.progressSteps}>
          {[1, 2, 3, 4].map((step) => (
            <div 
              key={step}
              className={`${styles.progressStep} ${
                step === currentStep ? styles.active : 
                step < currentStep ? styles.completed :
                isStepCompleted(step) ? styles.filled : ''
              }`}
            >
              <div className={styles.stepNumber}>
                {step < currentStep || isStepCompleted(step) ? '✓' : step}
              </div>
              <span className={styles.stepLabel}>
                {getStepTitle(step)}
              </span>
            </div>
          ))}
        </div>
        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill} 
            style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Form Card */}
      <div className={styles.formCard}>
        {serverError && (
          <div className={styles.errorAlert}>
            <span className={styles.alertIcon}>⚠️</span>
            <div>
              <strong>Error en el registro</strong>
              <p>{serverError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Step Header */}
          <div className={styles.stepHeader}>
            <h3>
              <span className={styles.stepIcon}>{getStepIcon(currentStep)}</span>
              {getStepTitle(currentStep)}
            </h3>
            <p className={styles.stepDescription}>
              Paso {currentStep} de 4 • Complete todos los campos requeridos (*)
            </p>
          </div>

          {/* Step Content */}
          {renderStepContent()}

          {/* Form Actions */}
          <div className={styles.formActions}>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className={styles.secondaryButton}
                disabled={isSubmitting}
              >
                <span className={styles.buttonIcon}>←</span>
                Anterior
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('/consultar')}
              className={styles.cancelButton}
              disabled={isSubmitting}
            >
              <span className={styles.buttonIcon}>✕</span>
              Cancelar
            </button>

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={nextStep}
                className={styles.primaryButton}
                disabled={isSubmitting}
              >
                Siguiente
                <span className={styles.buttonIcon}>→</span>
              </button>
            ) : (
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className={styles.loadingSpinner}></span>
                    Guardando...
                  </>
                ) : (
                  <>
                    <span className={styles.buttonIcon}>✓</span>
                    Guardar Persona
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Summary Card - Solo mostrar en el último paso */}
      {currentStep === 4 && (
        <div className={styles.summaryCard}>
          <h4>
            <span className={styles.summaryIcon}>📋</span>
            Resumen de la información
          </h4>
          <div className={styles.summaryContent}>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Documento:</span>
              <span className={styles.summaryValue}>
                {formData.tipoDocumento} • {formData.nroDocumento}
              </span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Nombre completo:</span>
              <span className={styles.summaryValue}>
                {formData.primerNombre} {formData.segundoNombre} {formData.apellidos}
              </span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Fecha de nacimiento:</span>
              <span className={styles.summaryValue}>{formData.fechaNacimiento}</span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Género:</span>
              <span className={styles.summaryValue}>{formData.genero}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatePerson;