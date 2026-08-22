import { z } from 'zod';

/**
 * The shape of SANA's frozen protocol library.
 *
 * Master prompt section 3: every spoken medical step comes from here, is read
 * as written, and is never paraphrased, reordered or invented. The schema is
 * deliberately strict — `.strict()` everywhere — so a content file that grows
 * an unexpected field fails loudly rather than carrying something nobody
 * reviewed into the app.
 */

/** Language denylist for step text. See {@link ProtocolStep}. */
const DIAGNOSIS_WORDS = [
  'diagnos',
  'probably',
  'likely a',
  'this is a case of',
  'suffering from',
  'caused by',
  'prescrib',
  'dose of',
  'milligram',
  'mg of',
] as const;

const noDiagnosisLanguage = (text: string): boolean => {
  const lower = text.toLowerCase();
  return !DIAGNOSIS_WORDS.some((word) => lower.includes(word));
};

const DIAGNOSIS_MESSAGE =
  'reads as a diagnosis, a cause, or a prescription. SANA responds only to observable ' +
  'facts (master prompt section 3). Rephrase as an instruction or an observation.';

export const ClinicianReview = z
  .object({
    status: z.enum(['pending', 'approved']),
    reviewer: z.string().min(1).nullable(),
    date: z.string().date().nullable(),
  })
  .strict()
  .refine((r) => r.status === 'pending' || (r.reviewer !== null && r.date !== null), {
    message:
      'an approved protocol must name its reviewer and the date of review — ' +
      '"reviewed" is a claim about a person, not a flag',
  });

export const ProtocolStep = z
  .object({
    n: z.number().int().positive(),
    /**
     * The locked wording. This is what SANA says, verbatim. Nothing at runtime
     * may rewrite, summarise or reorder it.
     */
    text: z.string().min(1).refine(noDiagnosisLanguage, { message: `step text ${DIAGNOSIS_MESSAGE}` }),
    audio: z.string().min(1),
  })
  .strict();

export const Protocol = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'protocol ids are lowercase kebab-case'),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    title: z.string().min(1),
    /** How SANA refers to it aloud at the confirm beat, mid-sentence. */
    spoken_title: z.string().min(1),
    /**
     * Spoken before any step is read. The human confirms or rejects the match
     * here; this sentence is the safety rail made audible.
     */
    confirm_prompt: z
      .string()
      .min(1)
      .refine(noDiagnosisLanguage, { message: `confirm prompt ${DIAGNOSIS_MESSAGE}` }),
    /** Observable facts, not causes — what a frightened bystander can actually see. */
    match_cues: z.array(z.string().min(1)).min(3),
    /**
     * Whether calling for help is itself an early step rather than an option.
     * Set for protocols where the definitive treatment is only available at a
     * hospital, so guidance must not read as a substitute for going there.
     */
    escalate_immediately: z.boolean(),
    steps: z.array(ProtocolStep).min(1),
    sources: z.array(z.string().min(1)).min(1),
    clinician_review: ClinicianReview,
  })
  .strict()
  .superRefine((p, ctx) => {
    p.steps.forEach((step, i) => {
      if (step.n !== i + 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['steps', i, 'n'],
          message: `steps must be numbered 1..n in order; found ${step.n} at position ${i + 1}`,
        });
      }
    });
  });

export const SystemLine = z
  .object({
    text: z.string().min(1),
    audio: z.string().min(1),
    /** Why this line exists and when it is spoken. Kept in content, not code. */
    note: z.string().min(1),
  })
  .strict();

/**
 * The non-protocol things SANA is allowed to say.
 *
 * Hashed and locked exactly like medical content. `unmatched` in particular is
 * safety-critical: it is the sentence that sends a human to real help instead
 * of to a guess.
 */
export const SystemLines = z
  .object({
    id: z.literal('_system'),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    description: z.string().min(1),
    lines: z
      .object({
        acknowledge: SystemLine,
        thinking: SystemLine,
        unmatched: SystemLine,
        not_right: SystemLine,
        step_done: SystemLine,
        protocol_complete: SystemLine,
        escalation_confirmed: SystemLine,
        no_emergency_number: SystemLine,
      })
      .strict(),
    clinician_review: ClinicianReview,
  })
  .strict();

export const StepHashes = z
  .object({
    text_sha256: z.string().regex(/^[0-9a-f]{64}$/),
    /** Null until tools/generate_audio.py has produced the recording. */
    audio_sha256: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  })
  .strict();

export const Manifest = z
  .object({
    generated_by: z.string().min(1),
    library_sha256: z.string().regex(/^[0-9a-f]{64}$/),
    entries: z.record(
      z.string(),
      z
        .object({
          file_sha256: z.string().regex(/^[0-9a-f]{64}$/),
          steps: z.record(z.string(), StepHashes),
        })
        .strict(),
    ),
  })
  .strict();

export type Protocol = z.infer<typeof Protocol>;
export type ProtocolStep = z.infer<typeof ProtocolStep>;
export type SystemLines = z.infer<typeof SystemLines>;
export type SystemLineName = keyof SystemLines['lines'];
export type Manifest = z.infer<typeof Manifest>;
export type ClinicianReview = z.infer<typeof ClinicianReview>;

export { DIAGNOSIS_WORDS };
