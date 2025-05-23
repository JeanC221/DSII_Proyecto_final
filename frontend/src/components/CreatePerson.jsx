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
      
      const datosParaEnviar = {
        ...formData,
        primerNombre: formData.primerNombre.trim(),
        segundoNombre: formData.segundoNombre ? formData.segundoNombre.trim() : '',
        apellidos: formData.apellidos.trim(),
        correo: formData.correo.trim().toLowerCase(),
        celular: formData.celular.replace(/[\s-]/g, '')
      };
      
      await api.post('/personas', datosParaEnviar);
      
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

  const getStepConfig = (step) => {
    const configs = {
      1: {
        title: 'Información de Documento',
        icon: (
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
      },
      2: {
        title: 'Nombres y Apellidos',
        icon: (
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )
      },
      3: {
        title: 'Información Personal',
        icon: (
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4M8 7h8M8 7l-1 10a2 2 0 002 2h6a2 2 0 002-2L16 7" />
          </svg>
        )
      },
      4: {
        title: 'Datos de Contacto',
        icon: (
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        )
      }
    };
    return configs[step];
  };

  const isStepCompleted = (step) => {
    const fields = getFieldsForStep(step);
    return fields.every(field => {
      const value = formData[field];
      return value && value.toString().trim() !== '';
    });
  };

  const renderStepContent = () => {
    const stepFields = {
      1: (
        <div className={styles.stepContent}>
          <div className={styles.formGroup}>
            <label htmlFor="tipoDocumento">
              <svg className={styles.fieldIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Tipo de documento <span className={styles.required}>*</span>
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
              <svg className={styles.fieldIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
              Número de documento <span className={styles.required}>*</span>
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
      ),
      2: (
        <div className={styles.stepContent}>
          <div className={styles.formGroup}>
            <label htmlFor="primerNombre">
              <svg className={styles.fieldIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Primer nombre <span className={styles.required}>*</span>
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
              <svg className={styles.fieldIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
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
              <svg className={styles.fieldIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Apellidos <span className={styles.required}>*</span>
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
      ),
      3: (
        <div className={styles.stepContent}>
          <div className={styles.formGroup}>
            <label htmlFor="fechaNacimiento">
              <svg className={styles.fieldIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4M8 7h8M8 7l-1 10a2 2 0 002 2h6a2 2 0 002-2L16 7" />
              </svg>
              Fecha de nacimiento <span className={styles.required}>*</span>
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
              <svg className={styles.fieldIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Género <span className={styles.required}>*</span>
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
      ),
      4: (
        <div className={styles.stepContent}>
          <div className={styles.formGroup}>
            <label htmlFor="correo">
              <svg className={styles.fieldIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Correo electrónico <span className={styles.required}>*</span>
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
              <svg className={styles.fieldIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Número de celular <span className={styles.required}>*</span>
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
      )
    };

    return stepFields[currentStep];
  };

  const currentStepConfig = getStepConfig(currentStep);

  return (
    <div className={styles.container}>
      {/* Header Section */}
      <div className={styles.headerSection}>
        <div className={styles.titleContainer}>
          <h2>
            <svg className={styles.titleIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
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
          {[1, 2, 3, 4].map((step) => {
            const stepConfig = getStepConfig(step);
            return (
              <div 
                key={step}
                className={`${styles.progressStep} ${
                  step === currentStep ? styles.active : 
                  step < currentStep ? styles.completed :
                  isStepCompleted(step) ? styles.filled : ''
                }`}
              >
                <div className={styles.stepNumber}>
                  {step < currentStep || isStepCompleted(step) ? (
                    <svg fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    step
                  )}
                </div>
                <span className={styles.stepLabel}>
                  {stepConfig.title}
                </span>
              </div>
            );
          })}
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
            <svg className={styles.alertIcon} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
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
              <span className={styles.stepIcon}>
                {currentStepConfig.icon}
              </span>
              {currentStepConfig.title}
            </h3>
            <p className={styles.stepDescription}>
              Paso {currentStep} de 4 • Complete todos los campos requeridos (<span className={styles.required}>*</span>)
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
                <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Anterior
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('/consultar')}
              className={styles.cancelButton}
              disabled={isSubmitting}
            >
              <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
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
                <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
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
                    <svg className={styles.buttonIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
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
            <svg className={styles.summaryIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
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