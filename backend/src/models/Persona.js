const { db } = require('../config/firebaseConfig');
const { Timestamp } = require('firebase-admin/firestore');

const personasCollection = db.collection('personas');

// Funciones de validación
const validaciones = {
  validarNombre: (nombre) => {
    if (!nombre || typeof nombre !== 'string' || nombre.length > 30 || !/^[A-Za-z ]+$/.test(nombre)) {
      throw new Error('El nombre debe ser texto, no mayor a 30 caracteres y sin números');
    }
    return true;
  },
  
  validarApellidos: (apellidos) => {
    if (!apellidos || typeof apellidos !== 'string' || apellidos.length > 60) {
      throw new Error('Los apellidos no deben superar 60 caracteres');
    }
    return true;
  },
  
  validarDocumento: (nro) => {
    if (!/^\d{1,10}$/.test(nro)) {
      throw new Error('El número de documento debe tener máximo 10 dígitos');
    }
    return true;
  },
  
  validarGenero: (genero) => {
    const opciones = ["Masculino", "Femenino", "No binario", "Prefiero no reportar"];
    if (!opciones.includes(genero)) {
      throw new Error('El género debe ser una opción válida');
    }
    return true;
  },
  
  validarCorreo: (correo) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      throw new Error('Formato de correo electrónico inválido');
    }
    return true;
  },
  
  validarCelular: (celular) => {
    if (!/^\d{10}$/.test(celular)) {
      throw new Error('El celular debe tener 10 dígitos');
    }
    return true;
  }
};

const Persona = {
  crear: async (datosPersona) => {
    try {
      // Validaciones
      validaciones.validarNombre(datosPersona.primerNombre);
      if (datosPersona.segundoNombre) validaciones.validarNombre(datosPersona.segundoNombre);
      validaciones.validarApellidos(datosPersona.apellidos);
      validaciones.validarDocumento(datosPersona.nroDocumento);
      validaciones.validarGenero(datosPersona.genero);
      validaciones.validarCorreo(datosPersona.correo);
      validaciones.validarCelular(datosPersona.celular);
      
      const fechaNacimiento = new Date(datosPersona.fechaNacimiento);
      
      const personaObj = {
        ...datosPersona,
        fechaNacimiento: Timestamp.fromDate(fechaNacimiento),
        createdAt: Timestamp.now()
      };
      
      const docRef = await personasCollection.add(personaObj);
      
      return {
        id: docRef.id,
        ...personaObj
      };
    } catch (error) {
      throw error;
    }
  },
  
  // Obtener todas las personas
  obtenerTodos: async () => {
    try {
      const snapshot = await personasCollection.orderBy('createdAt', 'desc').get();
      const personas = [];
      
      snapshot.forEach(doc => {
        personas.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return personas;
    } catch (error) {
      throw error;
    }
  },
  
  // Obtener persona por ID
  obtenerPorId: async (id) => {
    try {
      const doc = await personasCollection.doc(id).get();
      
      if (!doc.exists) {
        throw new Error('Persona no encontrada');
      }
      
      return {
        id: doc.id,
        ...doc.data()
      };
    } catch (error) {
      throw error;
    }
  },
  
  // Actualizar persona
  actualizar: async (id, datosActualizados) => {
    try {
      const doc = await personasCollection.doc(id).get();
      if (!doc.exists) {
        throw new Error('Persona no encontrada');
      }
      
      // Validar los campos que se van a actualizar
      if (datosActualizados.primerNombre) validaciones.validarNombre(datosActualizados.primerNombre);
      if (datosActualizados.segundoNombre) validaciones.validarNombre(datosActualizados.segundoNombre);
      if (datosActualizados.apellidos) validaciones.validarApellidos(datosActualizados.apellidos);
      if (datosActualizados.nroDocumento) validaciones.validarDocumento(datosActualizados.nroDocumento);
      if (datosActualizados.genero) validaciones.validarGenero(datosActualizados.genero);
      if (datosActualizados.correo) validaciones.validarCorreo(datosActualizados.correo);
      if (datosActualizados.celular) validaciones.validarCelular(datosActualizados.celular);
      
      if (datosActualizados.fechaNacimiento) {
        const fechaNacimiento = new Date(datosActualizados.fechaNacimiento);
        datosActualizados.fechaNacimiento = Timestamp.fromDate(fechaNacimiento);
      }
      
      // Actualizar datos
      await personasCollection.doc(id).update({
        ...datosActualizados,
        updatedAt: Timestamp.now()
      });
      
      return await Persona.obtenerPorId(id);
    } catch (error) {
      throw error;
    }
  },
  
  // Eliminar persona
  eliminar: async (id) => {
    try {
      const doc = await personasCollection.doc(id).get();
      if (!doc.exists) {
        throw new Error('Persona no encontrada');
      }
      
      await personasCollection.doc(id).delete();
      
      return { id, mensaje: 'Persona eliminada correctamente' };
    } catch (error) {
      throw error;
    }
  }
};

module.exports = Persona;