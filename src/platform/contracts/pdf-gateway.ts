export interface PdfGateway {
  print(): Promise<void>
  exportToPath(path: string): Promise<void>
  onAfterPrint(listener: () => void): () => void
}
