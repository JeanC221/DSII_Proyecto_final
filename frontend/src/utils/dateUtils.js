/**
 * @param {Object|Date|string|number} timestamp 
 * @returns {Date|null} 
 */
export const firestoreTimestampToDate = (timestamp) => {
  if (!timestamp) return null;
  
  if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
    return new Date(timestamp.seconds * 1000);
  }
  
  if (timestamp instanceof Date) {
    return timestamp;
  }
  
  try {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch (error) {
    console.error("Error al convertir fecha:", error);
  }
  
  return null;
};

/**
 * @param {Object|Date|string|number} fecha 
 * @param {boolean} includeTime 
 * @returns {string} 
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
 * @param {Object|Date|string|number} fecha 
 * @returns {string} 
 */
export const dateToInputValue = (fecha) => {
  const date = firestoreTimestampToDate(fecha);
  if (!date) return '';
  
  try {
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
 * @param {Object|Date|string|number} fechaNacimiento 
 * @returns {number|null} 
 */
export const calcularEdad = (fechaNacimiento) => {
  const birthDate = firestoreTimestampToDate(fechaNacimiento);
  if (!birthDate) return null;
  
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
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