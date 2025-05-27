const { MongoClient } = require('mongodb');

class MongoDBManager {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.connectionUrl = process.env.MONGODB_URL || 'mongodb://mongodb:27017/logs_db';
    this.dbName = 'logs_db';
    this.retryAttempts = 3;
    this.retryDelay = 5000; 
  }

  async connect() {
    if (this.isConnected) {
      return this.db;
    }

    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`🔄 MongoDB: Intento de conexión ${attempt}/${this.retryAttempts}`);
        
        this.client = new MongoClient(this.connectionUrl, {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        });

        await this.client.connect();
        this.db = this.client.db(this.dbName);
        
        await this.db.admin().ping();
        
        this.isConnected = true;
        console.log('✅ MongoDB: Conexión establecida exitosamente');
        
        await this.createIndexes();
        
        return this.db;
        
      } catch (error) {
        lastError = error;
        console.error(`❌ MongoDB: Intento ${attempt} fallido - ${error.message}`);
        
        if (attempt < this.retryAttempts) {
          console.log(`⏳ MongoDB: Reintentando en ${this.retryDelay/1000} segundos...`);
          await this.sleep(this.retryDelay);
        }
      }
    }
    
    console.error('💥 MongoDB: Todos los intentos de conexión fallaron');
    throw lastError;
  }

  async createIndexes() {
    try {
      const logsCollection = this.db.collection('logs');
      
      await logsCollection.createIndex({ "timestamp": -1 }); 
      await logsCollection.createIndex({ "accion": 1 }); 
      await logsCollection.createIndex({ "detalles": "text" }); 
      await logsCollection.createIndex({ "timestamp": -1, "accion": 1 }); 
      
      console.log('✅ MongoDB: Índices creados correctamente');
    } catch (error) {
      console.warn('⚠️ MongoDB: Error creando índices (no crítico):', error.message);
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      try {
        await this.client.close();
        this.isConnected = false;
        console.log('🔌 MongoDB: Conexión cerrada');
      } catch (error) {
        console.error('❌ MongoDB: Error al cerrar conexión:', error.message);
      }
    }
  }

  async isHealthy() {
    try {
      if (!this.isConnected || !this.db) {
        return false;
      }
      
      await this.db.admin().ping();
      return true;
    } catch (error) {
      console.warn('⚠️ MongoDB: Health check fallido:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  getDatabase() {
    if (!this.isConnected || !this.db) {
      throw new Error('MongoDB no está conectado');
    }
    return this.db;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const mongoManager = new MongoDBManager();

module.exports = { mongoManager };