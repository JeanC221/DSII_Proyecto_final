/**
 * Utilidades para el manejo de fechas en la aplicación
 * Estandariza la conversión entre fechas de Firestore y JavaScript Date
 */

/**
 * Convierte un timestamp de Firestore a un objeto Date de JavaScript
 * @param {Object|Date|string|number} timestamp - Timestamp de Firestore, fecha, string o número
 * @returns {Date|null} - Objeto Date o null si no es válido
 */
export const firestoreTimestampToDate = (timestamp) => {
  if (!timestamp) return null;
  
  // Si es un objeto Firestore Timestamp (tiene seconds)
  if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
    return new Date(timestamp.seconds * 1000);
  }
  
  // Si ya es un objeto Date
  if (timestamp instanceof Date) {
    return timestamp;
  }
  
  // Si es string o número, intentar convertir
  try {
    const date = new Date(timestamp);
    // Verificar que sea una fecha válida
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch (error) {
    console.error("Error al convertir fecha:", error);
  }
  
  return null;
};

/**
 * Formatea una fecha para mostrar en la interfaz de usuario
 * @param {Object|Date|string|number} fecha - Fecha a formatear (puede ser timestamp de Firestore)
 * @param {boolean} includeTime - Si se debe incluir la hora
 * @returns {string} - Fecha formateada o cadena vacía si no es válida
 */
export const formatDate = (fecha, includeTime = false) => {
  const date = firestoreTimestampToDate(fecha);
  if (!date) return '';
  
  try {
    const options = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {})
    };
    
    return date.toLocaleDateString(undefined, options);
  } catch (error) {
    console.error("Error al formatear fecha:", error);
    return '';
  }
};

/**
 * Convierte una fecha a formato YYYY-MM-DD para inputs tipo date
 * @param {Object|Date|string|number} fecha - Fecha a convertir (puede ser timestamp de Firestore)
 * @returns {string} - Fecha en formato YYYY-MM-DD o cadena vacía si no es válida
 */
export const dateToInputValue = (fecha) => {
  const date = firestoreTimestampToDate(fecha);
  if (!date) return '';
  
  try {
    // Formatear como YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error("Error al convertir fecha para input:", error);
    return '';
  }
};

/**
 * Calcula la edad a partir de una fecha de nacimiento
 * @param {Object|Date|string|number} fechaNacimiento - Fecha de nacimiento
 * @returns {number|null} - Edad en años o null si no es válida
 */
export const calcularEdad = (fechaNacimiento) => {
  const birthDate = firestoreTimestampToDate(fechaNacimiento);
  if (!birthDate) return null;
  
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  // Si aún no ha cumplido años en este año
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

export default {
  firestoreTimestampToDate,
  formatDate,
  dateToInputValue,
  calcularEdad
};