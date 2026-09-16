'use strict';

function requireAuth(req, res, next) {
  const userId = Number(req.session?.user?.id);

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return res.status(401).json({
      error: 'Authentication required.'
    });
  }

  req.session.user.id = userId;
  return next();
}

module.exports = requireAuth;
module.exports.requireAuth = requireAuth;