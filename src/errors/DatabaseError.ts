export class DatabaseError extends Error {
  constructor(message = 'Error interno de base de datos') {
    super(message);
    this.name = 'DatabaseError';
  }
}
