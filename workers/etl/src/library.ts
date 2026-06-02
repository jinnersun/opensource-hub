/**
 * ETL Library 分支 — barrel re-export
 * 实现已拆分至 library/ai.ts + library/pipeline.ts
 */

export type { LibraryAIResult, ProjectType } from './library/ai'
export { LibraryAIClient, VALID_PROJECT_TYPES, VALID_CATEGORIES } from './library/ai'
export type { LibraryBatchStats } from './library/pipeline'
export { promoteToLibrary } from './library/pipeline'
