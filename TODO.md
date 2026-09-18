# TODO

Known follow-ups from the meal plan (jídelnář) feature (PR #33), not
blocking but worth a decision:

- **Drag-and-drop has no touch/mobile support.** It uses native HTML5 DnD
  (`draggable`/`dragstart`/`dragover`/`drop`), which doesn't work on touch
  browsers without a polyfill — at odds with the app's otherwise phone-first
  design. Needs a touch-friendly interaction (or a polyfill) if meal plans
  are used from a phone.
- **Shrinking a saved plan's date range silently drops slot assignments**
  outside the new range (`syncMealPlanSlots` in `server/utils/db.ts`). No
  confirmation warns about this before saving.
- **Portions-remaining math depends on parsing free-text servings.**
  `Recipe.servings` is a free-text field, not numeric, so
  `parseServingsCount` (`shared/utils/meal-plan.ts`) extracts the leading
  number; an unparseable or empty value is treated as unlimited (always a
  droppable badge). Worth revisiting if recipes commonly have non-numeric
  servings text.
