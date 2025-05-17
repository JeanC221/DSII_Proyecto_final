// backend/src/config/firebaseConfig.js
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

// Intentar cargar las credenciales con manejo de errores mejorado
let serviceAccount;
try {
  // Primero intentamos la ruta relativa a la ubicación actual del archivo
  const credentialsPath = path.resolve(__dirname, '../credentials/firebase-credentials.json');
  
  // Verificar si el archivo existe
  if (fs.existsSync(credentialsPath)) {
    serviceAccount = require(credentialsPath);
  } else {
    // Intentar con la ruta alternativa (directamente en src)
    const alternatePath = path.resolve(__dirname, '../firebase-credentials.json');
    
    if (fs.existsSync(alternatePath)) {
      serviceAccount = require(alternatePath);
    } else {
      console.error('No se encontró el archivo de credenciales de Firebase');
      throw new Error('Archivo de credenciales de Firebase no encontrado');
    }
  }
} catch (error) {
  console.error('Error al cargar las credenciales de Firebase:', error);
  throw error;
}

// Inicializar la aplicación de Firebase con las credenciales
const firebaseApp = initializeApp({
  credential: cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id
});

const db = getFirestore();

module.exports = { firebaseApp, db };