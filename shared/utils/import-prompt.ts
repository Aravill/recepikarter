import { CATEGORIES, CATEGORY_LABELS, DIFFICULTIES, DIFFICULTY_LABELS } from '#shared/types/recipe'
import type { RecipeInput } from '#shared/types/recipe'

// Language the *instructions* are written in. The recipe content is Czech
// either way; this only affects how the user talks to their model.
export const PROMPT_LANGS = ['en', 'cs'] as const
export type PromptLang = (typeof PROMPT_LANGS)[number]

export const PROMPT_LANG_LABELS: Record<PromptLang, string> = {
  en: 'Anglicky',
  cs: 'Česky',
}

// The worked example doubles as the format spec the model imitates, so it
// has to be something POST /api/recipes/import would accept as-is (the test
// runs it through parseRecipeInput to make sure).
const EXAMPLE: RecipeInput = {
  name: 'Bramboračka',
  category: 'Soup',
  cookTime: 45,
  cookTimeDifficulty: 'Easy',
  servings: '4',
  ingredients: ['500 g brambor', '1 cibule', '2 stroužky česneku', '1 l vody', '30 g sušených hub', 'sůl', 'majoránka'],
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
// import button on the home page accepts. The allowed enum values and their
// Czech meanings come straight from shared/types/recipe.ts so a new category
// shows up here without anyone remembering to update the prompt. The two
// language variants must stay rule-for-rule equivalent — when changing one,
// change the other.
export function buildImportPrompt(lang: PromptLang = 'en'): string {
  const categoryList = CATEGORIES.map((c) => `  - "${c}" (${CATEGORY_LABELS[c]})`).join('\n')
  const difficultyList = DIFFICULTIES.map((d) => `  - "${d}" (${DIFFICULTY_LABELS[d]})`).join('\n')
  const example = JSON.stringify([EXAMPLE], null, 2)

  if (lang === 'cs') {
    return `Převádíš recept do souboru JSON pro import do Recepikarteru, osobní aplikace na kartičky s recepty.

Za tyto instrukce vložím recept (text zkopírovaný z webu, nebo adresu URL). Převeď ho do JSON, který přesně odpovídá schématu níže. Výsledek poskytni jako soubor ke stažení pojmenovaný podle receptu — hodnota "name" plus ".json", např. "Bramboračka.json" — ne jako text v odpovědi. Pouze pokud soubory vytvářet neumíš, odpověz samotným JSON — bez komentáře a bez markdownového bloku s kódem.

TVAR VÝSTUPU

Pole JSON obsahující přesně jeden objekt s těmito poli, všechna jsou povinná:

- "name": řetězec. Název receptu v češtině, krátký, bez marketingových přívlastků z webu.
- "category": jedna z těchto přesných anglických hodnot (český význam je v závorce — nevypisuj české slovo):
${categoryList}
- "cookTime": celé číslo. Celkový aktivní čas v minutách od začátku po podávání (příprava plus vaření). Nepočítej dlouhé pasivní čekání, jako je marinování přes noc nebo chlazení. Pokud zdroj čas neuvádí, rozumně ho odhadni.
- "cookTimeDifficulty": jedna z těchto přesných anglických hodnot:
${difficultyList}
  Posuzuj podle techniky a počtu kroků, ne podle toho, jak recept označuje zdroj.
- "servings": řetězec. Počet porcí číslicemi, např. "4". Pokud není znám, použij "" (prázdný řetězec).
- "ingredients": pole řetězců, jedna surovina na položku, v pořadí použití. Množství uveď jako první, např. "200 g hladké mouky", "30 ml oleje", "1 cibule". Pokud zdroj suroviny dělí do částí (těsto, náplň…), zachovej pořadí, ale nepřidávej nadpisy částí.
- "steps": pole řetězců, jeden krok na položku, v pořadí. Kroky nečísluj. Každý krok má být úplná instrukce včetně časů a teplot, které zdroj uvádí.
- "tags": pole 0–5 krátkých štítků malými písmeny v češtině pro hlavní surovinu, kuchyni nebo příležitost, např. ["kuřecí", "rychlé", "vánoce"].

PRAVIDLA

- Veškerý obsah receptu piš česky. Pokud je zdroj v jiném jazyce, přelož ho a používej běžné české kuchařské výrazy.
- Množství zachovej přesně tak, jak jsou uvedena, ale jednotky sjednoť na metrické: objem v mililitrech nebo litrech (ml, l), hmotnost v gramech nebo kilogramech (g, kg), teploty ve stupních Celsia. Přepočítej imperiální jednotky (oz, lb, fl oz, °F) i domácí míry: hrnky, šálky, lžíce a lžičky sypkých nebo pevných surovin (mouka, cukr, máslo, rýže…) převeď na gramy podle běžné hustoty dané suroviny — např. „1 cup of flour“ → „125 g mouky“, „1 cup of sugar“ → „200 g cukru“, „1 stick of butter“ → „115 g másla“. Hrnky a lžíce tekutin převeď na mililitry (1 cup ≈ 240 ml, 1 lžíce ≈ 15 ml, 1 lžička ≈ 5 ml). Počty kusů (1 cibule, 2 vejce) ponech.
- Nikdy nevymýšlej suroviny ani kroky, které ve zdroji nejsou.
- Vynech úvodní vyprávění z webu, komentáře, nutriční tabulky a reklamu.
- Pokud zdroj obsahuje více receptů, převeď jen ten hlavní.
- Výstup musí být platný JSON: dvojité uvozovky, žádné čárky navíc, žádné komentáře.

PŘÍKLAD VÝSTUPU

${example}

Tady je recept k převedení:
`
  }

  return `You are converting a recipe into a JSON file for import into Recepikarter, a personal recipe-card app.

I will paste a recipe (text copied from a website, or a URL) after these instructions. Convert it into JSON that follows the schema below exactly. Provide the result as a downloadable file named after the recipe — the "name" value plus ".json", e.g. "Bramboračka.json" — not as text in the reply. Only if you cannot create files, reply with the JSON alone — no commentary, no markdown code fences.

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
- "ingredients": array of strings, one ingredient per entry, in the order used. Put the amount first, e.g. "200 g hladké mouky", "30 ml oleje", "1 cibule". If the source groups ingredients into sections (dough, filling…), keep the order but do not add section headings.
- "steps": array of strings, one step per entry, in order. Do not prefix steps with numbers. Each step should be a complete instruction with the times and temperatures the source gives.
- "tags": array of 0–5 short lowercase Czech tags for the main ingredient, cuisine or occasion, e.g. ["kuřecí", "rychlé", "vánoce"].

RULES

- Write all recipe content in Czech. Translate if the source is in another language, keeping standard Czech culinary terms.
- Keep quantities exactly as given, but normalize every unit to metric: volume in millilitres or litres (ml, l), weight in grams or kilograms (g, kg), temperatures in degrees Celsius. Convert imperial units (oz, lb, fl oz, °F) and household measures alike: cups, tablespoons and teaspoons of dry or solid ingredients (flour, sugar, butter, rice…) become grams using the usual density of that ingredient — e.g. "1 cup of flour" → "125 g mouky", "1 cup of sugar" → "200 g cukru", "1 stick of butter" → "115 g másla". Cups and spoons of liquids become millilitres (1 cup ≈ 240 ml, 1 tbsp ≈ 15 ml, 1 tsp ≈ 5 ml). Leave piece counts (1 onion, 2 eggs) as they are.
- Never invent ingredients or steps that aren't in the source.
- Leave out the site's intro story, comments, nutrition tables and advertising.
- If the source contains several recipes, convert only the main one.
- Output valid JSON: double quotes, no trailing commas, no comments.

EXAMPLE OUTPUT

${example}

Here is the recipe to convert:
`
}
