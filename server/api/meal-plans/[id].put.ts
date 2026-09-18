// Renaming, resizing the date range, and changing people_count — the
// "Uložit plán" button on the planning page. A shrunk date range drops any
// slot assignments outside the new range (see syncMealPlanSlots in
// server/utils/db.ts); the client is expected to warn before that happens,
// this route doesn't refuse it.
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const input = parseMealPlanInput(body)
  const plan = updateMealPlan(id, input)
  if (!plan) {
    throw createError({ statusCode: 404, statusMessage: 'Meal plan not found' })
  }
  return plan
})
