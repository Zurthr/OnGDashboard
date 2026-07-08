// server/api/extract/start.post.ts
export default defineEventHandler(async (event) => {
  // 1. Read the file uploaded from Vue to the Nuxt BFF
  const formData = await readMultipartFormData(event)
  const fileData = formData?.find(item => item.name === 'file')

  if (!fileData) {
    throw createError({ statusCode: 400, statusMessage: 'No file provided' })
  }

  // 2. Repackage the file to send to the Python microservice
  const pythonFormData = new FormData()
  // Convert the raw buffer back into a Blob/File format that Python expects
  // Wrap fileData.data in a Uint8Array
  const blob = new Blob([new Uint8Array(fileData.data)], { type: fileData.type })
  pythonFormData.append('file', blob, fileData.filename)

  // 3. Forward the request to Python
  try {
    const response = await $fetch('http://localhost:8000/api/extract/start', {
      method: 'POST',
      body: pythonFormData
    })
    
    // Return the jobId back to Vue
    return response 
  } catch (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to start extraction on microservice' })
  }
})