import { z } from 'zod';

/**
 * MVP Config Schema (v1.5)
 * Source of truth: MVP_CONFIG_SCHEMA_v1.5.md
 * スキーマ外キーは起動時エラー（strict mode）
 */

const ConfirmSchema = z.object({
  revealThreshold: z.number().min(0).max(1),
  confidenceConfirmBand: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]).refine(
    (val) => val[0] <= val[1],
    { message: 'confidenceConfirmBand[0] must be <= confidenceConfirmBand[1]' }
  ),
  qForcedIndices: z.array(z.number().int().positive()),
  softConfidenceMin: z.number().min(0).max(1),
  hardConfidenceMin: z.number().min(0).max(1),
}).strict();

const AlgoSchema = z.object({
  beta: z.number().positive(),
  alpha: z.number().min(0).max(1),
  derivedConfidenceThreshold: z.number().min(0).max(1),
  revealPenalty: z.number().positive().max(1),
}).strict();

const FlowSchema = z.object({
  maxQuestions: z.number().int().positive(),
  maxRevealMisses: z.number().int().positive(),
  failListN: z.number().int().positive(),
  effectiveConfirmThresholdFormula: z.enum(['A']),
  effectiveConfirmThresholdParams: z.object({
    min: z.number().int().positive(),
    max: z.number().int().positive(),
    divisor: z.number().int().positive(),
  }).strict().refine(
    (val) => val.max >= val.min,
    { message: 'effectiveConfirmThresholdParams.max must be >= min' }
  ),
}).strict();

const DataQualitySchema = z.object({
  minCoverageMode: z.enum(['RATIO', 'WORKS', 'AUTO']),
  minCoverageRatio: z.number().min(0).max(1).nullable(),
  minCoverageWorks: z.number().int().nonnegative().nullable(),
}).strict();

const PopularitySchema = z.object({
  playBonusOnSuccess: z.number().nonnegative(),
}).strict();

export const MvpConfigSchema = z.object({
  version: z.literal('v1.5'),
  confirm: ConfirmSchema,
  algo: AlgoSchema,
  flow: FlowSchema,
  dataQuality: DataQualitySchema,
  popularity: PopularitySchema,
}).strict();

export type MvpConfig = z.infer<typeof MvpConfigSchema>;
