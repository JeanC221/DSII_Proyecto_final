import React, { useState } from "react";  
import axios from "axios";  

const CreatePerson = () => {  
  const [formData, setFormData] = useState({  
    primerNombre: "",  
    apellidos: "",  
    fechaNacimiento: "",  
    genero: "",  
    correo: ""  
  });  

  const handleSubmit = async (e) => {  
    e.preventDefault();  
    try {  
      await axios.post("http://backend:5000/api/personas", formData);  
      alert("Persona creada exitosamente!");  
    } catch (error) {  
      alert("Error: " + error.response.data.error);  
    }  
  };  

  return (  
    <form onSubmit={handleSubmit}>  
      <input  
        type="text"  
        placeholder="Primer Nombre"  
        onChange={(e) => setFormData({ ...formData, primerNombre: e.target.value })}  
      />  
      {/* Repetir para otros campos */}  
      <button type="submit">Guardar</button>  
    </form>  
  );  
};  

export default CreatePerson;  