export class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message)
    this.name = 'ApplicationError'
  }
}

export class BadRequestError extends ApplicationError {
  constructor(message = 'Requisição inválida') {
    super(message, 400)
    this.name = 'BadRequestError'
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message = 'Recurso não encontrado') {
    super(message, 404)
    this.name = 'NotFoundError'
  }
}
