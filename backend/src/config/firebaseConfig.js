const admin = require('firebase-admin');

// Configuración usando variables de entorno
const serviceAccount = {
  "type": "service_account",
  "project_id": process.env.FIREBASE_PROJECT_ID,
  "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
  "private_key": process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  "client_email": process.env.FIREBASE_CLIENT_EMAIL,
  "client_id": process.env.FIREBASE_CLIENT_ID,
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": process.env.FIREBASE_CLIENT_CERT_URL
};

// Verificar que las variables requeridas estén presentes
const requiredEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY_ID', 
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_CLIENT_ID',
  'FIREBASE_CLIENT_CERT_URL'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('Variables de entorno de Firebase faltantes:', missingVars);
  // En desarrollo, permitir continuar sin Firebase
  if (process.env.NODE_ENV !== 'production') {
    console.warn('Ejecutando sin Firebase en modo desarrollo');
    module.exports = null;
  } else {
    throw new Error(`Variables de entorno requeridas: ${missingVars.join(', ')}`);
  }
} else {
  // Inicializar Firebase Admin
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
    });
    
    console.log('Firebase Admin inicializado correctamente');
    module.exports = admin;
  } catch (error) {
    console.error('Error inicializando Firebase:', error.message);
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Continuando sin Firebase en modo desarrollo');
      module.exports = null;
    } else {
      throw error;
    }
  }
}