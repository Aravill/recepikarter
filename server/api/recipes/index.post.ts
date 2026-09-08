export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const input = parseRecipeInput(body)
  setResponseStatus(event, 201)
  return createRecipe(input)
})
