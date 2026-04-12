const { callCloud } = require('./cloud')
const { unwrapResponse } = require('./session')

function createStatisticsService(dependencies = {}) {
  const cloudCall = dependencies.callCloud || callCloud

  return {
    async getStatisticsDashboard(spaceId) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'getStatisticsDashboard',
          spaceId
        })
      )
    }
  }
}

module.exports = {
  createStatisticsService
}
