# Aplicación de Gestión de Datos Personales

Sistema para gestionar información personal con consultas en lenguaje natural implementado con Firebase como backend.

## Descripción

Este proyecto consiste en una aplicación web para la gestión de datos personales que permite:
- Crear, consultar, modificar y eliminar registros de personas
- Consultar información utilizando lenguaje natural (implementación RAG)
- Registro de actividades (logs) de todas las operaciones
- Validación de datos según requisitos específicos

## Tecnologías Utilizadas

### Frontend
- React.js
- React Router para navegación
- Axios para peticiones HTTP
- Yup para validación de formularios
- CSS Modules para estilos

### Backend
- Node.js con Express.js
- Firebase Firestore como base de datos
- Firebase Admin SDK para autenticación y acceso a datos

### Contenedorización
- Docker y Docker Compose para orquestar servicios

## Estructura del Proyecto

```
├── backend/                  # Servidor API REST
│   ├── src/                  # Código fuente
│   │   ├── config/           # Configuración (Firebase)
│   │   ├── models/           # Modelos de datos
│   │   ├── routes/           # Rutas de la API
│   │   ├── utils/            # Utilidades (logger)
│   │   └── index.js          # Punto de entrada
│   └── Dockerfile            # Configuración de contenedor
│
├── frontend/                 # Aplicación React
│   ├── public/               # Archivos estáticos
│   ├── src/                  # Código fuente
│   │   ├── components/       # Componentes React
│   │   ├── config/           # Configuración (Axios)
│   │   └── styles/           # Estilos globales
│   └── Dockerfile            # Configuración de contenedor
│
├── docker-compose.yml        # Orquestación de servicios
└── .env                      # Variables de entorno
```

## Requisitos

- Docker y Docker Compose
- Cuenta de Firebase (plan gratuito)
- Archivo de credenciales de Firebase (`firebase-credentials.json`)

## Instalación y Ejecución

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/JeanC221/DSII_Proyecto_final.git
   cd DSII_Proyecto_final
   ```

2. **Configurar Firebase**:
   - Crear proyecto en [Firebase Console](https://console.firebase.google.com/)
   - Habilitar Firestore Database
   - Generar credenciales desde Configuración del proyecto > Cuentas de servicio
   - Guardar el archivo JSON como `backend/src/firebase-credentials.json`

3. **Configurar variables de entorno**:
   - Crear archivo `.env` en la raíz del proyecto:
     ```
     FIREBASE_PROJECT_ID=tu-proyecto-id
     ```

4. **Construir y ejecutar contenedores**:
   ```bash
   docker-compose build
   docker-compose up -d
   ```

5. **Acceder a la aplicación**:
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - API Backend: [http://localhost:5000](http://localhost:5000)

## Funcionalidades

### Gestión de Personas
- Creación con validación de datos
- Consulta y filtrado de registros
- Edición de información personal
- Eliminación de registros

### Consulta en Lenguaje Natural
- Interfaz para consultas en lenguaje coloquial
- Ejemplos predefinidos de consultas
- Respuestas generadas automáticamente

### Registro de Actividades
- Seguimiento de todas las operaciones
- Consulta de historial de acciones

## Validaciones

- Tipo de documento: Tarjeta de identidad o Cédula
- Número de documento: Máximo 10 dígitos numéricos
- Nombres: Solo letras, máximo 30 caracteres
- Apellidos: Solo letras, máximo 60 caracteres
- Género: Opciones predefinidas (Masculino, Femenino, No binario, Prefiero no reportar)
- Correo electrónico: Formato válido
- Celular: 10 dígitos numéricos

## Autores

- Jean Carlos
- Esteban Ramírez
- Fabian Pallares
- Jonathan Castellanos

## Licencia

Este proyecto fue desarrollado con fines académicos para la asignatura Diseño de Software II.
