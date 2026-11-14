// Writes inside a transaction must complete before the transaction commits.
async function eachSeries(items, callback) {
  for (let index = 0; index < items.length; index++) await callback(items[index], index);
}
module.exports = { eachSeries };
