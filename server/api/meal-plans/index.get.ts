// Summaries only (no slots/tray) — enough for the plans list landing state
// (see app/pages/meal-plan.vue). The planning page fetches a single plan's
// full detail separately via GET /api/meal-plans/:id.
export default defineEventHandler(() => {
  return listMealPlans()
})
