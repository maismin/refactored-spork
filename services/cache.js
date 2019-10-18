const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');

const redisUrl = 'redis://127.0.0.1:6379';
const client = redis.createClient(redisUrl);

// Convert client's hget function that accepts a callback into
// a function that returns a promise
client.hget = util.promisify(client.hget);

// Get reference to existing default exec function defined on mongoose query
const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function(options = {}) {
  this.useCache = true;
  this.hashKey = JSON.stringify(options.key || '');
  return this; // return query to allow chainable calls
};

// Overwrite existing query exec function for caching logic
mongoose.Query.prototype.exec = async function() {
  if (!this.useCache) {
    return exec.apply(this, arguments);
  }

  const key = JSON.stringify(
    Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name,
    }),
  );

  // Check if key is in redis
  const cacheValue = await client.hget(this.hashKey, key);

  // If we do, return the value
  if (cacheValue) {
    const doc = JSON.parse(cacheValue);

    return Array.isArray(doc)
      ? doc.map(d => new this.model(d))
      : new this.model(doc);
  }

  // Otherwise, issue the query
  const result = await exec.apply(this, arguments);

  // Store the result into redis
  client.hset(this.hashKey, key, JSON.stringify(result), 'EX', 10);

  return result;
};

function clearHash(hashKey) {
  client.del(JSON.stringify(hashKey));
}

module.exports = {
  clearHash,
};
