const { clearHash } = require('../services/cache');

module.exports = async (req, res, next) => {
  // let route handler finish
  await next();

  clearHash(req.user.id);
};
