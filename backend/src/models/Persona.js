const { db } = require('../config/firebaseConfig');
const { Timestamp } = require('firebase-admin/firestore');

const personasCollection = db.collection('personas');

// Funciones de validación mejoradas
const validaciones = {
  validarNombre: (nombre) => {
    // Expresión regular mejorada para incluir caracteres españoles
    // Acepta letras (incluyendo acentuadas y ñ), espacios y apóstrofes
    if (!nombre || typeof nombre !== 'string' || nombre.length > 30 || 
        !/^[A-Za-zÁáÉéÍíÓóÚúÜüÑñ\s']+$/.test(nombre)) {
      throw new Error('El nombre debe contener solo letras, no mayor a 30 caracteres');
    }
    return true;
  },
  
  validarApellidos: (apellidos) => {
    // Expresión regular mejorada para apellidos
    // Incluye guiones para apellidos compuestos
    if (!apellidos || typeof apellidos !== 'string' || apellidos.length > 60 || 
        !/^[A-Za-zÁáÉéÍíÓóÚúÜüÑñ\s'-]+$/.test(apellidos)) {
      throw new Error('Los apellidos deben contener solo letras, no mayor a 60 caracteres');
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
    // Expresión regular más robusta para correos electrónicos
    // Soporta dominios internacionales y subdominios
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      throw new Error('Formato de correo electrónico inválido');
    }
    return true;
  },
  
  validarCelular: (celular) => {
    // Permite formatos internacionales opcionales
    // Acepta: 1234567890, +571234567890, etc.
    if (!/^(\+\d{1,3})?(\d{10})$/.test(celular.replace(/[\s-]/g, ''))) {
      throw new Error('El celular debe tener 10 dígitos. Formato: XXXXXXXXXX');
    }
    return true;
  },
  
  validarFecha: (fecha) => {
    // Verificar que sea una fecha válida y no en el futuro
    const fechaObj = new Date(fecha);
    const hoy = new Date();
    
    if (isNaN(fechaObj.getTime())) {
      throw new Error('Fecha de nacimiento inválida');
    }
    
    if (fechaObj > hoy) {
      throw new Error('La fecha de nacimiento no puede ser en el futuro');
    }
    
    // Verificar que la persona tenga al menos 1 año
    const edadMinima = new Date();
    edadMinima.setFullYear(hoy.getFullYear() - 1);
    
    if (fechaObj > edadMinima) {
      throw new Error('La persona debe tener al menos 1 año de edad');
    }
    
    return true;
  }
};

const Persona = {
  crear: async (datosPersona) => {
    try {
      // Validaciones
      validaciones.validarNombre(datosPersona.primerNombre);
      if (datosPersona.segundoNombre && datosPersona.segundoNombre.trim() !== '') {
        validaciones.validarNombre(datosPersona.segundoNombre);
      }
      validaciones.validarApellidos(datosPersona.apellidos);
      validaciones.validarDocumento(datosPersona.nroDocumento);
      validaciones.validarGenero(datosPersona.genero);
      validaciones.validarCorreo(datosPersona.correo);
      validaciones.validarCelular(datosPersona.celular);
      validaciones.validarFecha(datosPersona.fechaNacimiento);
      
      const fechaNacimiento = new Date(datosPersona.fechaNacimiento);
      
      // Limpieza de datos
      const personaObj = {
        ...datosPersona,
        primerNombre: datosPersona.primerNombre.trim(),
        segundoNombre: datosPersona.segundoNombre ? datosPersona.segundoNombre.trim() : '',
        apellidos: datosPersona.apellidos.trim(),
        correo: datosPersona.correo.trim().toLowerCase(),
        celular: datosPersona.celular.replace(/[\s-]/g, ''), // Eliminar espacios o guiones
        fechaNacimiento: Timestamp.fromDate(fechaNacimiento),
        createdAt: Timestamp.now()
      };
      
      // Verificar si ya existe un documento con el mismo número
      const existingDocs = await personasCollection
        .where('nroDocumento', '==', datosPersona.nroDocumento)
        .get();
      
      if (!existingDocs.empty) {
        throw new Error(`Ya existe una persona registrada con el número de documento ${datosPersona.nroDocumento}`);
      }
      
      // Crear el documento
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
        const datos = doc.data();
        
        // Convertir Timestamp a objetos Date para serialización
        const fechaNacimiento = datos.fechaNacimiento ? datos.fechaNacimiento.toDate() : null;
        const createdAt = datos.createdAt ? datos.createdAt.toDate() : null;
        const updatedAt = datos.updatedAt ? datos.updatedAt.toDate() : null;
        
        personas.push({
          id: doc.id,
          ...datos,
          fechaNacimiento,
          createdAt,
          updatedAt
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
      
      const datos = doc.data();
      
      // Convertir Timestamp a objetos Date para serialización
      const fechaNacimiento = datos.fechaNacimiento ? datos.fechaNacimiento.toDate() : null;
      const createdAt = datos.createdAt ? datos.createdAt.toDate() : null;
      const updatedAt = datos.updatedAt ? datos.updatedAt.toDate() : null;
      
      return {
        id: doc.id,
        ...datos,
        fechaNacimiento,
        createdAt,
        updatedAt
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
      
      const datosActuales = doc.data();
      
      // Validar solo los campos que se van a actualizar
      if (datosActualizados.primerNombre) {
        validaciones.validarNombre(datosActualizados.primerNombre);
        datosActualizados.primerNombre = datosActualizados.primerNombre.trim();
      }
      
      if (datosActualizados.segundoNombre) {
        if (datosActualizados.segundoNombre.trim() !== '') {
          validaciones.validarNombre(datosActualizados.segundoNombre);
        }
        datosActualizados.segundoNombre = datosActualizados.segundoNombre.trim();
      }
      
      if (datosActualizados.apellidos) {
        validaciones.validarApellidos(datosActualizados.apellidos);
        datosActualizados.apellidos = datosActualizados.apellidos.trim();
      }
      
      if (datosActualizados.nroDocumento) {
        validaciones.validarDocumento(datosActualizados.nroDocumento);
        
        // Verificar si el nuevo número ya existe para otra persona
        if (datosActualizados.nroDocumento !== datosActuales.nroDocumento) {
          const existingDocs = await personasCollection
            .where('nroDocumento', '==', datosActualizados.nroDocumento)
            .get();
          
          if (!existingDocs.empty) {
            throw new Error(`Ya existe una persona registrada con el número de documento ${datosActualizados.nroDocumento}`);
          }
        }
      }
      
      if (datosActualizados.genero) {
        validaciones.validarGenero(datosActualizados.genero);
      }
      
      if (datosActualizados.correo) {
        validaciones.validarCorreo(datosActualizados.correo);
        datosActualizados.correo = datosActualizados.correo.trim().toLowerCase();
      }
      
      if (datosActualizados.celular) {
        validaciones.validarCelular(datosActualizados.celular);
        datosActualizados.celular = datosActualizados.celular.replace(/[\s-]/g, '');
      }
      
      if (datosActualizados.fechaNacimiento) {
        validaciones.validarFecha(datosActualizados.fechaNacimiento);
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
  },
  
  // Buscar personas por filtros
  buscar: async (filtros) => {
    try {
      let query = personasCollection;
      
      // Aplicar filtros
      if (filtros.nroDocumento) {
        query = query.where('nroDocumento', '==', filtros.nroDocumento);
      }
      
      if (filtros.genero) {
        query = query.where('genero', '==', filtros.genero);
      }
      
      if (filtros.apellidos) {
        // Firestore no soporta búsquedas parciales directamente
        // Aquí haremos un filtrado del lado del cliente
        const snapshot = await query.get();
        const personas = [];
        
        snapshot.forEach(doc => {
          const data = doc.data();
          
          if (data.apellidos.toLowerCase().includes(filtros.apellidos.toLowerCase())) {
            // Convertir Timestamp a objetos Date para serialización
            const fechaNacimiento = data.fechaNacimiento ? data.fechaNacimiento.toDate() : null;
            const createdAt = data.createdAt ? data.createdAt.toDate() : null;
            const updatedAt = data.updatedAt ? data.updatedAt.toDate() : null;
            
            personas.push({
              id: doc.id,
              ...data,
              fechaNacimiento,
              createdAt,
              updatedAt
            });
          }
        });
        
        return personas;
      }
      
      // Si no hay filtros por apellidos, ejecutar la consulta normalmente
      const snapshot = await query.get();
      const personas = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        
        // Convertir Timestamp a objetos Date para serialización
        const fechaNacimiento = data.fechaNacimiento ? data.fechaNacimiento.toDate() : null;
        const createdAt = data.createdAt ? data.createdAt.toDate() : null;
        const updatedAt = data.updatedAt ? data.updatedAt.toDate() : null;
        
        personas.push({
          id: doc.id,
          ...data,
          fechaNacimiento,
          createdAt,
          updatedAt
        });
      });
      
      return personas;
    } catch (error) {
      throw error;
    }
  }
};

module.exports = Persona;