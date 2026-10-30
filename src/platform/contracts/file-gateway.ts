export interface ImportedFile { folderPath: string; title: string; content: string }
export interface SaveTextInput { defaultName: string; contents: string; filterName: string; extensions: string[] }
export interface SavePathInput { defaultName: string; filterName: string; extensions: string[] }
export type SaveResult = { kind: 'canceled' } | { kind: 'web' } | { kind: 'saved'; path: string }
export interface FileGateway { pickFiles(): Promise<ImportedFile[]>; pickFolder(): Promise<ImportedFile[] | null>; chooseSavePath(input: SavePathInput): Promise<string | null>; saveText(input: SaveTextInput): Promise<SaveResult> }
