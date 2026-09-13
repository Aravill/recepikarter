import { CATEGORIES, CATEGORY_LABELS, DIFFICULTIES, DIFFICULTY_LABELS } from '#shared/types/recipe'
import type { RecipeInput } from '#shared/types/recipe'

// The worked example doubles as the format spec the model imitates, so it
// has to be something POST /api/recipes/import would accept as-is (the test
// runs it through parseRecipeInput to make sure).
const EXAMPLE: RecipeInput = {
  name: 'Bramboračka',
  category: 'Soup',
  cookTime: 45,
  cookTimeDifficulty: 'Easy',
  servings: '4',
  ingredients: ['500 g brambor', '1 cibule', '2 stroužky česneku', '1 l vody', 'hrst sušených hub', 'sůl', 'majoránka'],
  steps: [
    'Houby namočte do vlažné vody na 20 minut.',
    'Cibuli a česnek nakrájejte a orestujte na sádle.',
    'Přidejte nakrájené brambory, houby s vodou a vařte 25 minut doměkka.',
    'Dochuťte solí a majoránkou.',
  ],
  tags: ['polévka', 'houby', 'klasika'],
}

// Builds the instructions a user pastes into whichever chat LLM they use,
// followed by a recipe copied off a website, to get back JSON that the ⬆
// import button on the home page accepts. Instructions are English (models
// follow them most reliably) but the recipe content is required in Czech,
// matching the rest of the app. The allowed enum values and their Czech
// meanings come straight from shared/types/recipe.ts so a new category
// shows up here without anyone remembering to update the prompt.
export function buildImportPrompt(): string {
  const categoryList = CATEGORIES.map((c) => `  - "${c}" (${CATEGORY_LABELS[c]})`).join('\n')
  const difficultyList = DIFFICULTIES.map((d) => `  - "${d}" (${DIFFICULTY_LABELS[d]})`).join('\n')

  return `You are converting a recipe into a JSON file for import into Recepikarter, a personal recipe-card app.

I will paste a recipe (text copied from a website, or a URL) after these instructions. Convert it into JSON that follows the schema below exactly. Reply with the JSON only — no commentary, no markdown code fences.

OUTPUT SHAPE

A JSON array containing exactly one object with these fields, all required:

- "name": string. The recipe's name in Czech, short, without the site's marketing adjectives.
- "category": one of these exact English values (the Czech meaning is in parentheses — do not output the Czech word):
${categoryList}
- "cookTime": integer. Total active minutes from start to plate (preparation plus cooking). Exclude long passive waits such as overnight marinating or chilling. Estimate sensibly if the source doesn't say.
- "cookTimeDifficulty": one of these exact English values:
${difficultyList}
  Judge by technique and number of steps, not by the source's own label.
- "servings": string. The number of servings as digits, e.g. "4". Use "" (empty string) if unknown.
- "ingredients": array of strings, one ingredient per entry, in the order used. Put the amount first, metric units, e.g. "200 g hladké mouky", "2 lžíce oleje", "1 cibule". If the source groups ingredients into sections (dough, filling…), keep the order but do not add section headings.
- "steps": array of strings, one step per entry, in order. Do not prefix steps with numbers. Each step should be a complete instruction with the times and temperatures the source gives.
- "tags": array of 0–5 short lowercase Czech tags for the main ingredient, cuisine or occasion, e.g. ["kuřecí", "rychlé", "vánoce"].

RULES

- Write all recipe content in Czech. Translate if the source is in another language, keeping standard Czech culinary terms.
- Keep quantities exactly as given; convert imperial units to metric. Never invent ingredients or steps that aren't in the source.
- Leave out the site's intro story, comments, nutrition tables and advertising.
- If the source contains several recipes, convert only the main one.
- Output valid JSON: double quotes, no trailing commas, no comments.

EXAMPLE OUTPUT

${JSON.stringify([EXAMPLE], null, 2)}

Here is the recipe to convert:
`
}
