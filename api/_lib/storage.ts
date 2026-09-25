export type StoredObject = { key: string; contentType: string; expiresAt: Date }

export interface ObjectStorage {
  put(input: ReadableStream<Uint8Array>, object: StoredObject): Promise<void>
  signedUrl(key: string, expiresInSeconds: number): Promise<string>
  remove(key: string): Promise<void>
}

export function storageRequired(): never {
  throw new Error('Configure an object storage adapter before enabling transformed media downloads.')
}
