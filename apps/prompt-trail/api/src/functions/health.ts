import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';

export async function health(
  _request: HttpRequest,
  _context: InvocationContext,
): Promise<HttpResponseInit> {
  return { status: 200, jsonBody: { status: 'ok' } };
}

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: health,
});
