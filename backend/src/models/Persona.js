const admin = require('../config/firebaseConfig');
const { Timestamp } = require('firebase-admin/firestore');

// Verificar que Firebase esté inicializado y obtener la instancia de Firestore
let personasCollection;
let db;

if (!admin) {
  console.warn('⚠️  Firebase no está configurado - Usando funcionalidad limitada');
  // Crear funciones mock para desarrollo sin Firebase
} else {
  db = admin.firestore();
  personasCollection = db.collection('personas');
}

const validaciones = {
  validarNombre: (nombre) => {
    if (!nombre || typeof nombre !== 'string' || nombre.length > 30 || 
        !/^[A-Za-zÁáÉéÍíÓóÚúÜüÑñ\s']+$/.test(nombre)) {
      throw new Error('El nombre debe contener solo letras, no mayor a 30 caracteres');
    }
    return true;
  },
  
  validarApellidos: (apellidos) => {
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      throw new Error('Formato de correo electrónico inválido');
    }
    return true;
  },
  
  validarCelular: (celular) => {
    if (!/^(\+\d{1,3})?(\d{10})$/.test(celular.replace(/[\s-]/g, ''))) {
      throw new Error('El celular debe tener 10 dígitos. Formato: XXXXXXXXXX');
    }
    return true;
  },
  
  validarFecha: (fecha) => {
    const fechaObj = new Date(fecha);
    const hoy = new Date();
    
    if (isNaN(fechaObj.getTime())) {
      throw new Error('Fecha de nacimiento inválida');
    }
    
    if (fechaObj > hoy) {
      throw new Error('La fecha de nacimiento no puede ser en el futuro');
    }
    
    const edadMinima = new Date();
    edadMinima.setFullYear(hoy.getFullYear() - 1);
    
    if (fechaObj > edadMinima) {
      throw new Error('La persona debe tener al menos 1 año de edad');
    }
    
    return true;
  }
};

// Funciones mock para cuando Firebase no está disponible
const mockPersonas = [];
let mockIdCounter = 1;

const mockFunctions = {
  crear: async (datosPersona) => {
    console.log('🔄 Usando función mock para crear persona');
    
    // Validar datos igual que en la versión real
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
    
    // Verificar documento único
    const existeDocumento = mockPersonas.find(p => p.nroDocumento === datosPersona.nroDocumento);
    if (existeDocumento) {
      throw new Error(`Ya existe una persona registrada con el número de documento ${datosPersona.nroDocumento}`);
    }
    
    const persona = {
      id: `mock-${mockIdCounter++}`,
      ...datosPersona,
      primerNombre: datosPersona.primerNombre.trim(),
      segundoNombre: datosPersona.segundoNombre ? datosPersona.segundoNombre.trim() : '',
      apellidos: datosPersona.apellidos.trim(),
      correo: datosPersona.correo.trim().toLowerCase(),
      celular: datosPersona.celular.replace(/[\s-]/g, ''),
      fechaNacimiento: new Date(datosPersona.fechaNacimiento),
      createdAt: new Date()
    };
    
    mockPersonas.push(persona);
    return persona;
  },
  
  obtenerTodos: async () => {
    console.log('🔄 Usando función mock para obtener todas las personas');
    return [...mockPersonas].reverse(); // Más recientes primero
  },
  
  obtenerPorId: async (id) => {
    console.log('🔄 Usando función mock para obtener persona por ID');
    const persona = mockPersonas.find(p => p.id === id);
    if (!persona) {
      throw new Error('Persona no encontrada');
    }
    return persona;
  },
  
  actualizar: async (id, datosActualizados) => {
    console.log('🔄 Usando función mock para actualizar persona');
    const index = mockPersonas.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error('Persona no encontrada');
    }
    
    // Validaciones para datos actualizados
    if (datosActualizados.primerNombre) {
      validaciones.validarNombre(datosActualizados.primerNombre);
    }
    if (datosActualizados.apellidos) {
      validaciones.validarApellidos(datosActualizados.apellidos);
    }
    // ... más validaciones según necesites
    
    mockPersonas[index] = {
      ...mockPersonas[index],
      ...datosActualizados,
      updatedAt: new Date()
    };
    
    return mockPersonas[index];
  },
  
  eliminar: async (id) => {
    console.log('🔄 Usando función mock para eliminar persona');
    const index = mockPersonas.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error('Persona no encontrada');
    }
    
    mockPersonas.splice(index, 1);
    return { id, mensaje: 'Persona eliminada correctamente' };
  },
  
  buscar: async (filtros) => {
    console.log('🔄 Usando función mock para buscar personas');
    let resultado = [...mockPersonas];
    
    if (filtros.nroDocumento) {
      resultado = resultado.filter(p => p.nroDocumento === filtros.nroDocumento);
    }
    
    if (filtros.genero) {
      resultado = resultado.filter(p => p.genero === filtros.genero);
    }
    
    if (filtros.apellidos) {
      resultado = resultado.filter(p => 
        p.apellidos.toLowerCase().includes(filtros.apellidos.toLowerCase())
      );
    }
    
    return resultado;
  }
};

// Exportar las funciones apropiadas según si Firebase está disponible
const Persona = !admin ? mockFunctions : {
  crear: async (datosPersona) => {
    try {
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
      
      const personaObj = {
        ...datosPersona,
        primerNombre: datosPersona.primerNombre.trim(),
        segundoNombre: datosPersona.segundoNombre ? datosPersona.segundoNombre.trim() : '',
        apellidos: datosPersona.apellidos.trim(),
        correo: datosPersona.correo.trim().toLowerCase(),
        celular: datosPersona.celular.replace(/[\s-]/g, ''), 
        fechaNacimiento: Timestamp.fromDate(fechaNacimiento),
        createdAt: Timestamp.now()
      };
      
      const existingDocs = await personasCollection
        .where('nroDocumento', '==', datosPersona.nroDocumento)
        .get();
      
      if (!existingDocs.empty) {
        throw new Error(`Ya existe una persona registrada con el número de documento ${datosPersona.nroDocumento}`);
      }
      
      const docRef = await personasCollection.add(personaObj);
      
      return {
        id: docRef.id,
        ...personaObj
      };
    } catch (error) {
      throw error;
    }
  },
  
  obtenerTodos: async () => {
    try {
      const snapshot = await personasCollection.orderBy('createdAt', 'desc').get();
      const personas = [];
      
      snapshot.forEach(doc => {
        const datos = doc.data();
        
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
  
  obtenerPorId: async (id) => {
    try {
      const doc = await personasCollection.doc(id).get();
      
      if (!doc.exists) {
        throw new Error('Persona no encontrada');
      }
      
      const datos = doc.data();
      
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
  
  actualizar: async (id, datosActualizados) => {
    try {
      const doc = await personasCollection.doc(id).get();
      if (!doc.exists) {
        throw new Error('Persona no encontrada');
      }
      
      const datosActuales = doc.data();
      
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
      
      await personasCollection.doc(id).update({
        ...datosActualizados,
        updatedAt: Timestamp.now()
      });
      
      return await Persona.obtenerPorId(id);
    } catch (error) {
      throw error;
    }
  },
  
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
  
  buscar: async (filtros) => {
    try {
      let query = personasCollection;
      
      if (filtros.nroDocumento) {
        query = query.where('nroDocumento', '==', filtros.nroDocumento);
      }
      
      if (filtros.genero) {
        query = query.where('genero', '==', filtros.genero);
      }
      
      if (filtros.apellidos) {
        const snapshot = await query.get();
        const personas = [];
        
        snapshot.forEach(doc => {
          const data = doc.data();
          
          if (data.apellidos.toLowerCase().includes(filtros.apellidos.toLowerCase())) {
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
      
      const snapshot = await query.get();
      const personas = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        
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