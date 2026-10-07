// Ensure unknown admin paths also pass through the directory middleware.
export function onRequest(): Response {
  return Response.json({ status: 'not_found' }, { status: 404 });
}
