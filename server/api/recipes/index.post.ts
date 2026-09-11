export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const body = await readBody(event)
  const input = parseRecipeInput(body)
  setResponseStatus(event, 201)
  return createRecipe(input, user.username)
})
