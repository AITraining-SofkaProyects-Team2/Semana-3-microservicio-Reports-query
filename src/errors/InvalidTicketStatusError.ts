export class InvalidTicketStatusError extends Error {
  constructor(status: string) {
    super(`Estado inválido: "${status}". Estados permitidos: RECEIVED, IN_PROGRESS`);
    this.name = 'InvalidTicketStatusError';
  }
}
