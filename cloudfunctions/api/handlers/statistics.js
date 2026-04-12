const statisticsService = require('../services/statistics-service')

async function getStatisticsDashboard({ event, context, repository }) {
  return statisticsService.getStatisticsDashboard(event, context, repository)
}

module.exports = {
  getStatisticsDashboard
}
