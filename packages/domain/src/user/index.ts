export type UserId = string & { readonly __brand: 'UserId' }

export interface User {
  id: UserId
  email: string
  name: string
  createdAt: Date
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email)
}

export function createUserId(raw: string): UserId {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    throw new Error('UserId cannot be empty')
  }
  return trimmed as UserId
}

export interface UserCreatedEvent {
  readonly type: 'user.created'
  readonly userId: UserId
  readonly email: string
  readonly occurredAt: Date
}

export function userCreated(user: Pick<User, 'id' | 'email'>): UserCreatedEvent {
  return {
    type: 'user.created',
    userId: user.id,
    email: user.email,
    occurredAt: new Date(),
  }
}
