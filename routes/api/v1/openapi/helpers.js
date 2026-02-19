const ErrorResponse = {
  type: 'object',
  properties: {
    data: { type: 'null' },
    error: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        code: { type: 'string' },
      },
      required: ['message', 'code'],
    },
  },
  required: ['data', 'error'],
};

const DataResponse = (schema) => ({
  type: 'object',
  properties: {
    data: schema,
    error: { type: 'null' },
  },
  required: ['data', 'error'],
});

const okResponse = (schema) => ({
  description: 'OK',
  headers: {
    ETag: { schema: { type: 'string' } },
  },
  content: {
    'application/json': {
      schema: DataResponse(schema),
    },
  },
});

const listParameters = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
  { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
  { name: 'sortBy', in: 'query', schema: { type: 'string' } },
  { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['ASC', 'DESC'] } },
];

const idempotencyKeyHeader = {
  name: 'Idempotency-Key',
  in: 'header',
  schema: { type: 'string' },
};

const ifMatchHeader = {
  name: 'If-Match',
  in: 'header',
  schema: { type: 'string' },
};

const withListParams = (params = []) => [...params, ...listParameters];
const withIdempotency = (params = []) => [...params, idempotencyKeyHeader];
const withIdempotencyAndIfMatch = (params = []) => [...params, idempotencyKeyHeader, ifMatchHeader];

const errorResponses = {
  400: { description: 'Bad Request', content: { 'application/json': { schema: ErrorResponse } } },
  403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorResponse } } },
  404: { description: 'Not Found', content: { 'application/json': { schema: ErrorResponse } } },
  412: { description: 'Precondition Failed', content: { 'application/json': { schema: ErrorResponse } } },
};

module.exports = {
  ErrorResponse,
  DataResponse,
  okResponse,
  withListParams,
  withIdempotency,
  withIdempotencyAndIfMatch,
  errorResponses,
};
