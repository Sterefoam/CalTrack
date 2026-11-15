export class AnalysisError extends Error {
  constructor(public code: string, public status = 502) { super(code); }
}
