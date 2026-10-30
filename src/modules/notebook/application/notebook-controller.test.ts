import { describe, expect, it } from 'vitest'
import { NotebookController } from './notebook-controller'
import type { NotebookSnapshot } from '../domain/note'

class MemoryRepository {
  snapshot: NotebookSnapshot | null = null
  async load() { return this.snapshot }
  async save(snapshot: NotebookSnapshot) { this.snapshot = snapshot }
}

describe('NotebookController', () => {
  it('creates and updates notes without exposing persistence details', async () => {
    const repository = new MemoryRepository()
    const controller = new NotebookController(repository)
    await controller.hydrate()
    const id = controller.createNote(undefined, '# Architecture')
    controller.updateNote(id, '# Architecture\n\ncontent')
    expect(controller.getSnapshot().notes[0]).toMatchObject({ id, title: 'Architecture' })
    await new Promise((resolve) => setTimeout(resolve, 220))
    expect(repository.snapshot?.notes[0].content).toContain('content')
  })

  it('moves the active selection when the active note is removed', async () => {
    const controller = new NotebookController(new MemoryRepository())
    await controller.hydrate()
    const first = controller.getSnapshot().activeId
    controller.createNote('second')
    controller.removeNote(controller.getSnapshot().activeId as string)
    expect(controller.getSnapshot().activeId).toBe(first)
  })
})
