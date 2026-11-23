import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from 'fastify-type-provider-zod'
import { errorResponse } from '../utils/api-response.js'
import { ApplicationError } from '../utils/application-error.js'

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  if (hasZodFastifySchemaValidationErrors(error)) {
    const details = error.validation
      .map((issue) => {
        const field = issue.instancePath.replace(/^\//, '').replaceAll('/', '.')
        return field ? `${field}: ${issue.message}` : issue.message
      })
      .join('; ')
    return reply.status(400).send(errorResponse(`Dados inválidos. ${details}`))
  }

  if (isResponseSerializationError(error)) {
    request.log.error({ err: error, issues: error.cause.issues }, 'Resposta não corresponde ao schema')
    return reply.status(500).send(errorResponse('Erro interno do servidor'))
  }

  if (error instanceof ApplicationError) {
    return reply.status(error.statusCode).send(errorResponse(error.message))
  }

  const statusCode = error.statusCode ?? 500
  if (statusCode < 500) {
    return reply.status(statusCode).send(errorResponse(error.message))
  }

  request.log.error({ err: error }, 'Erro não tratado')
  return reply.status(500).send(errorResponse('Erro interno do servidor'))
}
