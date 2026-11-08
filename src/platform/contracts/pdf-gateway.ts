export interface PdfGateway {
  exportToPath(path: string): Promise<void>
}
