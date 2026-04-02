/**
 * Middleware de gestion d'erreurs centralisé.
 * Intercepte toutes les erreurs lancées dans les routes.
 */
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const isDev = process.env.NODE_ENV !== "production";

  console.error(`❌ [${req.method}] ${req.path} → ${status} : ${err.message}`);

  res.status(status).json({
    error: {
      status,
      message: err.message || "Erreur interne",
      ...(isDev && { stack: err.stack }),
    },
  });
}

/**
 * Wrapper async pour éviter les try/catch dans chaque route.
 * Usage : router.get("/path", asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { errorHandler, asyncHandler };
