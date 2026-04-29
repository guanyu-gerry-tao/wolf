/**
 * Wolf-builtin behavioral interview prompts seeded into every profile.toml.
 *
 * # Why hard-coded
 *
 * The list is small (~17), changes infrequently, and is part of the schema
 * contract — `wolf doctor` checks each `required: true` builtin's
 * `star_story` is filled. Hard-coding sidesteps the need to parse the
 * template at runtime to recover the schema.
 *
 * # Builtin vs custom
 *
 * Stories whose `id` appears in this list are **wolf-builtin**. wolf
 * commands enforce extra rules on builtins (can't delete, can't change
 * `prompt` / `required`). Anything else is user-custom (β does NOT yet
 * implement custom-add; that's phase 2).
 *
 * # Lazy inject
 *
 * When wolf reads profile.toml and finds a builtin id missing from the
 * `[[story]]` array (because the user installed an older binary that
 * didn't seed it), the missing builtin is appended on next write — see
 * `injectMissingBuiltinStories` in profileToml.ts. New wolf releases
 * adding builtins do NOT require a schema_version bump.
 */
export interface BuiltinStory {
  id: string;
  prompt: string;
  required: boolean;
}

export const WOLF_BUILTIN_STORIES: ReadonlyArray<BuiltinStory> = [
  { id: 'tell_me_about_yourself',          prompt: 'Tell me about yourself',                                                  required: true  },
  { id: 'tell_me_about_failure',           prompt: 'Tell me about a time you failed',                                         required: true  },
  { id: 'tell_me_about_conflict',          prompt: 'Tell me about a time you faced conflict',                                 required: true  },
  { id: 'biggest_strength',                prompt: 'Biggest strength',                                                        required: true  },
  { id: 'biggest_weakness',                prompt: "Biggest weakness (with what you're doing about it)",                      required: true  },
  { id: 'five_year_goal',                  prompt: 'Where do you see yourself in 5 years?',                                   required: true  },
  { id: 'why_leaving_current_role',        prompt: 'Why are you leaving your current role?',                                  required: false },
  { id: 'handle_stress_failure',           prompt: 'How do you handle stress / failure?',                                     required: true  },
  { id: 'what_motivates',                  prompt: 'What motivates you?',                                                     required: true  },
  { id: 'led_team_or_project',             prompt: 'Describe a time you led a team or project',                               required: true  },
  { id: 'handled_disagreed_feedback',      prompt: 'Describe a time you handled feedback you disagreed with',                 required: true  },
  { id: 'management_style',                prompt: 'What is your management style?',                                          required: false },
  { id: 'proudest_project',                prompt: "Tell me about a project you're proud of",                                 required: true  },
  { id: 'view_company_framework',          prompt: 'How do you view our company? — your framework',                          required: true  },
  { id: 'view_product_framework',          prompt: 'How do you view our product? — your framework',                          required: true  },
  { id: 'suggestions_company_framework',   prompt: 'What suggestions do you have for our company? — your framework',         required: true  },
  { id: 'suggestions_product_framework',   prompt: 'What suggestions do you have for our product? — your framework',         required: true  },
];

/** Fast lookup: is this id a wolf-builtin? Used by command handlers to
 *  reject `wolf profile remove story <id>` / `set story.<id>.prompt` etc. */
export const WOLF_BUILTIN_STORY_IDS: ReadonlySet<string> = new Set(
  WOLF_BUILTIN_STORIES.map((s) => s.id),
);
