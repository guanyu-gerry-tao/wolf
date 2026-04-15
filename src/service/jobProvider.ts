/** Raw job data returned by a provider — structure varies by source. */
export type RawJob = Record<string, unknown>;

export interface JobProvider {
  readonly name: string;
  fetch(): Promise<RawJob[]>;
}
