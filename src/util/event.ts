// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

export class EventContext<Type> {
  private _propagationStopped = false

  constructor(public readonly type?: Type) {
  }

  public get propagationStopped(): boolean {
    return this._propagationStopped
  }

  public stopPropagation(): void {
    this._propagationStopped = true
  }
}

export type EventListener<Type, Event> = (event: Event, context: EventContext<Type>) => void

export class EventDispatcher<Type, Event> {
  private listeners: Record<string, EventListener<Type, Event>[]> = {}

  private _addListener(index: string, listener: EventListener<Type, Event>): void {
    if (!this.listeners[index]) {
      this.listeners[index] = []
    }
    this.listeners[index].push(listener)
  }

  public addListener(type: Type, listener: EventListener<Type, Event>): void {
    this._addListener(String(type), listener)
  }

  public copyListeners(other: EventDispatcher<Type, Event>): void {
    for (const [index, listeners] of Object.entries(other.listeners)) {
      for (const listener of listeners) {
        this._addListener(index, listener)
      }
    }
  }

  public fire(type: Type, event: Event): void {
    const context = new EventContext(type)
    const listeners: EventListener<Type, Event>[] = this.listeners[String(type)] || []
    for (const listener of listeners) {
      listener(event, context)
      if (context.propagationStopped) {
        break
      }
    }
  }

  public getListenerCount(type: Type): number {
    const index = String(type)
    return this.listeners[index] ? this.listeners[index].length : 0
  }
}

export type SimpleEventListener<Event> = (event: Event, context: EventContext<void>) => void

export class SimpleEventDispatcher<Event> {
  private dispatcher = new EventDispatcher<void, Event>()

  public addListener(listener: SimpleEventListener<Event>): void {
    this.dispatcher.addListener(undefined, listener)
  }

  public fire(event: Event): void {
    this.dispatcher.fire(undefined, event)
  }

  public getListenerCount(): number {
    return this.dispatcher.getListenerCount(undefined)
  }
}
