// server/api/extract/status.get.ts
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  
  if (!query.jobId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing jobId' })
  }

  // The BFF asks the Python microservice for the status
  try {
    const response = await $fetch(`http://localhost:8000/api/extract/status?jobId=${query.jobId}`)
    return response // Send the Python response directly back to Vue
  } catch (error) {
    throw createError({ statusCode: 500, statusMessage: 'Microservice connection failed' })
  }
})