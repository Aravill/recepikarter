export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const input = parseMealPlanInput(body)
  setResponseStatus(event, 201)
  return createMealPlan(input)
})
